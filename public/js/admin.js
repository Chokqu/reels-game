import { createLibrary, createPlayer, formatDuration, reelLabel } from './media.js';
import { createLeaderboard, scoreLabel } from './leaderboard.js';

const $ = id => document.getElementById(id);
const messages = {
  UNAUTHORIZED: 'Yönetici oturumu sona erdi. Yeniden giriş yap.', INVALID_PAYLOAD: 'Bilgiler geçersiz. Seçili dosyaları kontrol et.', INVALID_SESSION: 'Oturum bulunamadı veya sona erdi.', SESSION_ACTIVE: 'Açık bir oturum var. Mevcut oturuma dönülüyor.', INVALID_PHASE: 'Bu işlem şu anda yapılamıyor.', STALE_ROUND: 'Tur değişti. Güncel durum yüklendi.', VOTE_CLOSED: 'Oylama sona erdi.', RATE_LIMITED: 'Çok sık işlem yapıldı. Biraz bekleyip tekrar dene.', INTERNAL_ERROR: 'İşlem tamamlanamadı. Lütfen tekrar dene.', TIMEOUT: 'Yanıt alınamadı. Durum yeniden kontrol ediliyor.', OFFLINE: 'Bağlantı yok. Yeniden bağlanınca devam edebilirsin.'
};
let state = null, socket = null, ready = false, pending = false, offset = 0, pendingEnded = null, sendingEnded = false, endedRetry = null;
let library, leaderboard;
const player = createPlayer($('player'), { onEnded(roundId) { pendingEnded = roundId; sendEnded(); }, onError: showNotice });
library = createLibrary(() => { if (state) render(); else renderSetup(); });
leaderboard = createLeaderboard(library);

function showNotice(text = '') {
  $('notice').textContent = text; $('notice').hidden = !text;
  document.body.classList.toggle('has-notice', Boolean(text));
}
function button(text, action, label) {
  const element = document.createElement('button'); element.textContent = text;
  if (label) element.setAttribute('aria-label', label);
  element.addEventListener('click', action); return element;
}
function thumbnail(entry, className) {
  const element = document.createElement(entry.thumbnail ? 'img' : 'span');
  if (entry.thumbnail) { element.src = entry.thumbnail; element.alt = ''; }
  else element.textContent = entry.status === 'loading' ? 'Hazırlanıyor…' : entry.status === 'error' ? 'Video açılamadı' : 'Önizleme yok';
  if (className) element.className = className;
  return element;
}
function renderSetup() {
  if (state) return;
  const selected = library.selected;
  const activeFocus = document.activeElement?.dataset.focus;
  $('library').replaceChildren(); $('playlist').replaceChildren();
  if (!library.entries.size) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'Henüz video eklenmedi'; $('library').append(empty); }
  for (const entry of library.entries.values()) {
    const isSelected = selected.includes(entry);
    const label = isSelected ? reelLabel(selected.indexOf(entry)) : 'Video';
    const card = document.createElement('article'); card.className = `media-card${isSelected ? ' selected' : ''}`;
    const preview = document.createElement('div'); preview.className = 'media-preview'; preview.append(thumbnail(entry));
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = isSelected; check.disabled = entry.status !== 'ready' || pending; check.setAttribute('aria-label', `${label} seç`); check.dataset.focus = `select-${entry.id}`; check.addEventListener('change', () => library.toggle(entry.id)); preview.append(check);
    if (entry.duration) { const duration = document.createElement('span'); duration.className = 'duration'; duration.textContent = formatDuration(entry.duration); preview.append(duration); }
    const name = document.createElement('p'); name.className = 'filename'; name.textContent = label;
    const remove = button('Kaldır', () => library.remove(entry.id), `${label} kaldır`); remove.disabled = pending || library.busy;
    card.append(preview, name);
    if (entry.warning) { const warning = document.createElement('p'); warning.className = entry.status === 'error' ? 'error' : 'muted'; warning.textContent = entry.warning; card.append(warning); }
    card.append(remove); $('library').append(card);
  }
  selected.forEach((entry, index) => {
    const label = reelLabel(index);
    const row = document.createElement('li');
    const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0'); number.className = 'muted';
    const name = document.createElement('span'); name.className = 'filename'; name.textContent = label;
    const controls = document.createElement('div'); controls.className = 'playlist-controls';
    for (const [text, delta] of [['Yukarı', -1], ['Aşağı', 1]]) {
      const control = button(text, () => library.move(entry.id, delta), `${label} ${text.toLocaleLowerCase('tr')}`);
      control.disabled = pending || (delta === -1 ? index === 0 : index === selected.length - 1); control.dataset.focus = `${text}-${entry.id}`; controls.append(control);
    }
    const deselect = button('Çıkar', () => library.toggle(entry.id), `${label} listeden çıkar`); deselect.disabled = pending; controls.append(deselect);
    row.append(number, thumbnail(entry), name, controls); $('playlist').append(row);
  });
  const duration = formatDuration(selected.reduce((sum, entry) => sum + entry.duration, 0));
  $('playlist-summary').textContent = `${selected.length} video · ${duration}`;
  $('selected-count').textContent = `${selected.length} video seçili · ${duration}${selected.length > 100 ? ' · En fazla 100 video seçebilirsin.' : ''}`;
  $('create').disabled = !ready || pending || library.busy || !selected.length || selected.length > 100;
  $('create').textContent = pending ? 'Oluşturuluyor…' : 'Oturum oluştur';
  $('add-files').disabled = library.busy || pending;
  if (activeFocus) [...document.querySelectorAll('[data-focus]')].find(node => node.dataset.focus === activeFocus)?.focus({ preventScroll: true });
}
function remaining() { return state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now() - offset) / 1000)) : 0; }
function tick() {
  const seconds = remaining();
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (state?.phase === 'VOTING') { $('extend').disabled = !ready || pending || !seconds; $('end-vote').disabled = !ready || pending || !seconds; }
}
function apply(next) {
  if (next && state?.sessionId === next.sessionId && next.revision < state.revision) return;
  const previous = state;
  state = next;
  if (state) offset = state.serverNow - Date.now();
  if (!state) {
    pendingEnded = null; player.clear(); leaderboard.close();
    if (previous) library.clear();
  } else {
    if (pendingEnded && (state.roundId !== pendingEnded || state.phase !== 'PLAYING')) { pendingEnded = null; clearTimeout(endedRetry); }
    if (state.currentRound && (player.context?.roundId !== state.roundId || (!playerElementHasSource() && library.entries.get(state.currentRound.videoId)?.status === 'ready'))) {
      player.load(state.currentRound, library.entries.get(state.currentRound.videoId), state.phase === 'PLAYING');
    }
    if (state.phase === 'LEADERBOARD') player.stop();
  }
  render();
}
function playerElementHasSource() { return Boolean($('player').getAttribute('src')); }
function render() {
  $('login').hidden = true; $('app').hidden = false;
  $('connection').textContent = ready ? 'Bağlı' : 'Yeniden bağlanılıyor…';
  $('connection').classList.toggle('error', !ready);
  $('setup').hidden = Boolean(state); $('live').hidden = !state; $('logout').hidden = Boolean(state);
  const route = state ? `/admin/session/${state.sessionId}${state.phase === 'LEADERBOARD' ? '/leaderboard' : ''}` : '/admin/setup';
  if (location.pathname !== route) history.replaceState(null, '', route);
  if (!state) { $('round-label').textContent = 'Hazırlık'; renderSetup(); return; }
  const phase = state.phase, round = state.currentRound;
  $('round-label').textContent = `Reels ${String(state.roundNumber).padStart(2, '0')} / ${state.totalRounds}`;
  if ($('qr').getAttribute('src') !== state.qrImage) $('qr').src = state.qrImage;
  $('connected-count').textContent = state.connectedCount; $('vote-count').textContent = state.voteCount;
  $('lobby').hidden = phase !== 'LOBBY'; $('round-view').hidden = !['PLAYING', 'VOTING', 'RESULTS'].includes(phase); $('leaderboard').hidden = phase !== 'LEADERBOARD';
  $('lobby-detail').textContent = `${state.totalRounds} Reels · Katılmak için QR kodu okutun.`;
  const labels = { LOBBY: 'Katılımcılar bekleniyor', PLAYING: 'Reels izleniyor', VOTING: 'Puanlama açık', RESULTS: 'Tur tamamlandı', LEADERBOARD: 'Oyun bitti!' };
  $('rail-status').textContent = labels[phase]; $('rail-status').hidden = phase === 'VOTING'; $('phase-label').textContent = labels[phase];
  $('voting-tools').hidden = phase !== 'VOTING';
  const missing = state.playlist.filter(item => library.entries.get(item.id)?.status !== 'ready');
  $('recovery').hidden = !missing.length; $('missing-count').textContent = `${missing.length} video dosyası gerekli.`; $('reattach').disabled = library.busy || pending;
  $('video-name').textContent = state.currentIndex >= 0 ? reelLabel(state.currentIndex) : '';
  const hasMedia = library.entries.get(round?.videoId)?.status === 'ready';
  $('missing-player').hidden = hasMedia;
  $('play').hidden = phase !== 'PLAYING'; $('skip').hidden = phase !== 'PLAYING';
  $('replay').hidden = !['VOTING', 'RESULTS'].includes(phase);
  $('finish').hidden = phase !== 'RESULTS'; $('next').hidden = phase !== 'RESULTS';
  $('next').textContent = state.currentIndex === state.totalRounds - 1 ? 'Sıralamayı göster' : 'Sonraki video';
  $('result-panel').hidden = phase !== 'RESULTS'; $('stage').classList.toggle('with-result', phase === 'RESULTS');
  if (phase === 'RESULTS' && state.result) {
    $('average').textContent = scoreLabel(state.result); $('result-votes').textContent = `${state.result.voteCount} oy`;
    const key = JSON.stringify(state.result);
    if ($('histogram').dataset.result !== key) {
      $('histogram').dataset.result = key; $('histogram').replaceChildren();
      const max = Math.max(1, ...state.result.distribution);
      state.result.distribution.forEach((count, index) => {
        const row = document.createElement('div'); row.className = 'hist-row';
        const label = document.createElement('span'); label.textContent = index + 1;
        const bar = document.createElement('meter'); bar.min = 0; bar.max = max; bar.value = count; bar.setAttribute('aria-label', `${index + 1} puan: ${count} oy`);
        const value = document.createElement('span'); value.textContent = count;
        row.append(label, bar, value); $('histogram').append(row);
      });
    }
  }
  for (const id of ['start', 'finish-lobby', 'skip', 'finish', 'next', 'close-session']) $(id).disabled = !ready || pending;
  $('play').disabled = !ready || pending || !hasMedia; $('replay').disabled = !ready || pending || !hasMedia;
  if (phase === 'LEADERBOARD') leaderboard.render(state);
  if (state.backupFailed) showNotice('Sonuç yedeği kaydedilemedi. Sonuçları JSON olarak indir; sunucunun disk alanını ve yazma izinlerini kontrol et.');
  tick();
}
function emit(event, payload = {}) {
  return new Promise(resolve => {
    if (!socket?.connected) return resolve({ ok: false, code: 'OFFLINE' });
    socket.volatile.timeout(5000).emit(event, payload, (error, response) => resolve(error ? { ok: false, code: 'TIMEOUT' } : response));
  });
}
async function resume() {
  if (!socket?.connected) return;
  const response = await emit('admin:resume');
  if (response.ok) { ready = true; apply(response.state); sendEnded(); }
  else if (response.code === 'UNAUTHORIZED') showLogin(messages.UNAUTHORIZED);
  else { showNotice(messages[response.code]); ready = false; setTimeout(() => { if (socket?.connected) resume(); }, 2000); }
}
async function command(event, extra = {}) {
  if (pending || !ready) return null;
  pending = true; showNotice(''); render();
  const response = await emit(event, { ...(state ? { sessionId: state.sessionId, roundId: state.roundId } : {}), ...extra });
  if ('state' in response) apply(response.state);
  if (!response.ok) {
    showNotice(messages[response.code] || 'İşlem tamamlanamadı.');
    if (response.code === 'UNAUTHORIZED') showLogin(messages.UNAUTHORIZED);
    else await resume();
  }
  pending = false;
  if (!$('app').hidden) render();
  return response;
}
async function sendEnded() {
  if (!ready || !pendingEnded || sendingEnded || state?.phase !== 'PLAYING' || state.roundId !== pendingEnded) return;
  sendingEnded = true;
  const response = await emit('video:ended', { sessionId: state.sessionId, roundId: pendingEnded });
  if ('state' in response) apply(response.state);
  if (!response.ok && response.code === 'UNAUTHORIZED') showLogin(messages.UNAUTHORIZED);
  sendingEnded = false;
  if (pendingEnded && state?.phase === 'PLAYING') { clearTimeout(endedRetry); endedRetry = setTimeout(async () => { await resume(); sendEnded(); }, 2000); }
}
function connect() {
  socket?.disconnect();
  ready = false;
  socket = window.io({ autoConnect: false });
  socket.on('connect', resume);
  socket.on('session:state', apply);
  socket.on('disconnect', () => { ready = false; if (!$('app').hidden) render(); });
  socket.on('connect_error', () => { ready = false; if (!$('app').hidden) render(); });
  socket.on('session:closed', () => { apply(null); showNotice('Oturum kapatıldı. Yeni bir oyun hazırlayabilirsin.'); });
  socket.on('admin:warning', () => showNotice('Sonuç yedeği kaydedilemedi. Final ekranından JSON dosyasını indir.'));
  socket.on('admin:revoked', () => showLogin('Yönetici oturumu sona erdi. Yeniden giriş yap.'));
  socket.connect();
}
function showLogin(message = '') {
  ready = false; socket?.disconnect(); player.stop(); leaderboard.close();
  $('app').hidden = true; $('login').hidden = false; $('login-error').textContent = message; $('token').value = '';
  history.replaceState(null, '', '/admin');
}
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('login-submit').disabled = true; $('login-error').textContent = '';
  try {
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: $('token').value }) });
    $('token').value = '';
    if (!response.ok) { $('login-error').textContent = response.status === 429 ? 'Çok fazla deneme yapıldı. Bir dakika bekle.' : 'Giriş yapılamadı. Yönetici anahtarını kontrol et.'; return; }
    $('login').hidden = true; $('app').hidden = false; connect();
  } catch { $('login-error').textContent = 'Sunucuya ulaşılamadı. Yeniden dene.'; }
  finally { $('login-submit').disabled = false; }
});
$('logout').addEventListener('click', async () => {
  try { await fetch('/api/admin/logout', { method: 'POST' }); showLogin(); }
  catch { showNotice('Çıkış yapılamadı. Bağlantını kontrol et.'); }
});
$('add-files').addEventListener('click', () => $('files').click());
$('reattach').addEventListener('click', () => $('files').click());
async function addFiles(files) {
  if (pending || library.busy) return;
  const messages = await library.add(files, state?.playlist);
  showNotice(messages.join(' '));
  if (state) apply(state);
}
$('files').addEventListener('change', event => { const files = Array.from(event.target.files); event.target.value = ''; addFiles(files); });
for (const event of ['dragenter', 'dragover']) $('drop-area').addEventListener(event, e => { e.preventDefault(); $('drop-area').classList.add('dragging'); });
for (const event of ['dragleave', 'drop']) $('drop-area').addEventListener(event, e => { e.preventDefault(); $('drop-area').classList.remove('dragging'); if (event === 'drop' && !state) addFiles(e.dataTransfer.files); });
$('create').addEventListener('click', () => command('session:create', { playlist: library.metadata() }));
async function start() {
  player.stop();
  const response = await command('video:start');
  if (response?.ok) player.play();
}
$('start').addEventListener('click', start);
$('play').addEventListener('click', () => { showNotice(''); player.play(); });
$('replay').addEventListener('click', () => { showNotice(''); player.play(true); });
$('skip').addEventListener('click', async () => { if (confirm('Bu video puanlanmadan atlanacak. Devam edilsin mi?')) { const response = await command('video:skip'); if (response?.ok) player.stop(); } });
$('extend').addEventListener('click', () => command('vote:extend'));
$('end-vote').addEventListener('click', () => command('vote:close'));
async function finish() {
  if (confirm('Etkinlik bitirilsin mi? Oynatılmayan videolar sıralamaya alınmayacak.')) { const response = await command('session:finish'); if (response?.ok) player.stop(); }
}
$('finish').addEventListener('click', finish); $('finish-lobby').addEventListener('click', finish);
$('next').addEventListener('click', async () => {
  if (state.currentIndex === state.totalRounds - 1) { const response = await command('session:finish'); if (response?.ok) player.stop(); }
  else start();
});
$('close-session').addEventListener('click', async () => {
  if (confirm('Oturum kapatılsın mı? QR bağlantısı geçersiz olacak ve yerel video seçimi temizlenecek.')) await command('session:close');
});
window.addEventListener('offline', () => { ready = false; socket?.disconnect(); if (!$('app').hidden) render(); });
window.addEventListener('online', () => { if (!$('app').hidden) socket?.connect(); });
window.addEventListener('popstate', () => { if (!$('app').hidden) render(); });
window.addEventListener('beforeunload', event => { if (state && library.entries.size) { event.preventDefault(); event.returnValue = ''; } });
setInterval(tick, 200);
try {
  const response = await fetch('/api/admin/me');
  if (response.ok) connect(); else showLogin();
} catch { showLogin('Sunucuya ulaşılamadı. Bağlantını kontrol et.'); }
