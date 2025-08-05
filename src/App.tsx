import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlarmClock, Play, Pause, X, Check, Volume2 } from 'lucide-react';

interface Alarm {
  id: string;
  time: string;
  isActive: boolean;
  isRinging: boolean;
}

const App: React.FC = () => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [newAlarmTime, setNewAlarmTime] = useState<string>('');
  const [isAlarmRinging, setIsAlarmRinging] = useState<boolean>(false);
  const [showDismissModal, setShowDismissModal] = useState<boolean>(false);
  const [dismissCount, setDismissCount] = useState<number>(0);
  const [requiredDismisses, setRequiredDismisses] = useState<number>(3);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 현재 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      setCurrentTime(timeString);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 알람 체크
  useEffect(() => {
    const checkAlarms = () => {
      const now = new Date();
      const currentTimeString = now.toLocaleTimeString('ko-KR', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      alarms.forEach(alarm => {
        if (alarm.isActive && alarm.time === currentTimeString && !alarm.isRinging) {
          triggerAlarm(alarm.id);
        }
      });
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [alarms]);

  // 알람 소리 재생
  const triggerAlarm = (alarmId: string) => {
    setAlarms(prev => prev.map(alarm => 
      alarm.id === alarmId ? { ...alarm, isRinging: true } : alarm
    ));
    setIsAlarmRinging(true);
    setShowDismissModal(true);
    setDismissCount(0);
    setRequiredDismisses(Math.floor(Math.random() * 3) + 2); // 2-4번 랜덤

    // 알람 소리 재생
    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.play().catch(console.error);
    }
  };

  // 알람 추가
  const addAlarm = () => {
    if (!newAlarmTime) return;

    const newAlarm: Alarm = {
      id: Date.now().toString(),
      time: newAlarmTime,
      isActive: true,
      isRinging: false
    };

    setAlarms(prev => [...prev, newAlarm]);
    setNewAlarmTime('');
  };

  // 알람 삭제
  const deleteAlarm = (id: string) => {
    setAlarms(prev => prev.filter(alarm => alarm.id !== id));
  };

  // 알람 활성화/비활성화
  const toggleAlarm = (id: string) => {
    setAlarms(prev => prev.map(alarm => 
      alarm.id === id ? { ...alarm, isActive: !alarm.isActive } : alarm
    ));
  };

  // 알람 해제 시도
  const tryDismissAlarm = () => {
    setDismissCount(prev => prev + 1);
    
    if (dismissCount + 1 >= requiredDismisses) {
      dismissAlarm();
    }
  };

  // 알람 완전 해제
  const dismissAlarm = () => {
    setAlarms(prev => prev.map(alarm => ({ ...alarm, isRinging: false })));
    setIsAlarmRinging(false);
    setShowDismissModal(false);
    setDismissCount(0);

    // 알람 소리 중지
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // 알람 소리 생성 (Web Audio API 사용)
  const createAlarmSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.5);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 1);

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);

    return audioContext;
  };

  return (
    <div className={`container ${isAlarmRinging ? 'alarm-ringing' : ''}`}>
      <h1 className="title">⏰ 알람 앱</h1>
      <p className="subtitle">함께 해제해야 꺼지는 재미있는 알람</p>
      
      <div className="time-display">
        {currentTime}
      </div>

      {/* 알람 추가 */}
      <div className="alarm-controls">
        <input
          type="time"
          className="time-input"
          value={newAlarmTime}
          onChange={(e) => setNewAlarmTime(e.target.value)}
          placeholder="알람 시간"
        />
        <button className="btn btn-primary" onClick={addAlarm}>
          <AlarmClock size={20} />
          알람 추가
        </button>
      </div>

      {/* 알람 목록 */}
      <div className="alarm-list">
        {alarms.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            설정된 알람이 없습니다
          </p>
        ) : (
          alarms.map(alarm => (
            <div key={alarm.id} className="alarm-item">
              <div>
                <div className="alarm-time">{alarm.time}</div>
                <div className="alarm-status">
                  {alarm.isActive ? '활성' : '비활성'} 
                  {alarm.isRinging && ' 🔔 울리는 중!'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className={`btn ${alarm.isActive ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => toggleAlarm(alarm.id)}
                >
                  {alarm.isActive ? <Pause size={16} /> : <Play size={16} />}
                  {alarm.isActive ? '중지' : '시작'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => deleteAlarm(alarm.id)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 알람 해제 모달 */}
      {showDismissModal && (
        <div className="dismiss-overlay">
          <div className="dismiss-modal">
            <h2 className="dismiss-title">🔔 알람이 울립니다!</h2>
            <p className="dismiss-message">
              알람을 해제하려면 <strong>{requiredDismisses}번</strong> 클릭해야 합니다!<br />
              현재: {dismissCount} / {requiredDismisses}
            </p>
            <div className="dismiss-buttons">
              <button
                className="btn btn-success"
                onClick={tryDismissAlarm}
              >
                <Check size={20} />
                해제 시도 ({dismissCount}/{requiredDismisses})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 알람 소리 */}
      <audio
        ref={audioRef}
        className="alarm-sound"
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT"
      />
    </div>
  );
};

export default App;