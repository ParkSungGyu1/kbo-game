# KBO 선수 맞추기 퀴즈

KBO 리그 선수들의 정보를 바탕으로 한 추리 퀴즈 게임입니다.

## 기능

- **실시간 크롤링**: KBO 공식 홈페이지에서 실시간으로 선수 데이터를 가져옵니다
- **힌트 시스템**: 6단계 힌트 (생년월일 → 지명순위 → 포지션 → 경력 → 등번호 → 사진)
- **점수 시스템**: 초기 6점에서 힌트 사용 시마다 1점씩 차감
- **SNS 공유**: 게임 결과를 간편하게 공유할 수 있습니다

## 설치 및 실행

1. 의존성 설치:
```bash
npm install
```

2. 개발 서버 실행:
```bash
npm run dev
```

3. 브라우저에서 `http://localhost:3000` 접속

## 기술 스택

- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js, Express
- **크롤링**: Cheerio, node-fetch
- **기타**: CORS 처리용 프록시 서버

## 게임 규칙

1. 닉네임과 연도, 구단을 선택하여 게임 시작
2. 총 6개의 힌트가 순차적으로 공개됩니다
3. 각 단계에서 선수 이름을 추측하여 입력
4. 정답을 맞힌 시점의 점수가 최종 점수입니다

## 개발 참고사항

- 실제 KBO 데이터 크롤링이 실패할 경우 더미 데이터를 사용합니다
- CORS 문제 해결을 위해 프록시 서버를 운영합니다
- 크롤링 대상: https://www.koreabaseball.com/