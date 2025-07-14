class KBOQuizGame {
    constructor() {
        this.currentPlayer = null;
        this.currentScore = 6;
        this.hintsShown = 0;
        this.gameData = {
            playerName: '',
            year: '',
            team: '',
            date: ''
        };
        
        this.hintOrder = [
            { key: 'birthday', label: '생년월일' },
            { key: 'draft', label: '지명순위' },
            { key: 'position', label: '포지션' },
            { key: 'career', label: '경력' },
            { key: 'backNo', label: '등번호' },
            { key: 'image', label: '사진' }
        ];
        
        this.init();
    }
    
    init() {
        this.detectEnvironment();
        this.bindEvents();
        this.loadTeams();
        this.setOgUrl();
    }
    
    detectEnvironment() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isKakaoTalk = userAgent.includes('kakaotalk');
        const isInApp = userAgent.includes('inapp') || isKakaoTalk;
        
        if (isKakaoTalk) {
            console.log('[DEBUG] 카카오톡 인앱 브라우저 감지됨');
            
            // 카카오톡 인앱 브라우저용 설정
            document.body.classList.add('kakaotalk-inapp');
            
            // 외부 브라우저 열기 버튼 추가
            this.addExternalBrowserButton();
        }
        
        if (isInApp) {
            // 인앱 브라우저 공통 설정
            document.body.classList.add('inapp-browser');
        }
    }
    
    addExternalBrowserButton() {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'external-browser-container';
        buttonContainer.innerHTML = `
            <div class="external-browser-banner">
                <p>⚠️ 카카오톡에서 일부 기능이 제한될 수 있습니다</p>
                <div class="browser-buttons">
                    <button class="external-btn safari-btn" onclick="window.open('x-web-search://?${encodeURIComponent(window.location.href)}')">
                        Safari로 열기
                    </button>
                    <button class="external-btn chrome-btn" onclick="window.open('googlechrome://${window.location.href.replace('https://', '')}')">
                        Chrome으로 열기
                    </button>
                    <button class="external-btn copy-btn" onclick="navigator.clipboard ? navigator.clipboard.writeText(window.location.href).then(() => alert('링크가 복사되었습니다!')) : alert('링크: ' + window.location.href)">
                        링크 복사
                    </button>
                </div>
                <button class="close-banner" onclick="this.parentElement.parentElement.style.display='none'">
                    ×
                </button>
            </div>
        `;
        
        buttonContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 9999;
            background: linear-gradient(135deg, #ffeb3b, #ffc107);
            border-bottom: 2px solid #ff9800;
            font-family: inherit;
        `;
        
        document.body.insertBefore(buttonContainer, document.body.firstChild);
        
        // 메인 컨테이너에 상단 마진 추가
        const container = document.querySelector('.container');
        if (container) {
            container.style.marginTop = '120px';
        }
    }
    
    setOgUrl() {
        // OG URL을 현재 페이지 URL로 설정
        const ogUrlMeta = document.querySelector('meta[property="og:url"]');
        if (ogUrlMeta) {
            ogUrlMeta.setAttribute('content', window.location.href);
        }
    }
    
    bindEvents() {
        document.getElementById('go-to-setup').addEventListener('click', this.goToSetup.bind(this));
        document.getElementById('player-name').addEventListener('input', this.validateForm.bind(this));
        document.getElementById('game-year').addEventListener('change', this.loadTeamsForYear.bind(this));
        document.getElementById('start-game').addEventListener('click', this.startGame.bind(this));
        document.getElementById('submit-answer').addEventListener('click', this.submitAnswer.bind(this));
        document.getElementById('get-hint').addEventListener('click', this.showNextHint.bind(this));
        document.getElementById('answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAnswer();
        });
        document.getElementById('play-again').addEventListener('click', this.resetGame.bind(this));
        document.getElementById('share-result').addEventListener('click', this.shareResult.bind(this));
    }
    
    goToSetup() {
        this.showScreen('setup-screen');
    }
    
    validateForm() {
        const playerName = document.getElementById('player-name').value.trim();
        const team = document.getElementById('game-team').value;
        const startButton = document.getElementById('start-game');
        
        startButton.disabled = !(playerName && team);
    }
    
    async loadTeams() {
        const year = document.getElementById('game-year').value;
        await this.loadTeamsForYear();
    }
    
    async loadTeamsForYear() {
        const year = document.getElementById('game-year').value;
        const teamLogosContainer = document.getElementById('team-logos-container');
        
        // 기존 로고들 제거
        teamLogosContainer.innerHTML = '';
        
        try {
            // 카카오톡 인앱 브라우저 호환성 처리
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                credentials: 'same-origin'
            };
            
            const response = await fetch(`/api/teams/${year}`, fetchOptions);
            const data = await response.json();
            
            if (data.success && data.teams.length > 0) {
                this.renderTeamLogos(data.teams);
            } else {
                throw new Error('팀 목록을 불러올 수 없습니다');
            }
        } catch (error) {
            console.warn('실제 팀 목록 로딩 실패, 기본 팀 목록 사용:', error);
            
            // 실패 시 기본 팀 목록 사용
            const defaultTeams = [
                { code: 'HH', name: '한화', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_HH.png` },
                { code: 'LG', name: 'LG', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_LG.png` },
                { code: 'LT', name: '롯데', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_LT.png` },
                { code: 'HT', name: 'KIA', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_HT.png` },
                { code: 'KT', name: 'KT', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_KT.png` },
                { code: 'SK', name: 'SSG', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_SK.png` },
                { code: 'NC', name: 'NC', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_NC.png` },
                { code: 'SS', name: '삼성', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_SS.png` },
                { code: 'OB', name: '두산', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_OB.png` },
                { code: 'WO', name: '키움', imageUrl: `https://www.koreabaseball.com/images/emblem/regular/${year}/emblem_WO.png` }
            ];
            
            this.renderTeamLogos(defaultTeams);
        }
        
        // 팀 목록 변경 후 폼 검증
        this.validateForm();
    }
    
    renderTeamLogos(teams) {
        const teamLogosContainer = document.getElementById('team-logos-container');
        
        if (!teamLogosContainer) {
            console.error('team-logos-container not found!');
            return;
        }
        
        teams.forEach((team) => {
            const logoDiv = document.createElement('div');
            logoDiv.className = 'team-logo';
            logoDiv.dataset.teamCode = team.code;
            logoDiv.dataset.teamName = team.name;
            
            const img = document.createElement('img');
            img.src = team.imageUrl;
            img.alt = team.name;
            img.onerror = () => {
                // 이미지 로드 실패 시 텍스트만 표시
                img.style.display = 'none';
                logoDiv.style.padding = '10px';
                logoDiv.style.border = '2px solid #ddd';
                logoDiv.style.borderRadius = '8px';
                logoDiv.style.backgroundColor = '#f5f5f5';
            };
            
            const span = document.createElement('span');
            span.textContent = team.name;
            
            logoDiv.appendChild(img);
            logoDiv.appendChild(span);
            
            // 클릭 이벤트 추가
            logoDiv.addEventListener('click', () => {
                this.selectTeam(team.code, team.name, logoDiv);
            });
            
            teamLogosContainer.appendChild(logoDiv);
        });
    }
    
    selectTeam(teamCode, teamName, logoElement) {
        // 이전 선택 제거
        document.querySelectorAll('.team-logo').forEach(logo => {
            logo.classList.remove('selected');
        });
        
        // 새 선택 표시
        logoElement.classList.add('selected');
        
        // hidden input에 값 설정
        document.getElementById('game-team').value = teamCode;
        
        // 폼 검증
        this.validateForm();
    }
    
    async startGame() {
        this.gameData.playerName = document.getElementById('player-name').value.trim();
        this.gameData.year = document.getElementById('game-year').value;
        this.gameData.team = document.getElementById('game-team').value;
        this.gameData.date = this.generateRandomDate(this.gameData.year);
        
        this.showScreen('game-screen');
        this.showLoading(true);
        
        try {
            await this.loadPlayerData();
            this.startQuiz();
        } catch (error) {
            console.error('[ERROR] 선수 데이터 로딩 최종 실패:', error);
            alert(error.message);
            // 페이지 새로고침
            window.location.reload();
        }
    }
    
    generateRandomDate(year) {
        const start = new Date(year, 3, 1); // 4월 1일
        const end = new Date(year, 7, 31);   // 8월 31일
        const dates = [];

        for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
            const d = new Date(time);
            const day = d.getDay();
            if (day !== 1) { // 월요일 제외
                const yyyyMMdd = d.toISOString().split('T')[0]; // yyyy-MM-dd 형식
                dates.push(yyyyMMdd);
            }
        }

        const randomIndex = Math.floor(Math.random() * dates.length);
        return dates[randomIndex];
    }
    
    async loadPlayerData() {
        const maxRetries = 10;
        let attempt = 1;
        
        while (attempt <= maxRetries) {
            try {
                console.log(`[DEBUG] 선수 데이터 로딩 시도 ${attempt}/${maxRetries}, 날짜: ${this.gameData.date}`);
                
                // 로딩 메시지 업데이트
                this.updateLoadingMessage(`선수 정보를 찾는 중... (${attempt}/${maxRetries})`, 
                    `${this.gameData.date} 경기 데이터 확인 중`);
                
                // 실제 KBO 데이터 크롤링 시도 (카카오톡 인앱 브라우저 호환성 처리)
                const playersResponse = await fetch('/api/players', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        year: this.gameData.year,
                        team: this.gameData.team,
                        date: this.gameData.date // yyyy-MM-dd 형식
                    })
                });
                
                const playersData = await playersResponse.json();
                
                if (playersData.success && playersData.players.length > 0) {
                    this.updateLoadingMessage('선수 상세 정보 조회 중...', '잠시만 기다려주세요');
                    
                    // 랜덤 선수 선택
                    const randomPlayer = playersData.players[Math.floor(Math.random() * playersData.players.length)];
                    
                    // 선수 상세 정보 가져오기 (카카오톡 인앱 브라우저 호환성 처리)
                    const playerResponse = await fetch(`/api/player/${randomPlayer.playerId}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        credentials: 'same-origin'
                    });
                    const playerData = await playerResponse.json();
                    
                    if (playerData.success && playerData.player.name && playerData.player.name !== '정보 없음') {
                        console.log(`[DEBUG] 성공적으로 선수 데이터 로딩: ${playerData.player.name}`);
                        this.currentPlayer = this.formatPlayerData(playerData.player);
                        return;
                    }
                }
                
                console.warn(`[DEBUG] 시도 ${attempt} 실패: 선수 데이터 없음 또는 불완전`);
                
            } catch (error) {
                console.warn(`[DEBUG] 시도 ${attempt} 에러:`, error);
            }
            
            // 재시도 전 새로운 랜덤 날짜 생성
            if (attempt < maxRetries) {
                this.gameData.date = this.generateRandomDate(this.gameData.year);
                console.log(`[DEBUG] 새로운 날짜로 재시도: ${this.gameData.date}`);
                attempt++;
                
                // 잠시 대기 (서버 부하 방지)
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                break;
            }
        }
        
        // 10번 모두 실패 시 에러 처리
        console.error('[DEBUG] 모든 재시도 실패');
        throw new Error('일시적인 에러입니다. 다시 요청해주세요.');
    }
    
    updateLoadingMessage(main, detail) {
        const loadingMessage = document.getElementById('loading-message');
        const loadingDetail = document.getElementById('loading-detail');
        
        if (loadingMessage) loadingMessage.textContent = main;
        if (loadingDetail) loadingDetail.textContent = detail;
    }
    
    
    formatPlayerData(rawData) {
        let imageUrl = 'https://via.placeholder.com/200x250?text=사진없음';
        
        if (rawData.image) {
            // 이미지 URL이 절대 경로인지 확인
            if (rawData.image.startsWith('http')) {
                imageUrl = rawData.image;
            } else if (rawData.image.startsWith('/')) {
                imageUrl = `https://www.koreabaseball.com${rawData.image}`;
            } else {
                imageUrl = `https://www.koreabaseball.com/${rawData.image}`;
            }
        }
        
        return {
            name: rawData.name,
            birthday: rawData.birthday,
            draft: rawData.draft || '정보 없음',
            position: rawData.position,
            career: rawData.career || '정보 없음',
            backNo: rawData.backNo,
            image: imageUrl
        };
    }
    
    startQuiz() {
        this.showLoading(false);
        this.currentScore = 6;
        this.hintsShown = 0;
        
        document.getElementById('current-score').textContent = this.currentScore;
        
        // 선택한 팀 정보와 날짜 표시
        const selectedTeamElement = document.querySelector(`.team-logo[data-team-code="${this.gameData.team}"]`);
        const selectedTeamName = selectedTeamElement ? selectedTeamElement.dataset.teamName : this.gameData.team;
        
        document.getElementById('game-date').innerHTML = 
            `<strong>${selectedTeamName}</strong><br>${this.gameData.date} 엔트리 기준으로 선정되었습니다`;
        
        document.getElementById('hints-container').innerHTML = '';
        document.getElementById('answer-input').value = '';
        
        // 첫 번째 힌트(생년월일) 자동 표시
        this.showNextHint();
        
        document.getElementById('answer-input').focus();
    }
    
    showNextHint() {
        if (this.hintsShown >= this.hintOrder.length) return;
        
        const hint = this.hintOrder[this.hintsShown];
        const hintElement = this.createHintElement(hint);
        document.getElementById('hints-container').appendChild(hintElement);
        
        this.hintsShown++;
        
        // 첫 번째 힌트(생년월일)가 아닌 경우에만 점수 차감
        if (this.hintsShown > 1) {
            this.currentScore = Math.max(1, this.currentScore - 1);
            document.getElementById('current-score').textContent = this.currentScore;
        }
        
        if (this.hintsShown >= this.hintOrder.length) {
            document.getElementById('get-hint').style.display = 'none';
        }
    }
    
    createHintElement(hint) {
        const hintDiv = document.createElement('div');
        hintDiv.className = 'hint-item';
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'hint-label';
        labelDiv.textContent = hint.label;
        
        const valueDiv = document.createElement('div');
        valueDiv.className = 'hint-value';
        
        if (hint.key === 'image') {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'hint-image';
            const img = document.createElement('img');
            img.src = this.currentPlayer.image;
            img.alt = '선수 사진';
            imageDiv.appendChild(img);
            valueDiv.appendChild(imageDiv);
        } else {
            valueDiv.textContent = this.currentPlayer[hint.key];
        }
        
        hintDiv.appendChild(labelDiv);
        hintDiv.appendChild(valueDiv);
        
        return hintDiv;
    }
    
    submitAnswer() {
        const userAnswer = document.getElementById('answer-input').value.trim();
        if (!userAnswer) return;
        
        const isCorrect = userAnswer === this.currentPlayer.name;
        
        if (isCorrect) {
            this.showResult(true);
        } else {
            if (this.hintsShown >= this.hintOrder.length) {
                this.showResult(false);
            } else {
                alert('틀렸습니다! 힌트를 확인해보세요.');
                this.showNextHint();
                document.getElementById('answer-input').value = '';
            }
        }
    }
    
    showResult(isCorrect) {
        this.showScreen('result-screen');
        
        const resultTitle = document.getElementById('result-title');
        const resultPlayerName = document.getElementById('result-player-name');
        const resultPlayerImage = document.getElementById('result-player-image');
        const resultScore = document.getElementById('result-score');
        
        resultPlayerName.textContent = this.currentPlayer.name;
        resultPlayerImage.src = this.currentPlayer.image;
        
        if (isCorrect) {
            resultTitle.textContent = '정답입니다!';
            resultScore.textContent = `${this.gameData.playerName}님은 ${this.currentScore}점으로 맞혔습니다!`;
        } else {
            resultTitle.textContent = '아쉽습니다!';
            resultScore.textContent = `정답은 ${this.currentPlayer.name}이었습니다.`;
        }
    }
    
    shareResult() {
        const shareText = `⚾️ KBO 선수 맞추기 퀴즈 결과\n\n${this.gameData.playerName}님은 ${this.gameData.date}자 ${this.currentPlayer.name} 선수 문제를 ${this.currentScore}점으로 맞혔습니다!\n\n당신도 야잘알인지 도전해보세요!\n${window.location.href}`;
        
        // 페이지 URL을 클립보드에 복사
        const shareUrl = window.location.href;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                // 성공적으로 복사된 경우 공유 텍스트도 함께 제공
                const fullShareText = shareText;
                
                // 추가로 공유 텍스트도 복사할지 묻기
                if (confirm('링크가 복사되었습니다!\n\n결과와 함께 메시지도 복사하시겠습니까?')) {
                    navigator.clipboard.writeText(fullShareText).then(() => {
                        alert('공유 메시지가 복사되었습니다!\n\n카카오톡, 문자 등에 붙여넣기 하세요 📱');
                    }).catch(() => {
                        alert('링크가 복사되었습니다!\n\n친구에게 공유해보세요 🔗');
                    });
                } else {
                    alert('링크가 복사되었습니다!\n\n친구에게 공유해보세요 🔗');
                }
            }).catch(() => {
                // 클립보드 복사 실패 시 Web Share API 시도
                this.fallbackShare(shareText, shareUrl);
            });
        } else {
            // 클립보드 API가 없는 경우
            this.fallbackShare(shareText, shareUrl);
        }
    }
    
    fallbackShare(shareText, shareUrl) {
        if (navigator.share) {
            navigator.share({
                title: '⚾️ KBO 선수 맞추기 퀴즈!',
                text: shareText,
                url: shareUrl
            }).catch(() => {
                // Web Share API도 실패한 경우 수동 복사 안내
                this.showShareModal(shareText);
            });
        } else {
            // 모든 자동 복사 방법이 실패한 경우
            this.showShareModal(shareText);
        }
    }
    
    showShareModal(shareText) {
        // 간단한 모달로 텍스트 선택 가능하게 표시
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 1000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white; padding: 20px; border-radius: 10px;
            max-width: 400px; width: 90%; text-align: center;
        `;
        
        content.innerHTML = `
            <h3>친구에게 공유하기 📱</h3>
            <p style="margin: 15px 0;">아래 텍스트를 복사해서 친구에게 보내주세요!</p>
            <textarea readonly style="width: 100%; height: 120px; margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">${shareText}</textarea>
            <button onclick="this.parentElement.parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">닫기</button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // 텍스트 영역 자동 선택
        const textarea = content.querySelector('textarea');
        textarea.focus();
        textarea.select();
    }
    
    resetGame() {
        this.showScreen('intro-screen');
        this.currentPlayer = null;
        this.currentScore = 6;
        this.hintsShown = 0;
        document.getElementById('answer-input').value = '';
        document.getElementById('get-hint').style.display = 'inline-block';
        
        // 입력 필드들 초기화
        document.getElementById('player-name').value = '';
        document.getElementById('game-team').value = '';
        document.querySelectorAll('.team-logo').forEach(logo => {
            logo.classList.remove('selected');
        });
        this.validateForm();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        document.querySelector('.game-info').style.display = show ? 'none' : 'flex';
        document.querySelector('.hints-container').style.display = show ? 'none' : 'block';
        document.querySelector('.answer-section').style.display = show ? 'none' : 'flex';
    }
}

// 게임 시작
document.addEventListener('DOMContentLoaded', () => {
    new KBOQuizGame();
});