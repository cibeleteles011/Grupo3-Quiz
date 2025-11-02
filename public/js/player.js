let socket = null;

const el = (id) => document.getElementById(id);
const secJoin = el('join');
const secWaiting = el('waiting');
const secGame = el('game');
const secEnd = el('end');

const inpPin = el('pin');
const inpName = el('name');
const btnJoin = el('join-btn');
const errorDiv = el('error');
const roomPinDiv = el('room-pin');
const avatarGrid = el('avatar-grid');
const avatarColorInput = document.getElementById('avatar-color');

const qIndex = el('q-index');
const qTotal = el('q-total');
const qText = el('q-text');
const optionsDiv = el('options');
const timerDiv = el('timer');
const feedback = el('feedback');
const leaderboardOl = el('leaderboard');
const podiumDiv = document.getElementById('podium-player');
const secRound = el('round');
const leaderboardRound = el('leaderboard-round');
const podiumRound = document.getElementById('podium-round');

let currentPIN = null;
let answered = false;
let selectedAvatar = '😀';
let selectedColor = '#ffffff';
let countdownInterval = null;

// Áudios
const sfxClick = document.getElementById('sfx-click');
const sfxReveal = document.getElementById('sfx-reveal');

// Avatares disponíveis (personagens legais)
const AVATARS = [
  '😎','🤖','👾','🧙\u200d♂️','🧝\u200d♀️','🦸\u200d♂️','🦸\u200d♀️','🧑\u200d🚀','🧑\u200d🎮','👨\u200d🎤',
  '🦊','🐯','🦁','🐲','🐼','🐧','🐙','🦄','🐨','🐸'
];

function renderAvatarGrid() {
  avatarGrid.innerHTML = '';
  AVATARS.forEach(av => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-btn';
    btn.textContent = av;
    if (av === selectedAvatar) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      selectedAvatar = av;
      try { localStorage.setItem('quiz_avatar', selectedAvatar); } catch(_){}
      Array.from(avatarGrid.children).forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
    });
    avatarGrid.appendChild(btn);
  });
}
try {
  const savedAv = localStorage.getItem('quiz_avatar');
  if (savedAv) selectedAvatar = savedAv;
  const savedColor = localStorage.getItem('quiz_avatar_color');
  if (savedColor) selectedColor = savedColor;
} catch(_){}
renderAvatarGrid();
if (avatarColorInput) {
  avatarColorInput.value = selectedColor;
  avatarColorInput.addEventListener('input', () => {
    selectedColor = avatarColorInput.value || '#ffffff';
    try { localStorage.setItem('quiz_avatar_color', selectedColor); } catch(_){}
  });
}

// Resolve servidor base via query string (?server=...)
let SERVER_BASE = window.location.origin;
try {
  const url = new URL(window.location.href);
  const qsServer = (url.searchParams.get('server') || '').trim();
  if (qsServer) SERVER_BASE = qsServer;
} catch(_) {}

// Preenche PIN via query string
try {
  const url = new URL(window.location.href);
  const qpinRaw = (url.searchParams.get('pin') || '').trim();
  const qpin = qpinRaw.replace(/\D/g, '');
  if (qpin && qpin.length === 6) {
    inpPin.value = qpin;
  }
} catch(_) {}

// Inicializa socket
try {
  // Usa o servidor base resolvido (permite domínios diferentes)
  socket = io(SERVER_BASE, { transports: ['websocket', 'polling'] });
} catch (e) {
  console.error('Falha ao conectar socket:', e);
}

btnJoin.addEventListener('click', async () => {
  const pin = ((inpPin.value || '').replace(/\D/g, '')).trim();
  const name = (inpName.value || '').trim() || 'Jogador';
  if (pin.length !== 6) {
    showError('PIN deve ter 6 dígitos.');
    return;
  }
  if (sfxClick) { try { sfxClick.currentTime = 0; sfxClick.play(); } catch(_){} }
  try {
    btnJoin.disabled = true;
    errorDiv.classList.add('hidden');
    const res = await fetch(`${SERVER_BASE}/api/room/${encodeURIComponent(pin)}`, { mode: 'cors' }).then(r => r.ok ? r.json() : { exists: true }).catch(() => ({ exists: true }));
    if (!res || res.exists !== true) {
      showError('PIN inválido ou sala encerrada. Crie uma sala nova com o Host.');
      btnJoin.disabled = false;
      return;
    }
  } catch(_) { /* prossegue mesmo sem checar */ }
  socket.emit('player:join', { pin, name, avatar: selectedAvatar, color: selectedColor });
});

socket.on('player:error', ({ message }) => {
  btnJoin.disabled = false;
  showError(message);
});

socket.on('player:joined', ({ pin, name }) => {
  currentPIN = pin;
  secJoin.classList.add('hidden');
  secWaiting.classList.remove('hidden');
  roomPinDiv.textContent = `PIN: ${pin}`;
});

socket.on('room:ended', () => {
  alert('Sala encerrada pelo host.');
  window.location.href = '/';
});

socket.on('game:question', ({ index, total, q, endAt }) => {
  secWaiting.classList.add('hidden');
  secEnd.classList.add('hidden');
  if (secRound) secRound.classList.add('hidden');
  secGame.classList.remove('hidden');
  feedback.textContent = '';
  answered = false;

  qIndex.textContent = index + 1;
  qTotal.textContent = total;
  qText.textContent = q.text;
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option opt-' + i;
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      // animação de clique
      btn.classList.add('clicked');
      setTimeout(() => btn.classList.remove('clicked'), 600);
      socket.emit('player:answer', { pin: currentPIN, choice: i, time: Date.now() });
      feedback.textContent = 'Resposta enviada!';
    });
    optionsDiv.appendChild(btn);
  });
  startTimer(endAt || (Date.now() + (q.timeLimit || 20000)));
});

socket.on('game:reveal', ({ correctIndex, leaderboard, results }) => {
  feedback.textContent = `Resposta correta: opção ${correctIndex + 1}`;
  if (sfxReveal) { try { sfxReveal.currentTime = 0; sfxReveal.play(); } catch(_){} }

  // Mostrar página de resultados da rodada
  if (secRound && leaderboardRound) {
    secGame.classList.add('hidden');
    secEnd.classList.add('hidden');
    secRound.classList.remove('hidden');
    leaderboardRound.innerHTML = '';
    (leaderboard || []).slice(0, 5).forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'player-badge';
      const av = document.createElement('div');
      av.className = 'avatar-circle';
      av.textContent = item.avatar || '😀';
      if (item.color) av.style.backgroundColor = item.color;
      const nm = document.createElement('span');
      nm.textContent = `${idx + 1}. ${item.name} — ${item.score}`;
      li.appendChild(av);
      li.appendChild(nm);
      leaderboardRound.appendChild(li);
    });
    if (podiumRound) podiumRound.classList.add('hidden');
  }
});

socket.on('game:ended', ({ leaderboard }) => {
  secGame.classList.add('hidden');
  secEnd.classList.remove('hidden');
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

  // Renderiza pódio (Top 3)
  if (podiumDiv) {
    podiumDiv.innerHTML = '';
    const top3 = (leaderboard || []).slice(0, 3);
    const order = [1, 0, 2]; // 2º, 1º, 3º (centro maior)
    const frag = document.createDocumentFragment();
    order.forEach((idx) => {
      const item = top3[idx];
      const placeDiv = document.createElement('div');
      placeDiv.className = 'place ' + (idx === 0 ? 'first' : idx === 1 ? 'second' : 'third');
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.textContent = item ? `${item.score}` : '';
      const label = document.createElement('div');
      label.className = 'label';
      const avc = document.createElement('div');
      avc.className = 'avatar-circle';
      avc.textContent = item ? (item.avatar || '😀') : '';
      if (item && item.color) avc.style.backgroundColor = item.color;
      const nm = document.createElement('span');
      nm.textContent = item ? ((idx === 0 ? '1º ' : idx === 1 ? '2º ' : '3º ') + item.name) : (idx === 0 ? '1º' : idx === 1 ? '2º' : '3º');
      label.appendChild(avc);
      label.appendChild(nm);
      placeDiv.appendChild(bar);
      placeDiv.appendChild(label);
      frag.appendChild(placeDiv);
    });
    podiumDiv.appendChild(frag);
  }
});

// Atualização de fundo vinda do Host
socket.on('room:bg_update', ({ url }) => {
  if (!url) return;
  document.body.style.setProperty('--bg-url', `url('${url}')`);
});

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove('hidden');
}

function startTimer(endAt) {
  stopTimer();
  if (!timerDiv) return;
  countdownInterval = setInterval(() => {
    const left = Math.max(0, (endAt || 0) - Date.now());
    const s = Math.ceil(left / 1000);
    timerDiv.textContent = `${s}s`;
    if (s <= 5) {
      timerDiv.classList.add('timer-warning');
    } else {
      timerDiv.classList.remove('timer-warning');
    }
    if (left <= 0) {
      timerDiv.classList.remove('timer-warning');
      stopTimer();
    }
  }, 200);
}

function stopTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = null;
}
