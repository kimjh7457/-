import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import AlarmSound from './AlarmSound';

function App() {
  const [socket, setSocket] = useState(null);
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [alarmTime, setAlarmTime] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAlarmSet, setIsAlarmSet] = useState(false);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);
  const [partnerDismissed, setPartnerDismissed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const audioRef = useRef(null);
  const alarmSoundRef = useRef(new AlarmSound());
  const [userId] = useState(uuidv4());

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 알람 체크
  useEffect(() => {
    if (isAlarmSet && alarmTime) {
      const now = new Date();
      const [hours, minutes] = alarmTime.split(':');
      const alarmDate = new Date();
      alarmDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      // 만약 설정 시간이 이미 지났다면 다음 날로 설정
      if (alarmDate <= now) {
        alarmDate.setDate(alarmDate.getDate() + 1);
      }
      
      const timeDiff = alarmDate.getTime() - now.getTime();
      setCountdown(Math.floor(timeDiff / 1000));
      
      if (timeDiff <= 0 && !isAlarmRinging) {
        triggerAlarm();
      }
    }
  }, [currentTime, alarmTime, isAlarmSet]);

  // 카운트다운 업데이트
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const connectToRoom = () => {
    if (!userName.trim() || !roomCode.trim()) {
      alert('이름과 방 코드를 입력해주세요!');
      return;
    }

    const newSocket = io('http://localhost:3001');
    
    newSocket.emit('join-room', { roomCode, userName, userId });
    
    newSocket.on('user-joined', (users) => {
      setConnectedUsers(users);
      setIsConnected(true);
    });

    newSocket.on('user-left', (users) => {
      setConnectedUsers(users);
    });

    newSocket.on('alarm-triggered', () => {
      setIsAlarmRinging(true);
      playAlarmSound();
    });

    newSocket.on('user-dismissed', ({ userId: dismissedUserId, users }) => {
      if (dismissedUserId === userId) {
        setUserDismissed(true);
      } else {
        setPartnerDismissed(true);
      }
      setConnectedUsers(users);
    });

    newSocket.on('alarm-stopped', () => {
      stopAlarm();
    });

    newSocket.on('alarm-reset', () => {
      resetAlarm();
    });

    setSocket(newSocket);
  };

  const setAlarm = () => {
    if (!alarmTime) {
      alert('알람 시간을 설정해주세요!');
      return;
    }
    
    if (connectedUsers.length < 2) {
      alert('두 명이 연결되어야 알람을 설정할 수 있습니다!');
      return;
    }

    setIsAlarmSet(true);
    socket.emit('set-alarm', { roomCode, alarmTime });
  };

  const triggerAlarm = () => {
    setIsAlarmRinging(true);
    socket.emit('trigger-alarm', { roomCode });
    playAlarmSound();
  };

  const dismissAlarm = () => {
    if (!userDismissed) {
      setUserDismissed(true);
      socket.emit('dismiss-alarm', { roomCode, userId, userName });
      
      if (partnerDismissed) {
        socket.emit('stop-alarm', { roomCode });
      }
    }
  };

  const playAlarmSound = async () => {
    try {
      await alarmSoundRef.current.play();
    } catch (error) {
      console.error('알람음 재생 실패:', error);
      // 폴백으로 기본 오디오 사용
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
    }
  };

  const stopAlarm = () => {
    setIsAlarmRinging(false);
    setUserDismissed(false);
    setPartnerDismissed(false);
    
    // Web Audio API 알람음 정지
    alarmSoundRef.current.stop();
    
    // 폴백 오디오도 정지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const resetAlarm = () => {
    setIsAlarmSet(false);
    setAlarmTime('');
    setCountdown(0);
    stopAlarm();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCountdown = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const generateRoomCode = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
  };

  return (
    <div className="container">
      <h1 style={{ textAlign: 'center', marginBottom: '30px', fontSize: '2.5rem' }}>
        🔔 듀얼 알람앱
      </h1>

      {!isConnected ? (
        <div className="alarm-card">
          <h2>방 참가하기</h2>
          <div className="input-group">
            <label>이름</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>
          <div className="input-group">
            <label>방 코드</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="방 코드를 입력하세요"
                style={{ flex: 1 }}
              />
              <button className="btn" onClick={generateRoomCode}>
                생성
              </button>
            </div>
          </div>
          <button className="btn btn-success" onClick={connectToRoom}>
            방 참가하기
          </button>
        </div>
      ) : (
        <>
          <div className="alarm-card">
            <div className="time-display">
              {formatTime(currentTime)}
            </div>
            
            <div className="user-list">
              {connectedUsers.map((user) => (
                <div key={user.userId} className="user-card">
                  <div>
                    <span className={`status-indicator ${user.connected ? 'status-online' : 'status-offline'}`}></span>
                    {user.userName}
                    {user.userId === userId && ' (나)'}
                  </div>
                  {isAlarmRinging && (
                    <div style={{ marginTop: '10px' }}>
                      {user.dismissed ? '✅ 해제함' : '⏰ 대기중'}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {connectedUsers.length < 2 && (
              <p style={{ textAlign: 'center', color: '#FFD700' }}>
                파트너가 연결되기를 기다리는 중... (방 코드: {roomCode})
              </p>
            )}
          </div>

          {connectedUsers.length >= 2 && !isAlarmRinging && (
            <div className="alarm-card">
              <h3>알람 설정</h3>
              <div className="input-group">
                <label>알람 시간</label>
                <input
                  type="time"
                  value={alarmTime}
                  onChange={(e) => setAlarmTime(e.target.value)}
                  disabled={isAlarmSet}
                />
              </div>
              
              {!isAlarmSet ? (
                <button className="btn btn-success" onClick={setAlarm}>
                  알람 설정하기
                </button>
              ) : (
                <div>
                  <p>알람이 설정되었습니다: {alarmTime}</p>
                  {countdown > 0 && (
                    <div className="countdown">
                      남은 시간: {formatCountdown(countdown)}
                    </div>
                  )}
                  <button className="btn btn-danger" onClick={() => socket.emit('reset-alarm', { roomCode })}>
                    알람 취소
                  </button>
                </div>
              )}
            </div>
          )}

          {isAlarmRinging && (
            <div className={`alarm-card alarm-ringing`}>
              <h2>🚨 알람이 울리고 있습니다! 🚨</h2>
              <p>두 명 모두 해제해야 알람이 꺼집니다</p>
              <button 
                className={`btn ${userDismissed ? 'btn-success' : 'btn-danger'}`}
                onClick={dismissAlarm}
                disabled={userDismissed}
              >
                {userDismissed ? '✅ 해제됨' : '알람 해제하기'}
              </button>
              <p style={{ marginTop: '15px' }}>
                {userDismissed && partnerDismissed ? '두 명 모두 해제했습니다!' 
                : userDismissed ? '파트너의 해제를 기다리는 중...' 
                : partnerDismissed ? '당신의 해제를 기다리는 중...' 
                : '두 명 모두 해제해주세요'}
              </p>
            </div>
          )}
        </>
      )}

      <audio ref={audioRef} loop>
        <source src="/alarm.mp3" type="audio/mpeg" />
        <source src="/alarm.wav" type="audio/wav" />
        {/* 기본 알람음이 없을 경우를 위한 처리 */}
      </audio>
    </div>
  );
}

export default App;