# 🔔 듀얼 알람앱

두 명이 함께 해제해야만 꺼지는 특별한 알람앱입니다!

## ✨ 주요 기능

- **듀얼 해제 시스템**: 두 명이 모두 알람을 해제해야만 알람이 꺼집니다
- **실시간 동기화**: WebSocket을 통한 실시간 사용자 상태 동기화
- **방 시스템**: 고유한 방 코드로 두 사용자를 연결
- **시각적 피드백**: 현재 시간, 카운트다운, 사용자 상태를 한눈에 확인
- **Web Audio API**: 브라우저 내장 기능으로 생성하는 알람음
- **반응형 디자인**: 모바일과 데스크톱 모두 지원

## 🚀 시작하기

### 필요 사항
- Node.js (v14 이상)
- npm 또는 yarn

### 설치 및 실행

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **서버 실행** (터미널 1)
   ```bash
   npm run server
   ```

3. **클라이언트 실행** (터미널 2)
   ```bash
   npm run dev
   ```

4. **접속**
   - 브라우저에서 `http://localhost:3000` 접속
   - 두 개의 브라우저 탭/창을 열어서 테스트

## 📱 사용 방법

### 1단계: 방 생성 및 참가
- 첫 번째 사용자가 이름을 입력하고 "생성" 버튼을 클릭하여 방 코드 생성
- 두 번째 사용자가 같은 방 코드를 입력하여 참가

### 2단계: 알람 설정
- 두 명이 모두 연결되면 알람 시간 설정 가능
- 원하는 시간을 선택하고 "알람 설정하기" 클릭
- 카운트다운이 시작됩니다

### 3단계: 알람 해제
- 설정된 시간에 알람이 울립니다
- **두 명 모두** "알람 해제하기" 버튼을 눌러야 알람이 꺼집니다
- 한 명만 해제하면 알람이 계속 울립니다!

## 🛠️ 기술 스택

- **Frontend**: React, Vite, CSS3
- **Backend**: Node.js, Express, Socket.IO
- **Audio**: Web Audio API
- **Real-time Communication**: WebSocket

## 📂 프로젝트 구조

```
dual-alarm-app/
├── src/
│   ├── App.jsx          # 메인 컴포넌트
│   ├── AlarmSound.js    # Web Audio API 알람음
│   ├── main.jsx         # 엔트리 포인트
│   └── index.css        # 스타일
├── public/
├── server.js            # WebSocket 서버
├── package.json
└── vite.config.js
```

## 🎯 사용 시나리오

### 커플 알람
- 아침에 함께 일어나기
- 중요한 약속 시간 알리기
- 함께 운동하기 전 알람

### 스터디 그룹
- 공부 시간 알리기
- 휴식 시간 종료 알림
- 과제 마감 알림

### 팀워크 필요한 상황
- 회의 시작 알림
- 프로젝트 마일스톤 알림
- 협업 작업 시작 알림

## 🔧 커스터마이징

### 알람음 변경
`src/AlarmSound.js` 파일에서 주파수와 패턴을 수정할 수 있습니다:

```javascript
// 주파수 변경 (현재: 440Hz, 880Hz)
this.oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5

// 비프 패턴 변경 (현재: 0.5초 온/오프)
gain.gain.setValueAtTime(0.1, time);
time += 0.3; // 더 짧게
```

### 스타일 변경
`src/index.css` 파일에서 색상과 애니메이션을 수정할 수 있습니다.

## 🐛 문제 해결

### 오디오가 재생되지 않는 경우
1. 브라우저에서 오디오 자동재생이 차단되었을 수 있습니다
2. 사용자 상호작용 후에 오디오가 재생됩니다
3. 브라우저 설정에서 오디오 권한을 확인하세요

### 연결이 안 되는 경우
1. 서버가 포트 3001에서 실행 중인지 확인
2. 방화벽 설정 확인
3. 브라우저 콘솔에서 에러 메시지 확인

## 📝 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

만든이: AI Assistant
버전: 1.0.0