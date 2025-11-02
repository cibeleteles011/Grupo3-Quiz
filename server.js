const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Estado em memória (simples)
const rooms = new Map();

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/info', (req, res) => {
  res.json({ ip: getLocalIP(), port: PORT });
});

// Verifica se um PIN existe
app.get('/api/room/:pin', (req, res) => {
  const pin = String(req.params.pin || '').replace(/\D/g, '');
  const exists = rooms.has(pin);
  res.json({ exists });
});

function generatePIN() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

function getPublicLeaderboard(room) {
  return Object.values(room.players)
    .map(p => ({ name: p.name, score: p.score, avatar: p.avatar, color: p.color }))
    .sort((a, b) => b.score - a.score);
}

io.on('connection', (socket) => {
  // Host cria sala
  socket.on('host:create_room', (quiz) => {
    const pin = generatePIN();
    const room = {
      pin,
      hostId: socket.id,
      players: {},
      state: 'lobby',
      questionIndex: -1,
      quiz: Array.isArray(quiz) && quiz.length ? quiz : [],
      answers: {}, // socketId -> { choice, time }
      startTime: null,
    };
    rooms.set(pin, room);
    socket.join(pin);
    socket.emit('host:room_created', { pin });
    try { console.log(`[host:create_room] PIN ${pin} criado por ${socket.id}`); } catch(_){}
  });

  // Jogador entra
  socket.on('player:join', ({ pin, name, avatar, color }) => {
    const room = rooms.get(pin);
    if (!room) {
      socket.emit('player:error', { message: 'PIN inválido' });
      try { console.log(`[player:join] PIN inválido tentado: ${pin} por ${socket.id}`); } catch(_){}
      return;
    }
    // Permitir entrada tardia: aceita em lobby e durante o jogo
    if (!room.players[socket.id]) {
      room.players[socket.id] = { name: String(name || 'Jogador'), score: 0, avatar: String(avatar || '😀'), color: String(color || '#ffffff') };
    }
    socket.join(pin);
    io.to(pin).emit('room:players', Object.values(room.players).map(p => ({ name: p.name, avatar: p.avatar, color: p.color })));
    socket.emit('player:joined', { pin, name: room.players[socket.id].name });
    try { console.log(`[player:join] ${room.players[socket.id].name} entrou na sala ${pin}`); } catch(_){}

    // Sincroniza estado atual para o novo jogador
    if (room.state === 'question') {
      const question = room.quiz[room.questionIndex];
      if (question) {
        socket.emit('game:question', {
          index: room.questionIndex,
          total: room.quiz.length,
          q: { text: question.text, options: question.options, timeLimit: question.timeLimit || 20000 },
          endAt: (room.startTime || Date.now()) + (question.timeLimit || 20000),
        });
      }
    } else if (room.state === 'ended') {
      socket.emit('game:ended', { leaderboard: getPublicLeaderboard(room) });
    }
  });

  // Host inicia jogo
  socket.on('host:start', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;
    room.state = 'in_game';
    room.questionIndex = -1;
    nextQuestion(pin);
  });

  // Próxima pergunta
  socket.on('host:next', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;
    nextQuestion(pin);
  });

  // Revelar respostas e pontuar
  socket.on('host:reveal', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;
    scoreCurrent(pin);
  });

  // Resposta do jogador
  socket.on('player:answer', ({ pin, choice }) => {
    const room = rooms.get(pin);
    if (!room || room.state !== 'question') return;
    if (!(socket.id in room.players)) return;
    if (socket.id in room.answers) return; // já respondeu

    const time = Date.now() - (room.startTime || Date.now());
    room.answers[socket.id] = { choice, time };
    io.to(room.hostId).emit('host:answer_count', Object.keys(room.answers).length);
  });

  // Atualização de fundo enviada pelo host
  socket.on('host:bg_update', ({ pin, url }) => {
    const room = rooms.get(pin);
    if (!room || room.hostId !== socket.id) return;
    io.to(pin).emit('room:bg_update', { url: String(url || '') });
  });

  socket.on('disconnect', () => {
    // Se host caiu, encerrar sala
    for (const [pin, room] of rooms.entries()) {
      if (room.hostId === socket.id) {
        io.to(pin).emit('room:ended');
        io.socketsLeave(pin);
        rooms.delete(pin);
      } else if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(pin).emit('room:players', Object.values(room.players).map(p => ({ name: p.name, avatar: p.avatar, color: p.color })));
      }
    }
  });
});

function nextQuestion(pin) {
  const room = rooms.get(pin);
  if (!room) return;
  room.questionIndex += 1;
  room.answers = {};
  const question = room.quiz[room.questionIndex];
  if (!question) {
    room.state = 'ended';
    io.to(pin).emit('game:ended', { leaderboard: getPublicLeaderboard(room) });
    return;
  }
  room.state = 'question';
  room.startTime = Date.now();
  io.to(pin).emit('game:question', {
    index: room.questionIndex,
    total: room.quiz.length,
    q: {
      text: question.text,
      options: question.options,
      timeLimit: question.timeLimit || 20000,
    },
    endAt: room.startTime + (question.timeLimit || 20000),
  });
}

function scoreCurrent(pin) {
  const room = rooms.get(pin);
  if (!room) return;
  const question = room.quiz[room.questionIndex];
  if (!question) return;

  // pontuação simples: acerto = 1000 - (tempo/20) limitado a >= 100
  const correctIndex = question.correctIndex;
  const results = [];
  for (const [sid, ans] of Object.entries(room.answers)) {
    const player = room.players[sid];
    if (!player) continue;
    const correct = Number(ans.choice) === Number(correctIndex);
    let delta = 0;
    if (correct) {
      delta = Math.max(100, Math.round(1000 - (ans.time / 20)));
      player.score += delta;
    }
    results.push({ name: player.name, avatar: player.avatar, color: player.color, correct, time: ans.time, delta, total: player.score });
  }
  io.to(pin).emit('game:reveal', {
    correctIndex,
    leaderboard: getPublicLeaderboard(room),
    results,
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const ip = getLocalIP();
  console.log(`Servidor no http://localhost:${PORT}`);
  console.log(`Acesse na rede: http://${ip}:${PORT}`);
});
