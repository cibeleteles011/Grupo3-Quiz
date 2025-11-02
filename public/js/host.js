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
const qrLobbyDiv = document.getElementById('qr-lobby');
const bgFileInput = document.getElementById('bg-file');

let currentPIN = null;
let countdownInterval = null;
let qrRendered = false;
let lastBgUrl = null;

// SFX mínimos
const sfxClick = new Audio('https://cdn.pixabay.com/download/audio/2022/03/09/audio_7c3e1c9f87.mp3?filename=click-124467.mp3');
const sfxReveal = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_08a05559c8.mp3?filename=success-1-6297.mp3');

// Gera QR Code para uma URL
function renderQR(targetEl, url) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  try {
    if (typeof QRCode !== 'undefined') {
      // eslint-disable-next-line no-new
      new QRCode(targetEl, {
        text: url,
        width: 220,
        height: 220,
        colorDark: '#111827',
        colorLight: '#e2e8f0',
        correctLevel: QRCode.CorrectLevel.M,
      });
      return;
    }
  } catch (_) { /* fallback abaixo */ }
  // Fallback: imagem de QR via API pública
  const img = document.createElement('img');
  const encoded = encodeURIComponent(url);
  img.width = 220; img.height = 220; img.alt = 'QR Code';
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encoded}`;
  targetEl.appendChild(img);
}

// Determina base URL (loca.lt público ou LAN)
function detectBaseUrl(info) {
  const origin = window.location.origin;
  const host = window.location.hostname;
  // Em produção (ex.: onrender.com) ou qualquer host que não seja localhost/127, use origin
  if (host !== 'localhost' && host !== '127.0.0.1') return origin;
  // Túnel publica (loca.lt)
  if (/\.loca\.lt$/i.test(host)) return origin;
  // Ambiente local/LAN
  return `http://${info.ip}:${info.port}`;
}

// Descobrir IP local via backend e mostrar URLs + QR
fetch('/api/info').then(r => r.json()).then(info => {
  const base = detectBaseUrl(info);
  const playerUrl = `${base}/player.html`;
  if (networkUrlSpan) networkUrlSpan.textContent = playerUrl;
  if (networkUrlSpan2) networkUrlSpan2.textContent = base;
  if (!qrRendered && qrLobbyDiv) {
    renderQR(qrLobbyDiv, playerUrl);
    qrRendered = true;
  }
}).catch(() => {
  if (networkUrlSpan) networkUrlSpan.textContent = 'http://<seu-ip>:3000/player.html';
  if (networkUrlSpan2) networkUrlSpan2.textContent = 'http://<seu-ip>:3000';
});

// Upload simples de fundo: aplica no Host e sincroniza com os Players
if (bgFileInput) {
  bgFileInput.addEventListener('change', () => {
    const file = bgFileInput.files && bgFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === 'string') {
        lastBgUrl = dataUrl;
        document.body.style.setProperty('--bg-url', `url('${dataUrl}')`);
        if (currentPIN) {
          socket.emit('host:bg_update', { pin: currentPIN, url: dataUrl });
        }
      }
    };
    reader.readAsDataURL(file);
  });
}

// Pódio Top 3
function renderPodium(container, leaderboard) {
  if (!container) return;
  container.innerHTML = '';
  const top3 = (leaderboard || []).slice(0, 3);
  const order = [1, 0, 2]; // visual: 2º, 1º, 3º (centro maior)
  const wrapper = document.createDocumentFragment();
  order.forEach(idx => {
    const item = top3[idx];
    const placeDiv = document.createElement('div');
    placeDiv.className = 'place ' + (idx === 0 ? 'first' : idx === 1 ? 'second' : 'third');
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.textContent = item ? `${item.score}` : '';
    const label = document.createElement('div');
    label.className = 'label';
    const av = document.createElement('div');
    av.className = 'avatar-circle';
    av.textContent = item ? (item.avatar || '😀') : '';
    if (item && item.color) av.style.backgroundColor = item.color;
    const nm = document.createElement('span');
    nm.textContent = item ? (idx === 0 ? '1º ' : idx === 1 ? '2º ' : '3º ') + item.name : (idx === 0 ? '1º' : idx === 1 ? '2º' : '3º');
    label.appendChild(av);
    label.appendChild(nm);
    placeDiv.appendChild(bar);
    placeDiv.appendChild(label);
    wrapper.appendChild(placeDiv);
  });
  container.appendChild(wrapper);
}

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

  // Atualiza QR com PIN embutido
  try {
    fetch('/api/info').then(r => r.json()).then(info => {
      const base = detectBaseUrl(info);
      const playerPinUrl = `${base}/player.html?pin=${encodeURIComponent(pin)}`;
      renderQR(qrLobbyDiv, playerPinUrl);
    }).catch(() => {
      const playerPinUrl = `http://<seu-ip>:3000/player.html?pin=${encodeURIComponent(pin)}`;
      renderQR(qrLobbyDiv, playerPinUrl);
    });
  } catch(_){}

  // Se já havia um fundo selecionado antes da criação da sala, sincroniza agora
  if (lastBgUrl) {
    try { socket.emit('host:bg_update', { pin: currentPIN, url: lastBgUrl }); } catch(_){}
  }
});

socket.on('room:players', (players) => {
  playersUl.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    li.className = 'player-badge';
    const av = document.createElement('div');
    av.className = 'avatar-circle';
    av.textContent = p.avatar || '😀';
    if (p.color) av.style.backgroundColor = p.color;
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

socket.on('game:question', ({ index, total, q, endAt }) => {
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

  startTimer(endAt || (Date.now() + (q.timeLimit || 20000)));
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
    if (item.color) av.style.backgroundColor = item.color;
    const nm = document.createElement('span');
    nm.textContent = `${item.name} — ${item.score}`;
    li.appendChild(av);
    li.appendChild(nm);
    leaderboardOl.appendChild(li);
  });
  const podiumDiv = document.getElementById('podium');
  renderPodium(podiumDiv, leaderboard);
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
    if (item.color) av.style.backgroundColor = item.color;
    const nm = document.createElement('span');
    nm.textContent = `${item.name} — ${item.score}`;
    li.appendChild(av);
    li.appendChild(nm);
    leaderboardOl.appendChild(li);
  });
  const podiumDiv = document.getElementById('podium');
  renderPodium(podiumDiv, leaderboard);
});

function startTimer(endAt) {
  stopTimer();
  const end = endAt || (Date.now());
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
// Removido: controles de música.
