# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This appears to be a KBO (Korean Baseball Organization) quiz application project. The repository is currently empty and ready for initial development.

## Development Setup

Since this is a new project, you'll need to initialize it with the appropriate technology stack based on the requirements. Common setups for quiz applications include:

- Web frontend (React, Vue, or vanilla JS)
- Backend API (Node.js, Python Flask/Django, etc.)
- Database for storing questions and results

## Project Structure

This repository is currently empty. When developing, establish a clear project structure based on the chosen technology stack.

## Notes for Development

- The project name suggests this will be a quiz application about Korean Baseball Organization
- Consider the target audience and platform (web, mobile, desktop)
- Plan for question storage, user sessions, and scoring functionality


# KBO 선수 맞추기 퀴즈 사이트 기획서

## 1. 기획 의도 및 목적

- KBO 리그를 좋아하는 팬들을 위한 재미 중심의 퀴즈 콘텐츠 제공
- 선수 정보 기반의 추리 게임을 통해 팬들과의 인터랙션 유도

---

## 2. 대상 사용자

- 야구를 좋아하는 10~30대 남녀
- 선수 이름, 팀, 포지션 등에 관심이 많은 야구 팬층

---

## 3. 크롤링 대상 및 방식

### 3.1 전체 개요

* 크롤링 시점: **퀴즈 시작 시점마다 실시간 요청**
* 별도 DB 저장 없이, **실시간 fetch + DOM 파싱 방식으로 구성**
* 데이터 출처: [KBO 공식 홈페이지](https://www.koreabaseball.com/)

---

### 3.2 구단 목록 동적 조회

#### 📍 대상 URL 및 DOM 경로
- URL: `https://www.koreabaseball.com/Player/Register.aspx`
- DOM 경로: `//*[@id="cphContents_cphContents_cphContents_udpRecord"]/div[1]/ul`
- 모든 `li` 요소를 조회하여 년도별 구단 목록을 동적으로 가져옴

#### 📍 구현 방식
- 년도 변경 시 해당 년도의 팀 목록을 실시간으로 조회
- 각 `li` 요소에서 팀 코드와 팀명을 추출
- 사용자는 해당 년도에 존재하는 팀만 선택 가능

---

### 3.3 1차 크롤링 – 선수 목록 수집

#### 📍 대상 URL

* [https://www.koreabaseball.com/Player/Register.aspx](https://www.koreabaseball.com/Player/Register.aspx)

#### 📍 목적

* 특정 날짜 기준으로 등록된 **구단 목록**과 **감독/코치 제외한 선수 목록** 수집
* 선수의 `playerId` 값을 획득하여 다음 단계로 활용

#### 📍 요청 예시 (JavaScript `fetch`)

```javascript
fetch("https://www.koreabaseball.com/Player/Register.aspx", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "x-requested-with": "XMLHttpRequest",
    // 생략: 기타 CORS 우회 및 기본 헤더 포함
  },
  body: "..."
});
```

> ※ POST 본문에는 날짜 및 구단 정보 포함 필요 (`hfSearchTeam`, `hfSearchDate`, `__VIEWSTATE`, `__EVENTVALIDATION` 등)

#### 📍 DOM 파싱 규칙

* 구단 목록:

  ```xpath
  //*[@id="cphContents_cphContents_cphContents_udpRecord"]/div[1]/ul/li
  ```
* 선수 정보 테이블 위치 (랜덤 선택 대상):

  ```xpath
  //div[3]/table[3-6]/tbody
  ```
* 각 선수의 상세 페이지 링크:

  ```xpath
  //tbody/tr[*]/td[2]/a → href 속성의 playerId 추출
  ```

---

### 3.3 2차 크롤링 – 선수 상세 정보 수집

#### 📍 대상 URL

* 타석 선수: `https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId={ID}`
* 투수 선수: `https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId={ID}`

#### 📍 파싱 항목 및 위치

| 항목     | DOM ID                                                                       |
| ------ | ---------------------------------------------------------------------------- |
| 선수 이름  | `cphContents_cphContents_cphContents_playerProfile_lblName`                  |
| 생년월일   | `cphContents_cphContents_cphContents_playerProfile_lblBirthday`              |
| 지명순위   | `cphContents_cphContents_cphContents_playerProfile_lblDraft`                 |
| 등번호    | `cphContents_cphContents_cphContents_playerProfile_lblBackNo`                |
| 포지션    | `cphContents_cphContents_cphContents_playerProfile_lblPosition`              |
| 경력     | `cphContents_cphContents_cphContents_playerProfile_lblCareer`                |
| 프로필 사진 | `cphContents_cphContents_cphContents_playerProfile_imgProgile` (`src` 속성 추출) |

---

### 3.4 예외 처리 및 참고 사항

* 선수 상세 페이지는 타자와 투수에 따라 URL이 다를 수 있음 (조건 분기 필요)
* 일부 선수는 정보가 비어있거나 페이지가 존재하지 않을 수 있음 → 예외 처리 필요
* CORS 문제 발생 시, 중계 서버 또는 Cloudflare Worker 프록시 활용 고려


### 3.1 1차 크롤링 (엔트리 목록)

- URL: `https://www.koreabaseball.com/Player/Register.aspx`
- 기능: 사용자가 특정 날짜와 구단을 선택하면 해당 일자 기준으로 엔트리에 등록된 선수들의 `playerId`를 수집
- 주의: 감독/코치는 제외하고 선수만 수집

### 3.2 2차 크롤링 (선수 상세 정보)

- URL 예시: `https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId={ID}`
- 수집 항목:
  - 선수명
  - 생년월일
  - 지명순위
  - 포지션
  - 경력
  - 등번호
  - 사진 URL

### 3.3 기타 사항

- 별도의 DB 구축 없이, **퀴즈 생성 시 실시간으로 크롤링하여 사용**

---

## 4. 퀴즈 흐름 및 규칙

### 4.1 흐름

1. 사용자는 년도와 구단을 선택
2. 해당 일자의 엔트리 중 랜덤으로 1명의 선수가 선정됨
3. “0000년 00월 00일 엔트리 기준 선정되었습니다” 문구와 함께 게임 시작
4. 총 6개의 정보가 순차적으로 공개되며, 각 단계마다 사용자는 선수명을 추측

### 4.2 힌트 공개 순서

1. 생년월일  
2. 지명 순위  
3. 포지션  
4. 경력  
5. 등번호  
6. 사진

### 4.3 점수

- 초기 점수: 6점
- 추측 실패 시 힌트 하나 공개 + 점수 1점 차감
- 정답을 맞힌 시점의 점수가 최종 점수

---

## 5. 기능 구성

- 로그인/회원가입 불필요
- 시작 시 이름(닉네임) 입력만으로 진행
- SNS 공유 기능 제공

### 공유 화면 예시

- park님은 2023년 4월 9일자 이정후 선수 문제를 4점으로 맞혔습니다!

- 공유 시: 선수 사진 + 이름 + 사용자 이름 + 점수 표시

---

## 6. 기술 스택 및 구성

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express (프록시 서버)
- **크롤링**: Cheerio + node-fetch
- **개발 도구**: concurrently, http-server
- CORS 문제 해결을 위한 프록시 서버 구성

### 6.1 실행 명령어

```bash
npm install          # 의존성 설치
npm run dev         # 개발 서버 실행 (프록시 + 웹서버)
npm start           # 프록시 서버만 실행
npm run serve       # 웹서버만 실행
```

### 6.2 구현된 개선사항

1. **구단 목록 동적 조회**: 년도 변경 시 해당 년도의 팀 목록을 실시간으로 가져옴
2. **선수 이미지 올바른 표시**: 이미지 URL 경로 처리 개선
3. **퀴즈 화면 개선**: 선택한 팀 정보를 명확히 표시
4. **첫 번째 힌트 자동 표시**: 퀴즈 시작 시 생년월일 힌트를 자동으로 보여줌 (점수 차감 없음)

---

## 7. 확장 고려 사항 (선택)

- 유명 선수 제외 필터 등 난이도 설정 기능
- 사용자 기록 저장 및 랭킹 기능 도입 (DB 필요 시)
- 다양한 퀴즈 유형 추가 (기록 기반 퀴즈 등)
- 힌트 순서 커스터마이징


