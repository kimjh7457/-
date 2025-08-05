class AlarmSound {
  constructor() {
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
    this.isPlaying = false;
  }

  async initialize() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      return true;
    } catch (error) {
      console.error('오디오 컨텍스트 초기화 실패:', error);
      return false;
    }
  }

  async play() {
    if (this.isPlaying) return;

    try {
      if (!this.audioContext) {
        const initialized = await this.initialize();
        if (!initialized) return;
      }

      // 오디오 컨텍스트가 일시정지 상태일 수 있으므로 재개
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.createAlarmSound();
      this.isPlaying = true;
    } catch (error) {
      console.error('알람음 재생 실패:', error);
    }
  }

  createAlarmSound() {
    // 메인 오실레이터 (440Hz - A4)
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    // 보조 오실레이터 (880Hz - A5)
    const oscillator2 = this.audioContext.createOscillator();
    const gainNode2 = this.audioContext.createGain();

    // 파형 설정
    this.oscillator.type = 'square';
    oscillator2.type = 'sine';

    // 주파수 설정
    this.oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
    oscillator2.frequency.setValueAtTime(880, this.audioContext.currentTime);

    // 볼륨 설정
    this.gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode2.gain.setValueAtTime(0.05, this.audioContext.currentTime);

    // 연결
    this.oscillator.connect(this.gainNode);
    oscillator2.connect(gainNode2);
    this.gainNode.connect(this.audioContext.destination);
    gainNode2.connect(this.audioContext.destination);

    // 시작
    this.oscillator.start();
    oscillator2.start();

    // 비프음 패턴 생성 (0.5초 온, 0.5초 오프)
    this.createBeepPattern();

    // 보조 오실레이터도 같은 패턴으로 설정
    this.createBeepPattern(oscillator2, gainNode2);
  }

  createBeepPattern(osc = this.oscillator, gain = this.gainNode) {
    const currentTime = this.audioContext.currentTime;
    let time = currentTime;

    // 반복되는 비프 패턴
    for (let i = 0; i < 20; i++) {
      // 소리 켜기
      gain.gain.setValueAtTime(0.1, time);
      time += 0.5;
      
      // 소리 끄기
      gain.gain.setValueAtTime(0, time);
      time += 0.5;
    }

    // 10초 후 중지
    setTimeout(() => {
      if (this.isPlaying) {
        this.play(); // 다시 시작하여 무한 루프
      }
    }, 10000);
  }

  stop() {
    if (!this.isPlaying) return;

    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
        this.oscillator = null;
      }

      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }

      this.isPlaying = false;
    } catch (error) {
      console.error('알람음 정지 실패:', error);
    }
  }
}

export default AlarmSound;