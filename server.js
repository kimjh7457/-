const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// 방별 사용자 정보 저장
const rooms = new Map();

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('사용자 연결됨:', socket.id);

  // 방 참가
  socket.on('join-room', ({ roomCode, userName, userId }) => {
    console.log(`${userName}이 방 ${roomCode}에 참가`);
    
    socket.join(roomCode);
    socket.roomCode = roomCode;
    socket.userName = userName;
    socket.userId = userId;

    // 방 정보 초기화 또는 가져오기
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        users: new Map(),
        alarmTime: null,
        isAlarmSet: false,
        isAlarmRinging: false,
        dismissals: new Set()
      });
    }

    const room = rooms.get(roomCode);
    
    // 사용자 정보 추가/업데이트
    room.users.set(userId, {
      socketId: socket.id,
      userName,
      userId,
      connected: true,
      dismissed: false
    });

    // 방의 모든 사용자에게 업데이트된 사용자 목록 전송
    const userList = Array.from(room.users.values());
    io.to(roomCode).emit('user-joined', userList);

    console.log(`방 ${roomCode}의 현재 사용자:`, userList.map(u => u.userName));
  });

  // 알람 설정
  socket.on('set-alarm', ({ roomCode, alarmTime }) => {
    console.log(`방 ${roomCode}에서 알람 설정: ${alarmTime}`);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.alarmTime = alarmTime;
      room.isAlarmSet = true;
      room.isAlarmRinging = false;
      room.dismissals.clear();
      
      // 모든 사용자의 dismissed 상태 초기화
      for (let user of room.users.values()) {
        user.dismissed = false;
      }

      io.to(roomCode).emit('alarm-set', { alarmTime });
      console.log(`방 ${roomCode}에 알람이 설정됨: ${alarmTime}`);
    }
  });

  // 알람 발동
  socket.on('trigger-alarm', ({ roomCode }) => {
    console.log(`방 ${roomCode}에서 알람 발동`);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.isAlarmRinging = true;
      room.dismissals.clear();
      
      // 모든 사용자의 dismissed 상태 초기화
      for (let user of room.users.values()) {
        user.dismissed = false;
      }

      io.to(roomCode).emit('alarm-triggered');
      console.log(`방 ${roomCode}에 알람이 발동됨`);
    }
  });

  // 알람 해제
  socket.on('dismiss-alarm', ({ roomCode, userId, userName }) => {
    console.log(`${userName}이 알람 해제 시도`);
    
    const room = rooms.get(roomCode);
    if (room && room.isAlarmRinging) {
      // 사용자의 해제 상태 업데이트
      const user = room.users.get(userId);
      if (user) {
        user.dismissed = true;
        room.dismissals.add(userId);
        
        console.log(`${userName}이 알람을 해제함. 현재 해제한 사용자: ${room.dismissals.size}/${room.users.size}`);
        
        // 모든 사용자에게 해제 상태 전송
        const userList = Array.from(room.users.values());
        io.to(roomCode).emit('user-dismissed', { 
          userId, 
          userName,
          users: userList
        });

        // 모든 사용자가 해제했는지 확인
        if (room.dismissals.size >= room.users.size) {
          console.log(`방 ${roomCode}의 모든 사용자가 알람을 해제함`);
          room.isAlarmRinging = false;
          room.isAlarmSet = false;
          room.dismissals.clear();
          
          // 모든 사용자의 dismissed 상태 초기화
          for (let user of room.users.values()) {
            user.dismissed = false;
          }
          
          io.to(roomCode).emit('alarm-stopped');
        }
      }
    }
  });

  // 알람 정지 (모든 사용자가 해제했을 때)
  socket.on('stop-alarm', ({ roomCode }) => {
    console.log(`방 ${roomCode}에서 알람 정지`);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.isAlarmRinging = false;
      room.isAlarmSet = false;
      room.dismissals.clear();
      
      // 모든 사용자의 dismissed 상태 초기화
      for (let user of room.users.values()) {
        user.dismissed = false;
      }

      io.to(roomCode).emit('alarm-stopped');
      console.log(`방 ${roomCode}의 알람이 정지됨`);
    }
  });

  // 알람 리셋
  socket.on('reset-alarm', ({ roomCode }) => {
    console.log(`방 ${roomCode}에서 알람 리셋`);
    
    const room = rooms.get(roomCode);
    if (room) {
      room.alarmTime = null;
      room.isAlarmSet = false;
      room.isAlarmRinging = false;
      room.dismissals.clear();
      
      // 모든 사용자의 dismissed 상태 초기화
      for (let user of room.users.values()) {
        user.dismissed = false;
      }

      io.to(roomCode).emit('alarm-reset');
      console.log(`방 ${roomCode}의 알람이 리셋됨`);
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('사용자 연결 해제됨:', socket.id);
    
    if (socket.roomCode && socket.userId) {
      const room = rooms.get(socket.roomCode);
      if (room) {
        // 사용자를 연결 해제 상태로 표시 (완전히 제거하지 않음)
        const user = room.users.get(socket.userId);
        if (user) {
          user.connected = false;
          
          // 업데이트된 사용자 목록 전송
          const userList = Array.from(room.users.values());
          socket.to(socket.roomCode).emit('user-left', userList);
          
          console.log(`${socket.userName}이 방 ${socket.roomCode}에서 연결 해제됨`);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`http://localhost:${PORT}`);
});