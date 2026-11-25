import { reelLabel } from './media.js';

export function scoreLabel(result) {
  return result.status === 'skipped' ? 'Video atlandı' : result.average === null ? 'Oy kullanılmadı' : `${result.average.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / 10`;
}
export function createLeaderboard(library) {
  const get = id => document.getElementById(id);
  const list = get('leaderboard-list'), overlay = get('replay-overlay'), video = get('modal-video');
  let returnFocus = null;
  let renderedKey = '';
  const background = get('leaderboard');
  function close() {
    video.pause(); video.removeAttribute('src'); video.load();
    overlay.hidden = true; background.inert = false;
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  }
  function open(result, trigger) {
    const entry = library.entries.get(result.videoId);
    if (!entry || entry.status !== 'ready') return;
    returnFocus = trigger;
    get('modal-title').textContent = reelLabel(result.index);
    get('modal-score').textContent = scoreLabel(result);
    get('modal-error').textContent = '';
    overlay.hidden = false; background.inert = true;
    video.src = entry.url;
    video.play().catch(() => { get('modal-error').textContent = 'Oynatmak için videodaki oynat düğmesine bas.'; });
    get('modal-close').focus();
  }
  get('modal-close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden) { event.preventDefault(); close(); } });
  video.addEventListener('error', () => { if (video.getAttribute('src')) get('modal-error').textContent = 'Video oynatılamadı. Özgün MP4 dosyasını yeniden seç.'; });
  return { close, render(state) {
    const key = JSON.stringify([state.sessionId, state.leaderboard, [...library.entries.values()].map(item => [item.id, item.status, item.thumbnail])]);
    if (key === renderedKey) return;
    renderedKey = key;
    const scroll = list.scrollTop;
    list.replaceChildren();
    get('final-summary').textContent = `${state.results.filter(result => result.status === 'completed').length} tamamlanan Reels · ${state.results.reduce((sum, result) => sum + result.voteCount, 0)} toplam oy`;
    get('download').href = `/api/admin/session/${state.sessionId}/results`;
    if (!state.leaderboard.length) { const text = document.createElement('p'); text.className = 'muted'; text.textContent = 'Henüz puanlanmış video yok.'; list.append(text); }
    let rank = 0;
    for (const result of state.leaderboard) {
      const row = document.createElement('div'); row.className = 'leader-row';
      const ranked = result.average !== null;
      const rankLabel = document.createElement('span'); rankLabel.className = 'rank'; rankLabel.textContent = ranked ? String(++rank).padStart(2, '0') : '—';
      const entry = library.entries.get(result.videoId);
      const preview = document.createElement(entry?.thumbnail ? 'img' : 'span');
      if (entry?.thumbnail) { preview.src = entry.thumbnail; preview.alt = ''; }
      const title = document.createElement('span'); title.className = 'filename'; title.textContent = reelLabel(result.index);
      const count = document.createElement('span'); count.className = 'vote-total'; count.textContent = `${result.voteCount} oy`;
      const score = document.createElement('span'); score.className = ranked ? 'leader-score' : 'unscored'; score.textContent = ranked ? result.average.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : scoreLabel(result);
      const play = document.createElement('button'); play.textContent = 'Tekrar izle'; play.setAttribute('aria-label', `${reelLabel(result.index)} — tekrar izle`); play.disabled = entry?.status !== 'ready';
      if (play.disabled) { play.title = 'Özgün video dosyasını yeniden seç.'; title.textContent += ' · Dosya gerekli'; }
      play.addEventListener('click', () => open(result, play));
      row.append(rankLabel, preview, title, count, score, play); list.append(row);
    }
    list.scrollTop = scroll;
  } };
}
