const socket = io();

const el = (id) => document.getElementById(id);
const secSetup = el('setup');
const secLobby = el('lobby');
const secGame = el('game');

const txtQuiz = el('quiz-json');
const btnCreate = el('create-room');
const pinSpan = el('pin');
const playersUl = el('players');
const btnStart = el('start');
const qIndex = el('q-index');
const qTotal = el('q-total');
const qText = el('q-text');
const optionsDiv = el('options');
const timerDiv = el('timer');
const btnReveal = el('reveal');
const btnNext = el('next');
const answerCount = el('answer-count');
const revealPanel = el('reveal-panel');
const leaderboardOl = el('leaderboard');
const networkUrlSpan = el('network-url');
const networkUrlSpan2 = el('network-url-2');
const qrSetupDiv = document.getElementById('qr-setup');
const qrLobbyDiv = document.getElementById('qr-lobby');

let currentPIN = null;
let countdownInterval = null;

// Gera QR Code para uma URL
function renderQR(targetEl, url) {
  if (!targetEl || typeof QRCode === 'undefined') return;
  targetEl.innerHTML = '';
  // eslint-disable-next-line no-new
  new QRCode(targetEl, {
    text: url,
    width: 160,
    height: 160,
    colorDark: '#111827',
    colorLight: '#e2e8f0',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

// Determina base URL (loca.lt público ou LAN)
function detectBaseUrl(info) {
  const origin = window.location.origin;
  if (/\.loca\.lt$/i.test(window.location.hostname)) {
    return origin; // já público via túnel
  }
  return `http://${info.ip}:${info.port}`; // LAN
}

// Descobrir IP local via backend e mostrar URLs + QR
fetch('/api/info').then(r => r.json()).then(info => {
  const base = detectBaseUrl(info);
  const playerUrl = `${base}/player.html`;
  if (networkUrlSpan) networkUrlSpan.textContent = playerUrl;
  if (networkUrlSpan2) networkUrlSpan2.textContent = base;
  renderQR(qrSetupDiv, playerUrl);
  renderQR(qrLobbyDiv, playerUrl);
}).catch(() => {
  if (networkUrlSpan) networkUrlSpan.textContent = 'http://<seu-ip>:3000/player.html';
  if (networkUrlSpan2) networkUrlSpan2.textContent = 'http://<seu-ip>:3000';
});

btnCreate.addEventListener('click', () => {
  let quiz = [];
  try {
    quiz = txtQuiz.value.trim() ? JSON.parse(txtQuiz.value) : window.DEFAULT_QUIZ;
  } catch (e) {
    alert('JSON inválido. Usando o quiz de exemplo.');
    quiz = window.DEFAULT_QUIZ;
  }
  socket.emit('host:create_room', quiz);
});

socket.on('host:room_created', ({ pin }) => {
  currentPIN = pin;
  pinSpan.textContent = pin;
  secSetup.classList.add('hidden');
  secLobby.classList.remove('hidden');
});

socket.on('room:players', (players) => {
  playersUl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.className = 'player-badge';
    const av = document.createElement('div');
    av.className = 'avatar-circle';
    av.textContent = p.avatar || '😀';
    const nm = document.createElement('span');
    nm.textContent = p.name;
    li.appendChild(av);
    li.appendChild(nm);
    playersUl.appendChild(li);
  });
});

btnStart.addEventListener('click', () => {
  if (!currentPIN) return;
  socket.emit('host:start', { pin: currentPIN });
});

socket.on('game:question', ({ index, total, q }) => {
  secLobby.classList.add('hidden');
  secGame.classList.remove('hidden');
  revealPanel.classList.add('hidden');
  leaderboardOl.innerHTML = '';
  answerCount.textContent = '';

  qIndex.textContent = index + 1;
  qTotal.textContent = total;
  qText.textContent = q.text;
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('div');
    btn.className = `option opt-${i}`;
    btn.textContent = opt;
    optionsDiv.appendChild(btn);
  });

  startTimer(q.timeLimit);
});

socket.on('host:answer_count', (count) => {
  answerCount.textContent = `${count} resposta(s) recebida(s)`;
});

btnReveal.addEventListener('click', () => {
  if (!currentPIN) return;
  socket.emit('host:reveal', { pin: currentPIN });
});

btnNext.addEventListener('click', () => {
  if (!currentPIN) return;
  socket.emit('host:next', { pin: currentPIN });
});

socket.on('game:reveal', ({ correctIndex, leaderboard, results }) => {
  stopTimer();
  revealPanel.classList.remove('hidden');
  leaderboardOl.innerHTML = '';
  leaderboard.forEach(item => {
    const li = document.createElement('li');
    li.className = 'player-badge';
    const av = document.createElement('div');
    av.className = 'avatar-circle';
    av.textContent = item.avatar || '😀';
    const nm = document.createElement('span');
    nm.textContent = `${item.name} — ${item.score}`;
    li.appendChild(av);
    li.appendChild(nm);
    leaderboardOl.appendChild(li);
  });
});

socket.on('game:ended', ({ leaderboard }) => {
  stopTimer();
  alert('Jogo encerrado!');
  revealPanel.classList.remove('hidden');
  leaderboardOl.innerHTML = '';
  leaderboard.forEach(item => {
    const li = document.createElement('li');
    li.className = 'player-badge';
    const av = document.createElement('div');
    av.className = 'avatar-circle';
    av.textContent = item.avatar || '😀';
    const nm = document.createElement('span');
    nm.textContent = `${item.name} — ${item.score}`;
    li.appendChild(av);
    li.appendChild(nm);
    leaderboardOl.appendChild(li);
  });
});

function startTimer(ms) {
  stopTimer();
  const end = Date.now() + ms;
  countdownInterval = setInterval(() => {
    const left = Math.max(0, end - Date.now());
    const s = Math.ceil(left / 1000);
    timerDiv.textContent = `${s}s`;
    if (left <= 0) {
      stopTimer();
    }
  }, 200);
}

function stopTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = null;
}
