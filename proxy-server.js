const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 유틸리티 함수들 정의
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractAspNetParams(html) {
    const $ = cheerio.load(html);
    return {
        viewState: $('input[name="__VIEWSTATE"]').val(),
        eventValidation: $('input[name="__EVENTVALIDATION"]').val()
    };
}

function parsePlayers(asyncHtml) {
    try {
        let html = asyncHtml;
        
        // ASP.NET AJAX 응답 파싱
        if (asyncHtml.includes('|') && asyncHtml.includes('updatePanel')) {
            const parts = asyncHtml.split('|');
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === 'updatePanel' && parts[i + 1] && parts[i + 1].includes('udpRecord')) {
                    try {
                        html = decodeURIComponent(parts[i + 2]);
                        break;
                    } catch (e) {
                        html = parts[i + 2];
                        break;
                    }
                }
            }
        }
        
        const $ = cheerio.load(html);
        const players = [];
        
        // 각 포지션별 테이블을 순회 (선수만 필터링)
        $('table.tNData').each((tableIndex, table) => {
            const $table = $(table);
            const positionHeader = $table.find('thead th:nth-child(2)').text().trim();
            
            console.log(`[DEBUG] Table ${tableIndex}: ${positionHeader}`);
            
            // 포지션 결정 (감독, 코치, 선수명 헤더 제외)
            let position = '';
            if (positionHeader === '투수') position = '투수';
            else if (positionHeader === '포수') position = '포수';
            else if (positionHeader === '내야수') position = '내야수';
            else if (positionHeader === '외야수') position = '외야수';
            else if (positionHeader === '선수명') {
                // 마지막 테이블의 경우 포지션이 별도 컬럼에 있음
                position = 'mixed';
            } else {
                console.log(`[DEBUG] Skipping table with header: ${positionHeader}`);
                return; // 감독, 코치는 스킵
            }
            
            // 각 선수 행 파싱
            $table.find('tbody tr').each((rowIndex, row) => {
                const $row = $(row);
                let $nameLink, playerPosition, backNo, throwHand, birthday, physique;
                
                if (position === 'mixed') {
                    // 선수명이 헤더인 경우 (6컬럼 테이블)
                    $nameLink = $row.find('td:nth-child(2) a');
                    playerPosition = $row.find('td:nth-child(3)').text().trim();
                    backNo = $row.find('td:nth-child(1)').text().trim();
                    throwHand = $row.find('td:nth-child(4)').text().trim();
                    birthday = $row.find('td:nth-child(5)').text().trim();
                    physique = $row.find('td:nth-child(6)').text().trim();
                    
                    // 포지션에서 실제 포지션 부분만 추출 (괄호 앞부분)
                    const actualPosition = playerPosition.split('(')[0].trim();
                    
                    // 선수만 포함 (감독, 코치 제외)
                    const validPositions = ['투수', '포수', '내야수', '외야수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', 'DH', '지명타자'];
                    const isValidPlayer = actualPosition && validPositions.includes(actualPosition);
                    
                    if (!isValidPlayer || actualPosition === '') {
                        console.log(`[DEBUG] Skipping non-player: ${$nameLink.text().trim()} (${playerPosition})`);
                        return; // 선수가 아닌 경우 스킵
                    }
                } else {
                    // 일반적인 5컬럼 테이블
                    $nameLink = $row.find('td:nth-child(2) a');
                    playerPosition = position;
                    backNo = $row.find('td:nth-child(1)').text().trim();
                    throwHand = $row.find('td:nth-child(3)').text().trim();
                    birthday = $row.find('td:nth-child(4)').text().trim();
                    physique = $row.find('td:nth-child(5)').text().trim();
                }
                
                if ($nameLink.length > 0) {
                    const href = $nameLink.attr('href');
                    const playerIdMatch = href.match(/playerId=(\d+)/);
                    
                    if (playerIdMatch) {
                        const player = {
                            playerId: playerIdMatch[1],
                            name: $nameLink.text().trim(),
                            backNo: backNo,
                            position: playerPosition,
                            throwHand: throwHand,
                            birthday: birthday,
                            physique: physique
                        };
                        
                        console.log(`[DEBUG] Found player: ${player.name} (${player.position})`);
                        players.push(player);
                    }
                }
            });
        });
        
        return { success: true, players };
    } catch (error) {
        return { success: false, players: [], error: error.message };
    }
}

// 팀 목록 조회 재시도 함수
async function fetchTeamsWithRetry(year, attempt = 1, maxRetries = 5) {
    console.log(`[DEBUG] Attempt ${attempt}/${maxRetries} for teams year ${year}`);
    
    try {
        console.log(`[DEBUG] Fetching teams for year: ${year}`);
        
        // 날짜는 7월 1일로 고정
        const date = `${year}0701`;
        const url = 'https://www.koreabaseball.com/Player/Register.aspx';
        
        // 1단계: 초기 페이지 접속하여 ViewState, EventValidation 추출
        const initialResponse = await fetch(url);
        const initialHtml = await initialResponse.text();
        const initialParams = extractAspNetParams(initialHtml);
        
        if (!initialParams.viewState || !initialParams.eventValidation) {
            throw new Error('ASP.NET ViewState 추출 실패');
        }
        
        // 2단계: 해당 연도로 폼 제출하여 실제 구단 목록 가져오기
        const formData = new URLSearchParams({
            'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ScriptManager1': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$udpRecord|ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
            'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchDate': date,
            '__EVENTTARGET': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': initialParams.viewState,
            '__EVENTVALIDATION': initialParams.eventValidation,
            '__ASYNCPOST': 'true'
        });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': 'https://www.koreabaseball.com',
                'Referer': 'https://www.koreabaseball.com/Player/Register.aspx',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-MicrosoftAjax': 'Delta=true',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }
        
        const asyncHtml = await response.text();
        console.log(`[DEBUG] Response received, parsing HTML for year ${year}`);
        
        // AJAX 응답 파싱
        let html = asyncHtml;
        if (asyncHtml.includes('|') && asyncHtml.includes('updatePanel')) {
            const parts = asyncHtml.split('|');
            for (let i = 0; i < parts.length; i++) {
                if (parts[i] === 'updatePanel' && parts[i + 1] && parts[i + 1].includes('udpRecord')) {
                    try {
                        html = decodeURIComponent(parts[i + 2]);
                        break;
                    } catch (e) {
                        html = parts[i + 2];
                        break;
                    }
                }
            }
        }
        
        const $ = cheerio.load(html);
        const teams = [];
        
        // HTML 구조 디버깅
        console.log(`[DEBUG] HTML length for year ${year}:`, html.length);
        console.log(`[DEBUG] Looking for teams with selector: #cphContents_cphContents_cphContents_udpRecord .teams ul li`);
        console.log(`[DEBUG] udpRecord found:`, $('#cphContents_cphContents_cphContents_udpRecord').length);
        console.log(`[DEBUG] .teams found:`, $('.teams').length);
        console.log(`[DEBUG] ul li found:`, $('ul li').length);
        
        // 다양한 셀렉터 시도
        let selectorUsed = '';
        let $teamElements = $('#cphContents_cphContents_cphContents_udpRecord .teams ul li');
        
        if ($teamElements.length === 0) {
            console.log(`[DEBUG] First selector failed, trying alternatives...`);
            $teamElements = $('.teams ul li');
            selectorUsed = '.teams ul li';
        }
        
        if ($teamElements.length === 0) {
            $teamElements = $('ul li[data-id]');
            selectorUsed = 'ul li[data-id]';
        }
        
        if ($teamElements.length === 0) {
            $teamElements = $('li[data-id]');
            selectorUsed = 'li[data-id]';
        }
        
        console.log(`[DEBUG] Using selector: ${selectorUsed || 'original'}, found ${$teamElements.length} elements`);
        
        // HTML 내용 일부 확인 (디버깅용)
        if ($teamElements.length === 0) {
            console.log(`[DEBUG] HTML snippet (first 500 chars):`, html.substring(0, 500));
            console.log(`[DEBUG] Searching for common team selectors...`);
            console.log(`[DEBUG] .team found:`, $('.team').length);
            console.log(`[DEBUG] [data-team] found:`, $('[data-team]').length);
            console.log(`[DEBUG] img elements found:`, $('img').length);
            console.log(`[DEBUG] anchor elements found:`, $('a').length);
        }
        
        // HTML 분석 결과에 따라 실제 셀렉터 사용 - 로고 이미지 포함
        $teamElements.each((i, el) => {
            const $li = $(el);
            const dataId = $li.attr('data-id');
            
            if (dataId) {
                const $link = $li.find('a');
                const imgSrc = $link.find('img').attr('src');
                const teamName = $link.find('span').text().trim();
                
                let fullImageUrl = '';
                if (imgSrc) {
                    if (imgSrc.startsWith('http')) {
                        fullImageUrl = imgSrc;
                    } else if (imgSrc.startsWith('//')) {
                        fullImageUrl = 'https:' + imgSrc;
                    } else {
                        // 상대경로인 경우 올바른 CDN URL로 변환
                        console.log(`[DEBUG] Original imgSrc: ${imgSrc}`);
                        fullImageUrl = imgSrc;
                    }
                }
                
                teams.push({
                    name: teamName || dataId,
                    code: dataId,
                    imageUrl: fullImageUrl || `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_${dataId}.png`
                });
            }
        });
        
        console.log(`[DEBUG] Found ${teams.length} teams from AJAX response for year ${year}`);
        
        // 팀을 찾지 못한 경우 실패로 반환
        if (teams.length === 0) {
            console.log(`[DEBUG] No teams found from HTML for year ${year} on attempt ${attempt}`);
            return { success: false, teams: [], error: 'No teams found' };
        }
        
        return { success: true, teams };
    } catch (error) {
        console.error(`[팀 목록 조회 실패 - ${year}년 attempt ${attempt}]`, error);
        return { success: false, teams: [], error: error.message };
    }
}

// KBO 구단 목록 조회 엔드포인트 (재시도 로직 포함)
app.get('/api/teams/:year', async (req, res) => {
    const { year } = req.params;
    const maxRetries = 5;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await fetchTeamsWithRetry(year, attempt, maxRetries);
            
            // 성공한 경우
            if (result.success && result.teams.length > 0) {
                console.log(`[DEBUG] Success on attempt ${attempt} with ${result.teams.length} teams`);
                res.json(result);
                return;
            }
            
            lastError = result.error;
            
            // 마지막 시도가 아니라면 잠시 대기
            if (attempt < maxRetries) {
                await delay(1000 * attempt); // 점진적 대기
            }
        } catch (error) {
            lastError = error;
            console.error(`[DEBUG] Attempt ${attempt} failed:`, error.message);
            
            if (attempt < maxRetries) {
                await delay(1000 * attempt);
            }
        }
    }
    
    // 모든 재시도 실패 시 기본 팀 목록으로 폴백
    try {
        console.log(`[DEBUG] All attempts failed, using default teams for year ${year}`);
        const defaultTeams = getDefaultTeamsForYear(year);
        const teams = defaultTeams.map(team => ({
            ...team,
            imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_${team.code}.png`
        }));
        
        res.json({ success: true, teams, fallback: true });
    } catch (fallbackError) {
        console.error(`[팀 목록 폴백 실패 - ${year}년]`, fallbackError);
        res.status(500).json({ success: false, error: lastError || fallbackError.message });
    }
});

// KBO 선수 목록 크롤링 엔드포인트 (개선된 재시도 로직)
app.post('/api/players', async (req, res) => {
    const { year, teamCode, date } = req.body;
    
    // 미래 날짜 검증
    if (date) {
        const requestDate = new Date(date.slice(0, 4), date.slice(4, 6) - 1, date.slice(6, 8));
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 시간 부분 제거
        
        if (requestDate > today) {
            console.log(`[DEBUG] Future date rejected: ${date} (${requestDate.toISOString().split('T')[0]} > ${today.toISOString().split('T')[0]})`);
            return res.status(400).json({ 
                success: false, 
                error: '미래 날짜는 검색할 수 없습니다.',
                players: [] 
            });
        }
    }
    
    const maxRetries = 5; // 재시도 횟수 증가
    let lastError = null;
    let bestResult = null; // 가장 좋은 결과 저장
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[DEBUG] Attempt ${attempt}/${maxRetries} for players`);
            const result = await fetchPlayersWithRetry(req.body, attempt);
            
            // 완전 성공
            if (result.success && result.players.length >= 5) {
                console.log(`[DEBUG] Success on attempt ${attempt} with ${result.players.length} players`);
                res.json(result);
                return;
            }
            
            // 부분 성공 (일부 선수라도 파싱됨)
            if (result.players && result.players.length > 0) {
                console.log(`[DEBUG] Partial success on attempt ${attempt} with ${result.players.length} players`);
                if (!bestResult || result.players.length > bestResult.players.length) {
                    bestResult = result;
                }
            }
            
            lastError = result.error || 'Unknown error';
            console.log(`[DEBUG] Attempt ${attempt} failed:`, lastError);
            
            // 점진적 대기 시간 (500ms, 1s, 1.5s, 2s, 2.5s)
            if (attempt < maxRetries) {
                const waitTime = 500 * attempt;
                console.log(`[DEBUG] Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
        } catch (error) {
            lastError = error;
            console.error(`[DEBUG] Attempt ${attempt} error:`, error.message);
            
            if (attempt < maxRetries) {
                const waitTime = 500 * attempt;
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    // 부분 성공이라도 있으면 사용
    if (bestResult && bestResult.players.length > 0) {
        console.log(`[DEBUG] Using best partial result with ${bestResult.players.length} players`);
        res.json({ success: true, players: bestResult.players, partial: true });
        return;
    }
    
    // 모든 재시도 실패 시 에러 반환
    console.log('[DEBUG] All attempts failed completely, returning error');
    res.status(500).json({ 
        success: false, 
        error: '선수 데이터를 불러올 수 없습니다. 다시 시도해주세요.',
        lastError: lastError?.message || 'Unknown error'
    });
});

// proxy-server.js (일부 발췌 및 패치 적용된 fetchPlayersWithRetry 함수)

async function fetchPlayersWithRetry(requestBody, attempt) {
    const { year, team, date } = requestBody;
    const registerUrl = 'https://www.koreabaseball.com/Player/Register.aspx';
    
    console.log(`[DEBUG] Attempt ${attempt} - Fetching players for:`, { year, team, date });
  
    try {
        // 1차 요청: VIEWSTATE, EVENTVALIDATION 추출용
        const initialResponse = await fetch(registerUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache'
            }
        });
        
        if (!initialResponse.ok) {
            throw new Error(`Initial page load failed: ${initialResponse.status}`);
        }
        
        const html = await initialResponse.text();
        const { viewState, eventValidation } = extractAspNetParams(html);
        
        if (!viewState || !eventValidation) {
            throw new Error('ASP.NET ViewState 추출 실패');
        }
        
        // 날짜 형식 변환: 2024-05-15 -> 20240515
        const formattedDate = date.replace(/-/g, '');
        
        const formData = new URLSearchParams({
            'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ScriptManager1': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$udpRecord|ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
            'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchTeam': team,
            'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchDate': formattedDate,
            '__EVENTTARGET': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
            '__EVENTARGUMENT': '',
            '__VIEWSTATE': viewState,
            '__EVENTVALIDATION': eventValidation,
            '__ASYNCPOST': 'true'
        });
        
        // 2차 요청: 실제 선수 데이터 요청
        const response = await fetch(registerUrl, {
            method: 'POST',
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': 'https://www.koreabaseball.com',
                'Referer': 'https://www.koreabaseball.com/Player/Register.aspx',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-MicrosoftAjax': 'Delta=true',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            throw new Error(`POST request failed: ${response.status}`);
        }
        
        const asyncHtml = await response.text();
        console.log(`[DEBUG] Attempt ${attempt} - Response length:`, asyncHtml.length);
        
        const result = parsePlayers(asyncHtml);
        console.log(`[DEBUG] Attempt ${attempt} - Parsed ${result.players.length} players`);
        
        return result;
        
    } catch (error) {
        console.error(`[DEBUG] Attempt ${attempt} error:`, error.message);
        throw error;
    }
}
  

// 날짜 유효성 검증 함수
function isValidKboDate(dateString, year) {
    try {
        const date = new Date(
            dateString.substring(0, 4),
            parseInt(dateString.substring(4, 6)) - 1,
            dateString.substring(6, 8)
        );
        
        // 연도 확인
        if (date.getFullYear() != year) {
            return false;
        }
        
        // KBO 시즌 기간 확인 (3월-11월)
        const month = date.getMonth() + 1;
        if (month < 3 || month > 11) {
            return false;
        }
        
        // 월요일 제외 (0=일요일, 1=월요일)
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 1) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

// 선수 상세 정보 크롤링 엔드포인트 (재시도 로직 포함)
app.get('/api/player/:playerId', async (req, res) => {
    const { playerId } = req.params;
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[DEBUG] Attempt ${attempt}/${maxRetries} for player ${playerId}`);
            
            const playerData = await fetchPlayerDetailWithRetry(playerId, attempt);
            
            if (playerData && playerData.name && playerData.name !== '정보 없음') {
                res.json({ success: true, player: playerData });
                return;
            }
            
            if (attempt < maxRetries) {
                console.log(`[DEBUG] Player attempt ${attempt} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
        } catch (error) {
            console.error(`[DEBUG] Player attempt ${attempt} error:`, error.message);
            
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
    
    // 모든 재시도 실패 시 에러 반환
    console.log('[DEBUG] All player attempts failed, returning error');
    res.status(500).json({ 
        success: false, 
        error: '선수 상세 정보를 불러올 수 없습니다.',
        playerId: playerId
    });
});

async function fetchPlayerDetailWithRetry(playerId, attempt) {
    console.log(`[DEBUG] Attempt ${attempt} - Fetching player detail for ID:`, playerId);
    
    // 먼저 타자 페이지 시도
    let playerUrl = `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=${playerId}`;
    let response = await fetch(playerUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Player page request failed: ${response.status}`);
    }
    
    let html = await response.text();
    let playerData = parsePlayerDetail(html);
    
    // 타자 페이지에서 데이터를 찾지 못하면 투수 페이지 시도
    if (!playerData.name || playerData.name === '정보 없음') {
        console.log(`[DEBUG] Attempt ${attempt} - Not found in hitter page, trying pitcher page`);
        playerUrl = `https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId=${playerId}`;
        response = await fetch(playerUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Pitcher page request failed: ${response.status}`);
        }
        
        html = await response.text();
        playerData = parsePlayerDetail(html);
    }
    
    console.log(`[DEBUG] Attempt ${attempt} - Player data found:`, playerData.name ? 'Yes' : 'No');
    
    return playerData;
}

function parseAspNetAjaxResponse(ajaxResponse) {
    try {
        // ASP.NET AJAX 응답 형식: length|type|id|content|length|type|id|content|...
        console.log('[DEBUG] Parsing ASP.NET AJAX response...');
        
        const parts = ajaxResponse.split('|');
        let htmlContent = '';
        
        for (let i = 0; i < parts.length; i++) {
            // updatePanel 타입 찾기
            if (parts[i] === 'updatePanel' && i + 2 < parts.length) {
                const panelId = parts[i + 1];
                const content = parts[i + 2];
                console.log(`[DEBUG] Found updatePanel: ${panelId}`);
                
                // udpRecord 패널의 HTML 내용 추출
                if (panelId.includes('udpRecord')) {
                    htmlContent = content;
                    console.log('[DEBUG] Extracted HTML from udpRecord panel');
                    break;
                }
            }
        }
        
        // HTML 디코딩 (안전하게 처리)
        if (htmlContent) {
            try {
                htmlContent = decodeURIComponent(htmlContent);
                console.log('[DEBUG] HTML content decoded successfully');
            } catch (error) {
                console.log('[DEBUG] URI decoding failed, using raw content');
                // 디코딩 실패 시 원본 사용
            }
        }
        
        return htmlContent || ajaxResponse;
    } catch (error) {
        console.error('[DEBUG] Error parsing AJAX response:', error);
        return ajaxResponse;
    }
}

function parsePlayerList(html) {
    const $ = cheerio.load(html);
    const players = [];
    
    // HTML 구조 디버깅
    console.log('[DEBUG] Looking for table.tNData...');
    console.log('[DEBUG] table.tNData count:', $('table.tNData').length);
    
    // 실제 HTML 구조에 맞춰 파싱
    // 각 포지션별 테이블을 순회
    $('table.tNData').each((tableIndex, table) => {
        const $table = $(table);
        const positionHeader = $table.find('thead th:nth-child(2)').text().trim();
        
        console.log(`[DEBUG] Table ${tableIndex}: ${positionHeader}`);
        
        // 포지션 결정 (감독, 코치, 선수명 헤더 제외)
        let position = '';
        if (positionHeader === '투수') position = '투수';
        else if (positionHeader === '포수') position = '포수';
        else if (positionHeader === '내야수') position = '내야수';
        else if (positionHeader === '외야수') position = '외야수';
        else if (positionHeader === '선수명') {
            // 마지막 테이블의 경우 포지션이 별도 컬럼에 있음
            position = 'mixed';
        } else {
            console.log(`[DEBUG] Skipping table with header: ${positionHeader}`);
            return; // 감독, 코치는 스킵
        }
        
        // 각 선수 행 파싱
        $table.find('tbody tr').each((rowIndex, row) => {
            const $row = $(row);
            let $nameLink, playerPosition, backNo, throwHand, birthday, physique;
            
            if (position === 'mixed') {
                // 선수명이 헤더인 경우 (6컬럼 테이블)
                $nameLink = $row.find('td:nth-child(2) a');
                playerPosition = $row.find('td:nth-child(3)').text().trim();
                backNo = $row.find('td:nth-child(1)').text().trim();
                throwHand = $row.find('td:nth-child(4)').text().trim();
                birthday = $row.find('td:nth-child(5)').text().trim();
                physique = $row.find('td:nth-child(6)').text().trim();
                
                // 포지션에서 실제 포지션 부분만 추출 (괄호 앞부분)
                const actualPosition = playerPosition.split('(')[0].trim();
                
                // 선수만 포함 (감독, 코치 제외)
                const validPositions = ['투수', '포수', '내야수', '외야수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수', 'DH', '지명타자'];
                const isValidPlayer = actualPosition && validPositions.includes(actualPosition);
                
                if (!isValidPlayer || actualPosition === '') {
                    console.log(`[DEBUG] Skipping non-player: ${$nameLink.text().trim()} (${playerPosition})`);
                    return; // 선수가 아닌 경우 스킵
                }
            } else {
                // 일반적인 5컬럼 테이블
                $nameLink = $row.find('td:nth-child(2) a');
                playerPosition = position;
                backNo = $row.find('td:nth-child(1)').text().trim();
                throwHand = $row.find('td:nth-child(3)').text().trim();
                birthday = $row.find('td:nth-child(4)').text().trim();
                physique = $row.find('td:nth-child(5)').text().trim();
            }
            
            if ($nameLink.length > 0) {
                const href = $nameLink.attr('href');
                const playerIdMatch = href.match(/playerId=(\d+)/);
                
                if (playerIdMatch) {
                    const player = {
                        playerId: playerIdMatch[1],
                        name: $nameLink.text().trim(),
                        backNo: backNo,
                        position: playerPosition,
                        throwHand: throwHand,
                        birthday: birthday,
                        physique: physique
                    };
                    
                    console.log(`[DEBUG] Found player: ${player.name} (${player.position})`);
                    players.push(player);
                }
            }
        });
    });
    
    console.log(`[DEBUG] Total parsed ${players.length} players from HTML`);
    
    return players;
}

function parsePlayerDetail(html) {
    const $ = cheerio.load(html);
    
    console.log('[DEBUG] Parsing player detail...');
    
    // 실제 HTML 구조에 맞는 정확한 선택자 사용
    const playerData = {
        name: $('#cphContents_cphContents_cphContents_playerProfile_lblName').text().trim(),
        birthday: $('#cphContents_cphContents_cphContents_playerProfile_lblBirthday').text().trim(),
        draft: $('#cphContents_cphContents_cphContents_playerProfile_lblDraft').text().trim(),
        backNo: $('#cphContents_cphContents_cphContents_playerProfile_lblBackNo').text().trim(),
        position: $('#cphContents_cphContents_cphContents_playerProfile_lblPosition').text().trim(),
        career: $('#cphContents_cphContents_cphContents_playerProfile_lblCareer').text().trim(),
        image: $('#cphContents_cphContents_cphContents_playerProfile_imgProgile').attr('src') || ''
    };
    
    // 각 필드 로그
    console.log('[DEBUG] Player data extracted:');
    console.log(`  Name: ${playerData.name}`);
    console.log(`  Birthday: ${playerData.birthday}`);
    console.log(`  Draft: ${playerData.draft}`);
    console.log(`  Position: ${playerData.position}`);
    console.log(`  Career: ${playerData.career}`);
    console.log(`  BackNo: ${playerData.backNo}`);
    console.log(`  Image: ${playerData.image}`);
    
    // 기본값 설정
    Object.keys(playerData).forEach(key => {
        if (!playerData[key]) {
            playerData[key] = key === 'image' ? '' : '정보 없음';
        }
    });
    
    // 이미지 URL 정규화
    if (playerData.image && !playerData.image.startsWith('http')) {
        if (playerData.image.startsWith('//')) {
            playerData.image = 'https:' + playerData.image;
        } else if (playerData.image.startsWith('./')) {
            playerData.image = 'https://www.koreabaseball.com/' + playerData.image.substring(2);
        } else if (!playerData.image.startsWith('/')) {
            playerData.image = 'https://www.koreabaseball.com/' + playerData.image;
        } else {
            playerData.image = 'https://www.koreabaseball.com' + playerData.image;
        }
    }
    
    return playerData;
}

// 연도별 기본 팀 목록 반환 함수
function getDefaultTeamsForYear(year) {
    const yearNum = parseInt(year);
    
    // 기본 팀 목록 (2010년 이후) - 실제 동작하는 이미지 URL 사용
    let teams = [
        { code: 'HH', name: '한화', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_HH.png' },
        { code: 'LG', name: 'LG', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_LG.png' },
        { code: 'LT', name: '롯데', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_LT.png' },
        { code: 'HT', name: 'KIA', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_HT.png' },
        { code: 'SS', name: '삼성', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_SS.png' },
        { code: 'OB', name: '두산', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_OB.png' }
    ];
    
    // 2013년부터 NC 다이노스 추가
    if (yearNum >= 2013) {
        teams.push({ code: 'NC', name: 'NC', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_NC.png' });
    }
    
    // 2015년부터 KT 위즈 추가
    if (yearNum >= 2015) {
        teams.push({ code: 'KT', name: 'KT', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_KT.png' });
    }
    
    // 2019년까지 넥센/키움 히어로즈
    if (yearNum <= 2018) {
        teams.push({ code: 'WO', name: '넥센', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_WO.png' });
    } else {
        teams.push({ code: 'WO', name: '키움', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_WO.png' });
    }
    
    // SK 관련 변화
    if (yearNum <= 2020) {
        teams.push({ code: 'SK', name: 'SK', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_SK.png' });
    } else {
        teams.push({ code: 'SK', name: 'SSG', imageUrl: 'https://www.koreabaseball.com/images/emblem/regular/2024/emblem_SK.png' });
    }
    
    return teams;
}

function getRandomKboGameDate(year) {
    const start = new Date(`${year}-04-01`);
    const end = new Date(`${year}-08-31`);
    const dates = [];

    for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
        const d = new Date(time); // 새로운 Date 객체 생성
        const day = d.getDay();
        if (day !== 1) { // 월요일 제외
            const yyyyMMdd = d.toISOString().split('T')[0].replace(/-/g, '');
            dates.push(yyyyMMdd);
        }
    }

    const randomIndex = Math.floor(Math.random() * dates.length);
    return dates[randomIndex];
}


app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});

