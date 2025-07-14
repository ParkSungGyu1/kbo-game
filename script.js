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
        
        // 연속 도전 모드 관련 데이터
        this.challengeMode = {
            isActive: false,
            players: [],
            currentIndex: 0,
            totalScore: 0,
            difficulty: 'normal',
            timeLimit: 60,
            timer: null,
            remainingTime: 60,
            startTime: null,
            results: []
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
                    <button class="external-btn safari-btn" onclick="window.openInSafari()">
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
        
        // Safari 열기 함수를 전역으로 추가
        window.openInSafari = function() {
            const currentUrl = window.location.href;
            
            // iOS 감지
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            
            if (isIOS) {
                // iOS에서 여러 방법 시도
                try {
                    // 1. Safari URL 스킴 시도 (iOS 13+에서 제한됨)
                    const safariUrl = `x-safari-${currentUrl}`;
                    const safariWindow = window.open(safariUrl, '_blank');
                    
                    // 즉시 스킴이 작동하지 않을 수 있으므로 fallback 제공
                    setTimeout(() => {
                        if (!safariWindow || safariWindow.closed) {
                            // Safari 스킴이 작동하지 않은 경우 클립보드 복사로 fallback
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(currentUrl).then(() => {
                                    alert('📱 Safari에서 열기:\n\n1. 링크가 복사되었습니다\n2. 홈 화면으로 이동하세요\n3. Safari 앱을 터치하세요\n4. 주소창을 터치하고 붙여넣기(길게 누르기) 하세요');
                                }).catch(() => {
                                    this.showSafariInstructions(currentUrl);
                                });
                            } else {
                                this.showSafariInstructions(currentUrl);
                            }
                        }
                    }, 1000);
                    
                } catch (error) {
                    // 에러 발생 시 클립보드 복사로 fallback
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(currentUrl).then(() => {
                            alert('📱 Safari에서 열기:\n\n1. 링크가 복사되었습니다\n2. 홈 화면으로 이동하세요\n3. Safari 앱을 터치하세요\n4. 주소창을 터치하고 붙여넣기(길게 누르기) 하세요');
                        }).catch(() => {
                            this.showSafariInstructions(currentUrl);
                        });
                    } else {
                        this.showSafariInstructions(currentUrl);
                    }
                }
            } else {
                // Android나 기타 환경
                // 기본 브라우저로 열기 시도
                const opened = window.open(currentUrl, '_blank');
                if (!opened || opened.closed) {
                    // 팝업 차단된 경우
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(currentUrl).then(() => {
                            alert('🌐 브라우저에서 열기:\n\n1. 링크가 복사되었습니다\n2. 브라우저를 열고 주소창에 붙여넣기 하세요');
                        });
                    } else {
                        alert(`🌐 아래 링크를 복사해서 브라우저에서 열어주세요:\n\n${currentUrl}`);
                    }
                }
            }
        };
        
        // Safari 안내 모달 표시 함수
        window.showSafariInstructions = function(url) {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); display: flex; align-items: center;
                justify-content: center; z-index: 10000; font-family: inherit;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white; padding: 25px; border-radius: 15px;
                max-width: 350px; width: 90%; text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            `;
            
            content.innerHTML = `
                <h3 style="color: #007aff; margin-bottom: 20px; font-size: 18px;">📱 Safari에서 열기</h3>
                <div style="text-align: left; line-height: 1.6; margin-bottom: 20px;">
                    <p style="margin: 10px 0; font-weight: bold; color: #333;">방법 1: 링크 복사</p>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">아래 링크를 길게 눌러 복사 → Safari에서 붙여넣기</p>
                    <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; margin: 10px 0; word-break: break-all; font-size: 12px; border: 1px solid #ddd;">
                        ${url}
                    </div>
                    <p style="margin: 10px 0; font-weight: bold; color: #333;">방법 2: 직접 이동</p>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">1. 홈 화면으로 이동</p>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">2. Safari 앱 실행</p>
                    <p style="margin: 5px 0; font-size: 14px; color: #666;">3. 주소창에 링크 붙여넣기</p>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="navigator.clipboard && navigator.clipboard.writeText('${url}').then(() => alert('링크가 복사되었습니다!')); this.parentElement.parentElement.parentElement.remove();" 
                            style="background: #007aff; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;">
                        링크 복사
                    </button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove();" 
                            style="background: #666; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px;">
                        닫기
                    </button>
                </div>
            `;
            
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // 모달 외부 클릭 시 닫기
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        };
        
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
        // 모드 선택 이벤트
        document.getElementById('mode-normal').addEventListener('click', this.selectNormalMode.bind(this));
        document.getElementById('mode-challenge').addEventListener('click', this.selectChallengeMode.bind(this));
        
        // 일반 모드 이벤트
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
        
        // 연속 도전 모드 이벤트
        document.getElementById('challenge-player-name').addEventListener('input', this.validateChallengeForm.bind(this));
        document.getElementById('challenge-year').addEventListener('change', this.loadChallengeTeamsForYear.bind(this));
        document.getElementById('start-challenge').addEventListener('click', this.startChallengeGame.bind(this));
        document.getElementById('challenge-submit-answer').addEventListener('click', this.submitChallengeAnswer.bind(this));
        document.getElementById('challenge-get-hint').addEventListener('click', this.showChallengeNextHint.bind(this));
        document.getElementById('challenge-answer-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitChallengeAnswer();
        });
        document.getElementById('challenge-play-again').addEventListener('click', this.resetChallengeGame.bind(this));
        document.getElementById('challenge-share-result').addEventListener('click', this.shareChallengeResult.bind(this));
        
        // 난이도 선택 이벤트
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', this.selectDifficulty.bind(this));
        });
    }
    
    // 모드 선택 메소드
    selectNormalMode() {
        this.challengeMode.isActive = false;
        this.showScreen('setup-screen');
    }
    
    selectChallengeMode() {
        this.challengeMode.isActive = true;
        
        // 기본 설정으로 바로 시작
        this.gameData.playerName = '연속 도전자';
        this.gameData.year = '2024';
        this.gameData.team = 'HH'; // 한화 이글스 기본값
        this.challengeMode.difficulty = 'normal';
        
        // 난이도별 설정
        const difficultySettings = {
            easy: { timeLimit: 90, maxHints: 6 },
            normal: { timeLimit: 60, maxHints: 3 },
            hard: { timeLimit: 30, maxHints: 1 }
        };
        
        this.challengeMode.timeLimit = difficultySettings[this.challengeMode.difficulty].timeLimit;
        this.challengeMode.maxHints = difficultySettings[this.challengeMode.difficulty].maxHints;
        
        // 바로 게임 시작
        this.startChallengeGame();
    }
    
    // 난이도 선택 메소드
    selectDifficulty(e) {
        const selectedBtn = e.target.closest('.difficulty-btn');
        const difficulty = selectedBtn.dataset.difficulty;
        
        // 이전 선택 제거
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 새 선택 표시
        selectedBtn.classList.add('selected');
        
        // 난이도 설정
        this.challengeMode.difficulty = difficulty;
        document.getElementById('challenge-difficulty').value = difficulty;
        
        // 제한 시간 설정
        switch (difficulty) {
            case 'easy':
                this.challengeMode.timeLimit = 90;
                break;
            case 'normal':
                this.challengeMode.timeLimit = 60;
                break;
            case 'hard':
                this.challengeMode.timeLimit = 30;
                break;
        }
        
        this.validateChallengeForm();
    }
    
    // 연속 도전 모드 폼 검증
    validateChallengeForm() {
        const playerName = document.getElementById('challenge-player-name').value.trim();
        const team = document.getElementById('challenge-team').value;
        const difficulty = document.getElementById('challenge-difficulty').value;
        const startButton = document.getElementById('start-challenge');
        
        startButton.disabled = !(playerName && team && difficulty);
    }
    
    // 연속 도전 모드 팀 로딩
    async loadChallengeTeamsForYear() {
        const year = document.getElementById('challenge-year').value;
        const teamLogosContainer = document.getElementById('challenge-team-logos-container');
        
        // 기존 로고들 제거
        teamLogosContainer.innerHTML = '';
        
        try {
            const fetchOptions = {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            };
            
            const response = await fetch(`http://localhost:3001/api/teams/${year}`, fetchOptions);
            const data = await response.json();
            
            if (data.success && data.teams.length > 0) {
                this.renderChallengeTeamLogos(data.teams);
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
            
            this.renderChallengeTeamLogos(defaultTeams);
        }
        
        // 팀 목록 변경 후 폼 검증
        this.validateChallengeForm();
    }
    
    renderChallengeTeamLogos(teams) {
        const teamLogosContainer = document.getElementById('challenge-team-logos-container');
        
        teams.forEach((team) => {
            const logoDiv = document.createElement('div');
            logoDiv.className = 'team-logo';
            logoDiv.dataset.teamCode = team.code;
            logoDiv.dataset.teamName = team.name;
            
            const img = document.createElement('img');
            img.src = team.imageUrl;
            img.alt = team.name;
            img.onerror = () => {
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
                this.selectChallengeTeam(team.code, team.name, logoDiv);
            });
            
            teamLogosContainer.appendChild(logoDiv);
        });
    }
    
    selectChallengeTeam(teamCode, teamName, logoElement) {
        // 이전 선택 제거
        document.querySelectorAll('#challenge-team-logos-container .team-logo').forEach(logo => {
            logo.classList.remove('selected');
        });
        
        // 새 선택 표시
        logoElement.classList.add('selected');
        
        // hidden input에 값 설정
        document.getElementById('challenge-team').value = teamCode;
        
        // 폼 검증
        this.validateChallengeForm();
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
                    'Cache-Control': 'no-cache'
                }
            };
            
            const response = await fetch(`http://localhost:3001/api/teams/${year}`, fetchOptions);
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
    
    // 연속 도전 모드 게임 시작
    async startChallengeGame() {
        // 연속 도전 모드 초기화
        this.challengeMode.isActive = true;
        this.challengeMode.players = [];
        this.challengeMode.currentIndex = 0;
        this.challengeMode.totalScore = 0;
        this.challengeMode.results = [];
        this.challengeMode.startTime = Date.now();
        
        try {
            // 5명의 선수 데이터를 미리 로드
            await this.loadChallengePlayersData();
            this.startChallengeRound();
        } catch (error) {
            console.error('연속 도전 모드 시작 실패:', error);
            alert(error.message);
            this.showScreen('intro-screen');
        }
    }
    
    // 연속 도전 모드 5명 선수 데이터 로드
    async loadChallengePlayersData() {
        // 화면 전환 후 로딩 표시
        this.showScreen('challenge-game-screen');
        this.showChallengeLoading(true, '🚀 연속 도전 모드 준비 중...', '5명의 선수 정보를 준비하고 있습니다.', 0);
        
        const players = [];
        const maxAttempts = 10; // 최대 시도 횟수
        let attempts = 0;
        
        while (players.length < 5 && attempts < maxAttempts) {
            attempts++;
            
            try {
                const randomDate = this.generateRandomDate(this.gameData.year);
                this.gameData.date = randomDate;
                
                const progress = (players.length / 5) * 100;
                this.updateChallengeLoadingMessage(`🔍 선수 데이터 로딩 중... (${players.length}/5)`, 
                    `${randomDate} 경기 선수 정보를 가져오고 있습니다.`, progress);
                
                // 선수 목록 가져오기 (연속 도전 모드용)
                const playersData = await this.loadChallengePlayersList();
                
                if (playersData && playersData.length > 0) {
                    // 최대 3명까지 선택 (중복 방지)
                    const shuffled = [...playersData].sort(() => Math.random() - 0.5);
                    const selectedFromThisDate = shuffled.slice(0, Math.min(3, 5 - players.length));
                    
                    for (const player of selectedFromThisDate) {
                        if (players.length >= 5) break;
                        
                        // 중복 제거
                        if (!players.find(p => p.playerId === player.playerId)) {
                            players.push({
                                ...player,
                                gameDate: randomDate
                            });
                        }
                    }
                }
                
                // 5명을 찾았으면 루프 종료
                if (players.length >= 5) {
                    break;
                }
                
                // 짧은 대기 시간
                await new Promise(resolve => setTimeout(resolve, 300));
                
            } catch (error) {
                console.error(`선수 데이터 로딩 실패 (시도 ${attempts}):`, error);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (players.length < 5) {
            throw new Error(`충분한 선수 데이터를 로드할 수 없습니다. (${players.length}/5)`);
        }
        
        this.challengeMode.players = players.slice(0, 5); // 정확히 5명만 선택
        console.log('연속 도전 모드 선수 데이터 로드 완료:', this.challengeMode.players.length, '명');
    }
    
    // 연속 도전 모드용 선수 목록 로드
    async loadChallengePlayersList() {
        const playersResponse = await fetch('http://localhost:3001/api/players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                year: this.gameData.year,
                team: this.gameData.team,
                date: this.gameData.date
            })
        });
        
        if (!playersResponse.ok) {
            throw new Error('선수 목록을 불러올 수 없습니다');
        }
        
        const playersData = await playersResponse.json();
        
        if (!playersData.success || !playersData.players || playersData.players.length === 0) {
            throw new Error('선수 데이터가 없습니다');
        }
        
        return playersData.players;
    }
    
    // 연속 도전 라운드 시작
    async startChallengeRound() {
        const currentPlayer = this.challengeMode.players[this.challengeMode.currentIndex];
        
        if (!currentPlayer) {
            this.showChallengeResult();
            return;
        }
        
        // 화면 전환
        this.showScreen('challenge-game-screen');
        this.showChallengeLoading(true, '🎯 선수 정보를 불러오는 중...', `선택하신 팀의 선수 상세 정보를 가져오고 있습니다.`, 50);
        
        try {
            // 선수 상세 정보 가져오기
            const playerDetailResponse = await fetch(`http://localhost:3001/api/player/${currentPlayer.playerId}`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!playerDetailResponse.ok) {
                throw new Error('선수 상세 정보를 불러올 수 없습니다');
            }
            
            const playerDetailData = await playerDetailResponse.json();
            
            if (!playerDetailData.success) {
                throw new Error('선수 상세 정보를 불러올 수 없습니다');
            }
            
            // 상세 정보로 현재 선수 업데이트 (gameDate 유지)
            const formattedPlayer = this.formatPlayerData(playerDetailData.player);
            this.currentPlayer = {
                ...formattedPlayer,
                gameDate: currentPlayer.gameDate // 원래 gameDate 유지
            };
            this.currentScore = 6;
            this.hintsShown = 0;
            this.challengeMode.remainingTime = this.challengeMode.timeLimit;
            
            // 로딩 완료 표시
            this.updateChallengeLoadingMessage('✅ 완료!', '게임을 시작합니다.', 100);
            
            // 잠시 후 로딩 화면 숨기기
            setTimeout(() => {
                this.showChallengeLoading(false);
            }, 500);
            
            // UI 업데이트
            this.updateChallengeUI();
            
            // 타이머 시작
            this.startChallengeTimer();
            
            // 첫 번째 힌트 표시
            this.showChallengeHint();
            
        } catch (error) {
            console.error('선수 상세 정보 로딩 실패:', error);
            this.showChallengeLoading(false);
            alert('선수 정보를 불러오는데 실패했습니다. 다시 시도해주세요.');
            this.resetChallengeGame();
        }
    }
    
    // 연속 도전 모드 UI 업데이트
    updateChallengeUI() {
        const currentIndex = this.challengeMode.currentIndex + 1;
        const progress = (currentIndex / 5) * 100;
        
        document.getElementById('challenge-current').textContent = currentIndex;
        document.getElementById('challenge-progress-fill').style.width = `${progress}%`;
        document.getElementById('challenge-total-score').textContent = this.challengeMode.totalScore;
        document.getElementById('challenge-timer').textContent = this.challengeMode.remainingTime;
        document.getElementById('challenge-current-score').textContent = this.currentScore;
        
        // 팀과 날짜 정보 표시
        const selectedTeamElement = document.querySelector(`.team-logo[data-team-code="${this.gameData.team}"]`);
        const selectedTeamName = selectedTeamElement ? selectedTeamElement.dataset.teamName : this.gameData.team;
        document.getElementById('challenge-team-date').textContent = 
            `${selectedTeamName} | ${this.currentPlayer.gameDate}` +' 엔트리 기준으로 선정';
    }
    
    // 연속 도전 모드 타이머 시작
    startChallengeTimer() {
        if (this.challengeMode.timer) {
            clearInterval(this.challengeMode.timer);
        }
        
        this.challengeMode.timer = setInterval(() => {
            this.challengeMode.remainingTime--;
            document.getElementById('challenge-timer').textContent = this.challengeMode.remainingTime;
            
            if (this.challengeMode.remainingTime <= 0) {
                clearInterval(this.challengeMode.timer);
                this.challengeTimeUp();
            }
        }, 1000);
    }
    
    // 연속 도전 모드 시간 초과
    challengeTimeUp() {
        alert('시간이 초과되었습니다! 게임이 종료됩니다.');
        this.finishChallengeGame(false);
    }
    
    // 연속 도전 모드 힌트 표시
    showChallengeHint() {
        const hintsContainer = document.getElementById('challenge-hints-container');
        hintsContainer.innerHTML = '';
        
        // 난이도별 힌트 제한
        const availableHints = this.challengeMode.difficulty === 'easy' ? 
            this.hintOrder : 
            this.getRandomHints(this.challengeMode.maxHints);
        
        // 현재까지 표시할 힌트 개수 (최소 1개)
        const hintsToShow = Math.min(this.hintsShown + 1, availableHints.length);
        
        for (let i = 0; i < hintsToShow; i++) {
            const hint = availableHints[i];
            const hintElement = this.createHintElement(hint);
            hintsContainer.appendChild(hintElement);
        }
        
        this.hintsShown = hintsToShow;
        
        // 힌트 버튼 상태 업데이트
        const getHintButton = document.getElementById('challenge-get-hint');
        if (this.hintsShown >= availableHints.length) {
            getHintButton.style.display = 'none';
        } else {
            getHintButton.style.display = 'inline-block';
        }
    }
    
    // 랜덤 힌트 선택
    getRandomHints(count) {
        const hints = [...this.hintOrder];
        const selected = [];
        
        // 생년월일은 항상 포함
        selected.push(hints[0]);
        hints.splice(0, 1);
        
        // 나머지 힌트 랜덤 선택
        for (let i = 1; i < count && hints.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * hints.length);
            selected.push(hints[randomIndex]);
            hints.splice(randomIndex, 1);
        }
        
        return selected;
    }
    
    // 연속 도전 모드 답안 제출
    submitChallengeAnswer() {
        const userAnswer = document.getElementById('challenge-answer-input').value.trim();
        if (!userAnswer) return;
        
        const isCorrect = userAnswer === this.currentPlayer.name;
        
        if (isCorrect) {
            this.challengeCorrectAnswer();
        } else {
            // 틀렸을 때 일반 모드처럼 힌트 보기
            const availableHints = this.challengeMode.difficulty === 'easy' ? 
                this.hintOrder : 
                this.getRandomHints(this.challengeMode.maxHints);
            
            if (this.hintsShown >= availableHints.length) {
                // 모든 힌트를 다 봤으면 연속 도전 실패
                this.challengeWrongAnswer();
            } else {
                // 아직 힌트가 남아있으면 다음 힌트 보기
                alert('틀렸습니다! 힌트를 확인해보세요.');
                this.showChallengeNextHint();
                document.getElementById('challenge-answer-input').value = '';
            }
        }
    }
    
    // 연속 도전 모드 정답 처리
    async challengeCorrectAnswer() {
        clearInterval(this.challengeMode.timer);
        
        // 시간 보너스 계산
        const timeBonus = Math.max(0, this.challengeMode.remainingTime);
        const finalScore = this.currentScore + timeBonus;
        
        this.challengeMode.totalScore += finalScore;
        
        // 결과 저장
        this.challengeMode.results.push({
            playerName: this.currentPlayer.name,
            score: finalScore,
            timeUsed: this.challengeMode.timeLimit - this.challengeMode.remainingTime,
            hintsUsed: this.hintsShown,
            success: true
        });
        
        // 다음 선수로 이동
        this.challengeMode.currentIndex++;
        
        if (this.challengeMode.currentIndex >= 5) {
            // 모든 선수 완료
            this.finishChallengeGame(true);
        } else {
            // 다음 선수 진행
            setTimeout(async () => {
                await this.startChallengeRound();
            }, 1000);
        }
    }
    
    // 연속 도전 모드 오답 처리 (모든 힌트 다 본 경우)
    challengeWrongAnswer() {
        alert(`모든 힌트를 다 보셨습니다!\n정답은 ${this.currentPlayer.name}이었습니다.\n연속 도전이 종료됩니다.`);
        this.finishChallengeGame(false);
    }
    
    // 연속 도전 모드 다음 힌트 표시
    showChallengeNextHint() {
        const availableHints = this.challengeMode.difficulty === 'easy' ? 
            this.hintOrder : 
            this.getRandomHints(this.challengeMode.maxHints);
        
        if (this.hintsShown < availableHints.length) {
            this.currentScore = Math.max(1, this.currentScore - 1);
            document.getElementById('challenge-current-score').textContent = this.currentScore;
            this.showChallengeHint();
        }
    }
    
    // 연속 도전 모드 게임 종료
    finishChallengeGame(completed) {
        clearInterval(this.challengeMode.timer);
        
        if (!completed) {
            // 실패한 선수 결과 추가
            this.challengeMode.results.push({
                playerName: this.currentPlayer.name,
                score: 0,
                timeUsed: this.challengeMode.timeLimit - this.challengeMode.remainingTime,
                hintsUsed: this.hintsShown,
                success: false
            });
        }
        
        this.showChallengeResult();
    }
    
    // 연속 도전 모드 결과 표시
    showChallengeResult() {
        this.showScreen('challenge-result-screen');
        
        const completedPlayers = this.challengeMode.results.filter(r => r.success).length;
        const totalTime = Math.floor((Date.now() - this.challengeMode.startTime) / 1000);
        
        // 결과 타이틀
        const resultTitle = document.getElementById('challenge-result-title');
        if (completedPlayers === 5) {
            resultTitle.textContent = '🎉 완주 성공!';
        } else {
            resultTitle.textContent = `😢 ${completedPlayers}/5 완료`;
        }
        
        // 통계 업데이트
        document.getElementById('challenge-final-score').textContent = this.challengeMode.totalScore;
        document.getElementById('challenge-completed').textContent = completedPlayers;
        document.getElementById('challenge-total-time').textContent = this.formatTime(totalTime);
        
        // 상세 결과 표시
        this.showChallengeBreakdown();
    }
    
    // 연속 도전 모드 상세 결과 표시
    showChallengeBreakdown() {
        const breakdownContainer = document.getElementById('challenge-breakdown');
        breakdownContainer.innerHTML = '';
        
        this.challengeMode.results.forEach((result, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'breakdown-item';
            
            itemDiv.innerHTML = `
                <div class="breakdown-player">${index + 1}. ${result.playerName}</div>
                <div class="breakdown-score">${result.success ? result.score + '점' : '실패'}</div>
                <div class="breakdown-time">${this.formatTime(result.timeUsed)}</div>
            `;
            
            breakdownContainer.appendChild(itemDiv);
        });
    }
    
    // 시간 포맷팅
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    // 연속 도전 모드 게임 리셋
    resetChallengeGame() {
        if (this.challengeMode.timer) {
            clearInterval(this.challengeMode.timer);
        }
        
        this.challengeMode.isActive = false;
        this.challengeMode.players = [];
        this.challengeMode.currentIndex = 0;
        this.challengeMode.totalScore = 0;
        this.challengeMode.results = [];
        
        document.getElementById('challenge-answer-input').value = '';
        
        // 입력 필드들 초기화
        document.getElementById('challenge-player-name').value = '';
        document.getElementById('challenge-team').value = '';
        document.querySelectorAll('.team-logo').forEach(logo => {
            logo.classList.remove('selected');
        });
        
        this.showScreen('intro-screen');
    }
    
    // 연속 도전 모드 결과 공유
    shareChallengeResult() {
        const completedPlayers = this.challengeMode.results.filter(r => r.success).length;
        const totalTime = Math.floor((Date.now() - this.challengeMode.startTime) / 1000);
        
        const shareText = `🔥 KBO 연속 도전 모드 결과\n\n${this.gameData.playerName}님이 ${completedPlayers}/5명 완료!\n총 점수: ${this.challengeMode.totalScore}점\n소요 시간: ${this.formatTime(totalTime)}\n\n당신도 연속 도전해보세요!\n${window.location.href}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText).then(() => {
                alert('결과가 복사되었습니다!\n\n친구에게 공유해보세요 🔥');
            }).catch(() => {
                this.showShareModal(shareText);
            });
        } else {
            this.showShareModal(shareText);
        }
    }
    
    // 연속 도전 모드 로딩 표시
    showChallengeLoading(show, message = '', detail = '') {
        const loading = document.getElementById('challenge-loading');
        const messageElement = document.getElementById('challenge-loading-message');
        const detailElement = document.getElementById('challenge-loading-detail');
        
        loading.style.display = show ? 'block' : 'none';
        
        if (messageElement) messageElement.textContent = message;
        if (detailElement) detailElement.textContent = detail;
        
        // 게임 요소들 숨기기/표시
        document.querySelector('.challenge-header').style.display = show ? 'none' : 'block';
        document.querySelector('.challenge-player-info').style.display = show ? 'none' : 'flex';
        document.getElementById('challenge-hints-container').style.display = show ? 'none' : 'block';
        document.querySelector('#challenge-game-screen .answer-section').style.display = show ? 'none' : 'flex';
    }
    
    // 연속 도전 모드 로딩 메시지 업데이트
    updateChallengeLoadingMessage(main, detail, progress = 0) {
        const loadingMessage = document.getElementById('challenge-loading-message');
        const loadingDetail = document.getElementById('challenge-loading-detail');
        const progressBar = document.getElementById('challenge-loading-progress-bar');
        
        if (loadingMessage) loadingMessage.textContent = main;
        if (loadingDetail) loadingDetail.textContent = detail;
        if (progressBar) progressBar.style.width = `${progress}%`;
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
                const playersResponse = await fetch('http://localhost:3001/api/players', {
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
                    const playerResponse = await fetch(`http://localhost:3001/api/player/${randomPlayer.playerId}`, {
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