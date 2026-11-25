const $ = id => document.getElementById(id);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const match = location.pathname.match(/^\/join\/([^/]+)\/?$/);
let state = null, ready = false, pending = false, offset = 0, invalid = false, socket = null, token = null, retryTimer = null;
const sessionId = match?.[1];
function remaining() { return state?.endsAt ? Math.max(0, Math.ceil((state.endsAt - Date.now() - offset) / 1000)) : 0; }
function text(heading, description) { $('heading').textContent = heading; $('description').textContent = description; }
function closed() {
  invalid = true; ready = false; socket?.disconnect(); clearTimeout(retryTimer);
  render();
}
function apply(next) {
  if (!next || next.sessionId !== sessionId || (state && next.revision < state.revision)) return;
  if (state?.roundId !== next.roundId || next.hasVoted || next.phase !== 'VOTING') { pending = false; $('feedback').textContent = ''; }
  state = next; offset = next.serverNow - Date.now();
  render();
}
function tick() {
  const seconds = remaining();
  $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  for (const button of $('scores').children) button.disabled = !ready || pending || state?.phase !== 'VOTING' || state.hasVoted || !seconds;
  if (ready && state?.phase === 'VOTING' && !state.hasVoted && !seconds) $('feedback').textContent = 'Süre doldu. Sonuçlar bekleniyor.';
}
function render() {
  tick();
  $('voting').hidden = true; $('result').hidden = true; $('retry').hidden = true;
  document.querySelector('.phone').classList.remove('voted');
  $('round-label').textContent = state?.roundNumber ? `${state.roundNumber} / ${state.totalRounds}` : '';
  if (invalid) { text('Oturum bulunamadı veya sona erdi.', 'Güncel QR kodu okut.'); $('feedback').textContent = ''; return; }
  if (!ready) { text(state ? 'Yeniden bağlanılıyor…' : 'Bağlanılıyor…', 'Bağlantın gelince otomatik devam edeceksin.'); return; }
  switch (state?.phase) {
    case 'LOBBY': text('Hazır mısın?', 'Etkinliğin başlaması bekleniyor.'); break;
    case 'PLAYING': text('Reels izleniyor', 'Gözler büyük ekranda!'); break;
    case 'VOTING':
      if (state.hasVoted) { text('Oyun alındı!', 'Sonuçlar bekleniyor.'); document.querySelector('.phone').classList.add('voted'); $('feedback').textContent = ''; }
      else { text('Puanını ver', ''); $('voting').hidden = false; $('retry').hidden = !$('feedback').textContent || pending; }
      break;
    case 'RESULTS': {
      text('Tur sonucu', 'Sonraki Reels bekleniyor.'); $('result').hidden = false;
      const result = state.result;
      $('result').textContent = result?.status === 'skipped' ? 'Video atlandı' : result?.average == null ? 'Oy kullanılmadı' : `${result.average.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 10`;
      $('feedback').textContent = `${result?.voteCount || 0} oy`; break;
    }
    case 'LEADERBOARD': text('Oyun bitti!', 'Katıldığın için teşekkürler.'); $('feedback').textContent = ''; break;
  }
  tick();
}
function emit(event, payload) {
  return new Promise(resolve => {
    if (!socket?.connected) return resolve({ ok: false, code: 'OFFLINE' });
    socket.volatile.timeout(5000).emit(event, payload, (error, response) => resolve(error ? { ok: false, code: 'TIMEOUT' } : response));
  });
}
async function join() {
  if (invalid || !socket?.connected) return;
  const response = await emit('session:join', { sessionId, token });
  if (response.ok) { ready = true; pending = false; $('feedback').textContent = ''; apply(response.state); }
  else if (['INVALID_SESSION', 'INVALID_PAYLOAD', 'UNAUTHORIZED'].includes(response.code)) closed();
  else { ready = false; render(); clearTimeout(retryTimer); retryTimer = setTimeout(join, 2000); }
}
async function vote(score) {
  if (!ready || pending || !remaining() || state.phase !== 'VOTING' || state.hasVoted) return;
  pending = true; const roundId = state.roundId;
  $('feedback').textContent = 'Oyun gönderiliyor…'; tick();
  const response = await emit('vote:submit', { sessionId, roundId, score });
  if (response.state) apply(response.state);
  if (state?.roundId !== roundId) return;
  if (response.ok || response.code === 'ALREADY_VOTED') { pending = false; render(); }
  else {
    $('feedback').textContent = 'Yanıt alınamadı. Oy durumun kontrol ediliyor…';
    await join();
    if (!state?.hasVoted && state?.phase === 'VOTING' && state.roundId === roundId) {
      pending = false; $('feedback').textContent = 'Oyun henüz alınmadı. Yeniden puan verebilirsin.'; render();
    }
  }
}
for (let score = 1; score <= 10; score++) {
  const button = document.createElement('button'); button.textContent = score; button.setAttribute('aria-label', `${score} puan`); button.addEventListener('click', () => vote(score)); $('scores').append(button);
}
$('retry').addEventListener('click', join);
window.addEventListener('offline', () => { ready = false; pending = false; socket?.disconnect(); if (match) render(); });
window.addEventListener('online', () => { if (!invalid) socket?.connect(); });
if (match) {
  if (!uuid.test(sessionId)) closed();
  else {
    const key = `reels-night:${sessionId}`;
    try { token = localStorage.getItem(key); if (!uuid.test(token || '')) { token = crypto.randomUUID(); localStorage.setItem(key, token); } }
    catch { token = crypto.randomUUID(); }
    socket = window.io({ autoConnect: false });
    socket.on('connect', join);
    socket.on('session:state', apply);
    socket.on('session:closed', closed);
    socket.on('disconnect', () => { ready = false; pending = false; render(); });
    socket.on('connect_error', () => { ready = false; render(); });
    socket.connect(); render(); setInterval(tick, 200);
  }
}
