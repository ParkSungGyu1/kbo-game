const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// KBO 구단 목록 조회 엔드포인트
app.get('/api/teams/:year', async (req, res) => {
    try {
        const { year } = req.params;
        
        // 날짜는 7월 1일로 고정
        const date = `${year}0701`;
        const url = 'https://www.koreabaseball.com/Player/Register.aspx';
        
        // 1단계: 초기 페이지 접속하여 팀 목록 추출
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const teams = [];
        
        // HTML 분석 결과에 따라 실제 셀렉터 사용 - 로고 이미지 포함
        $('#cphContents_cphContents_cphContents_udpRecord .teams ul li').each((i, el) => {
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
                    } else if (imgSrc.startsWith('./')) {
                        fullImageUrl = 'https://www.koreabaseball.com/' + imgSrc.substring(2);
                    } else if (imgSrc.startsWith('/')) {
                        fullImageUrl = 'https://www.koreabaseball.com' + imgSrc;
                    } else {
                        fullImageUrl = 'https://www.koreabaseball.com/' + imgSrc;
                    }
                }
                
                teams.push({
                    name: teamName || dataId,
                    code: dataId,
                    imageUrl: fullImageUrl || `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_${dataId}.png`
                });
            }
        });
        
        console.log(`[DEBUG] Found ${teams.length} teams from initial page`);
        
        // 팀을 찾지 못한 경우 기본 팀 목록 제공
        if (teams.length === 0) {
            console.log('[DEBUG] No teams found from HTML, using default teams');
            const defaultTeams = [
                { code: 'HH', name: '한화' },
                { code: 'LG', name: 'LG' },
                { code: 'LT', name: '롯데' },
                { code: 'HT', name: 'KIA' },
                { code: 'KT', name: 'KT' },
                { code: 'SK', name: 'SSG' },
                { code: 'NC', name: 'NC' },
                { code: 'SS', name: '삼성' },
                { code: 'OB', name: '두산' },
                { code: 'WO', name: '키움' }
            ];
            
            defaultTeams.forEach(team => {
                teams.push({
                    ...team,
                    imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_${team.code}.png`
                });
            });
        }
        
        res.json({ success: true, teams });
    } catch (error) {
        console.error('[팀 목록 조회 실패]', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// KBO 선수 목록 크롤링 엔드포인트 (개선된 재시도 로직)
app.post('/api/players', async (req, res) => {
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

async function fetchPlayersWithRetry(requestBody, attempt) {
    const { year, team, date } = requestBody;
    
    console.log(`[DEBUG] Fetching players for:`, { year, team, date, attempt });
    
    const registerUrl = 'https://www.koreabaseball.com/Player/Register.aspx';
    
    // 매 시도마다 새로운 세션으로 ViewState 추출
    const initialResponse = await fetch(registerUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache'
        }
    });
    
    if (!initialResponse.ok) {
        throw new Error(`Initial page load failed: ${initialResponse.status}`);
    }
    
    const initialHtml = await initialResponse.text();
    const $ = cheerio.load(initialHtml);
    
    // ASP.NET ViewState 값들 추출
    const viewState = $('input[name="__VIEWSTATE"]').val();
    const viewStateGenerator = $('input[name="__VIEWSTATEGENERATOR"]').val();
    const eventValidation = $('input[name="__EVENTVALIDATION"]').val();
    
    console.log(`[DEBUG] Attempt ${attempt} - ViewState length:`, viewState?.length);
    console.log(`[DEBUG] Attempt ${attempt} - EventValidation length:`, eventValidation?.length);
    
    if (!viewState || !eventValidation) {
        throw new Error('Failed to extract ViewState or EventValidation');
    }
    
    // 날짜 형식 변환: 2024-09-17 -> 20240917
    const formattedDate = date.replace(/-/g, '');
    
    // 날짜 유효성 검증
    if (!isValidKboDate(formattedDate, year)) {
        console.log(`[DEBUG] Invalid date for KBO season: ${formattedDate}`);
        return { success: false, error: 'Invalid date for KBO season' };
    }
    
    // curl에서 추출한 정확한 POST 요청 구성
    const formData = new URLSearchParams({
        'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$ScriptManager1': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$udpRecord|ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
        'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchTeam': team,
        'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$hfSearchDate': formattedDate,
        '__EVENTTARGET': 'ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$btnCalendarSelect',
        '__EVENTARGUMENT': '',
        '__VIEWSTATE': viewState,
        '__VIEWSTATEGENERATOR': viewStateGenerator,
        '__EVENTVALIDATION': eventValidation,
        '__ASYNCPOST': 'true'
    });

    console.log(`[DEBUG] Attempt ${attempt} - POST with team:`, team, 'date:', formattedDate);

    const response = await fetch(registerUrl, {
        method: 'POST',
        headers: {
            'Accept': '*/*',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Origin': 'https://www.koreabaseball.com',
            'Referer': 'https://www.koreabaseball.com/Player/Register.aspx',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'X-MicrosoftAjax': 'Delta=true',
            'X-Requested-With': 'XMLHttpRequest',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"'
        },
        body: formData.toString()
    });
    
    if (!response.ok) {
        throw new Error(`POST request failed: ${response.status}`);
    }
    
    const html = await response.text();
    
    // HTML 응답 디버깅
    console.log(`[DEBUG] Attempt ${attempt} - Response status:`, response.status);
    console.log(`[DEBUG] Attempt ${attempt} - HTML length:`, html.length);
    console.log(`[DEBUG] Attempt ${attempt} - HTML preview:`, html.substring(0, 300));
    
    // 에러 응답 체크 (빠른 실패)
    if (html.includes('pageRedirect') || html.includes('Error') || html.length < 1000) {
        // 첫 2번의 시도에서는 빠르게 실패하고 재시도
        if (attempt <= 2) {
            throw new Error('KBO site returned error/short response - quick retry');
        } else {
            throw new Error('KBO site returned error response');
        }
    }
    
    // ASP.NET AJAX 응답 파싱
    let actualHtml = html;
    if (html.includes('|') && (html.includes('updatePanel') || html.includes('udpRecord'))) {
        console.log(`[DEBUG] Attempt ${attempt} - Detected AJAX response, parsing...`);
        actualHtml = parseAspNetAjaxResponse(html);
        console.log(`[DEBUG] Attempt ${attempt} - Parsed HTML length:`, actualHtml.length);
    }
    
    const players = parsePlayerList(actualHtml);
    
    console.log(`[DEBUG] Attempt ${attempt} - Found ${players.length} players for team ${team}`);
    
    // 결과 반환 (성공 여부와 관계없이 파싱된 데이터 포함)
    const isSuccess = players.length >= 5;
    
    return { 
        success: isSuccess, 
        players: players,
        error: isSuccess ? null : `Only found ${players.length} players, expected more`
    };
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

