const socket = io();

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

const qIndex = el('q-index');
const qTotal = el('q-total');
const qText = el('q-text');
const optionsDiv = el('options');
const timerDiv = el('timer');
const feedback = el('feedback');
const leaderboardOl = el('leaderboard');

let currentPIN = null;
let answered = false;
let selectedAvatar = '😀';

// Avatares disponíveis (pode expandir conforme desejar)
const AVATARS = ['😀','😎','🤩','🦊','🐼','🐯','🐸','🐵','🐱','🐶','🦄','🐝','🐧','🐙','🐳'];

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
      Array.from(avatarGrid.children).forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
    });
    avatarGrid.appendChild(btn);
  });
}
renderAvatarGrid();

btnJoin.addEventListener('click', () => {
  const pin = (inpPin.value || '').trim();
  const name = (inpName.value || '').trim() || 'Jogador';
  if (pin.length !== 6) {
    showError('PIN deve ter 6 dígitos.');
    return;
  }
  socket.emit('player:join', { pin, name, avatar: selectedAvatar });
});

socket.on('player:error', ({ message }) => showError(message));

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

socket.on('game:question', ({ index, total, q }) => {
  secWaiting.classList.add('hidden');
  secEnd.classList.add('hidden');
  secGame.classList.remove('hidden');
  feedback.textContent = '';
  answered = false;

  qIndex.textContent = index + 1;
  qTotal.textContent = total;
  qText.textContent = q.text;
  optionsDiv.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = `btn option opt-${i}`;
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      socket.emit('player:answer', { pin: currentPIN, choice: i });
      feedback.textContent = 'Resposta enviada!';
    });
    optionsDiv.appendChild(btn);
  });
});

socket.on('game:reveal', ({ correctIndex, leaderboard, results }) => {
  feedback.textContent = `Resposta correta: opção ${correctIndex + 1}`;
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
    const nm = document.createElement('span');
    nm.textContent = `${item.name} — ${item.score}`;
    li.appendChild(av);
    li.appendChild(nm);
    leaderboardOl.appendChild(li);
  });
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
