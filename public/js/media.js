export function reelLabel(index) {
  return `Reels ${String(index + 1).padStart(2, '0')}`;
}

export function formatDuration(seconds) {
  const value = Math.round(seconds || 0);
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
export function createLibrary(onChange) {
  const entries = new Map();
  let order = [];
  let busy = false;
  const signature = file => JSON.stringify([file.name, file.size, file.lastModified]);
  function release(entry) {
    if (entry.url) URL.revokeObjectURL(entry.url);
    if (entry.thumbnail) URL.revokeObjectURL(entry.thumbnail);
  }
  function waitFor(video, event, action) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error('MEDIA_TIMEOUT')), 12_000);
      const success = () => finish();
      const error = () => finish(new Error('MEDIA_ERROR'));
      function finish(problem) {
        clearTimeout(timer); video.removeEventListener(event, success); video.removeEventListener('error', error);
        problem ? reject(problem) : resolve();
      }
      video.addEventListener(event, success, { once: true });
      video.addEventListener('error', error, { once: true });
      action();
    });
  }
  async function inspect(entry) {
    const video = document.createElement('video');
    video.preload = 'auto'; video.muted = true; video.playsInline = true;
    try {
      if (!/\.mp4$/i.test(entry.name)) throw new Error('NOT_MP4');
      await waitFor(video, 'loadeddata', () => { video.src = entry.url; video.load(); });
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) throw new Error('MEDIA_ERROR');
      entry.duration = video.duration;
      try {
        const target = Math.min(1, video.duration / 2);
        if (Math.abs(video.currentTime - target) > 0.001) await waitFor(video, 'seeked', () => { video.currentTime = target; });
        const scale = Math.min(360 / video.videoWidth, 360 / video.videoHeight, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) entry.thumbnail = URL.createObjectURL(blob);
      } catch { entry.warning = 'Önizleme oluşturulamadı; video oynatılabilir.'; }
      entry.status = 'ready';
    } catch { entry.status = 'error'; entry.warning = 'Video açılamadı. H.264 / AAC biçiminde bir MP4 seç.'; }
    finally { video.pause(); video.removeAttribute('src'); video.load(); }
  }
  async function add(files, playlist = null) {
    if (busy) return ['Dosyalar hazırlanıyor. Lütfen bekle.'];
    busy = true; onChange();
    const messages = [];
    const list = Array.from(files);
    try {
      for (const file of list) {
        let id = crypto.randomUUID();
        if (playlist) {
          const matches = playlist.filter(item => signature(item) === signature(file));
          if (matches.length !== 1 || list.filter(item => signature(item) === signature(file)).length !== 1) {
            messages.push('Seçilen videolardan biri eşleşmedi veya birden fazla eşleşme bulundu. Özgün videoyu seç.'); continue;
          }
          id = matches[0].id;
          if (entries.get(id)?.status === 'ready') continue;
        } else if ([...entries.values()].some(item => signature(item) === signature(file))) {
          messages.push('Seçilen videolardan biri zaten eklenmiş. Farklı bir videoysa dosyasını yeniden adlandırıp ekle.'); continue;
        }
        if (file.name.length > 180 || /[\x00-\x1f]/.test(file.name)) { messages.push('Dosya adı en fazla 180 karakter olmalı ve kontrol karakteri içermemeli.'); continue; }
        if (entries.has(id)) release(entries.get(id));
        const entry = { id, file, name: file.name, size: file.size, lastModified: file.lastModified, url: URL.createObjectURL(file), thumbnail: null, duration: 0, status: 'loading' };
        entries.set(id, entry); onChange();
        await inspect(entry);
        if (!playlist && entry.status === 'ready') order.push(id);
        onChange();
      }
    } finally { busy = false; onChange(); }
    return messages;
  }
  return { entries, add, get busy() { return busy; }, get selected() { return order.map(id => entries.get(id)).filter(Boolean); },
    toggle(id) { if (entries.get(id)?.status !== 'ready') return; order = order.includes(id) ? order.filter(value => value !== id) : [...order, id]; onChange(); },
    move(id, delta) { const index = order.indexOf(id), next = index + delta; if (index < 0 || next < 0 || next >= order.length) return; [order[index], order[next]] = [order[next], order[index]]; onChange(); },
    remove(id) { const entry = entries.get(id); if (!entry) return; release(entry); entries.delete(id); order = order.filter(value => value !== id); onChange(); },
    clear() { for (const entry of entries.values()) release(entry); entries.clear(); order = []; onChange(); },
    metadata() { return order.map(id => { const { name, size, lastModified, duration } = entries.get(id); return { id, name, size, lastModified, duration }; }); }
  };
}

export function createPlayer(video, { onEnded, onError }) {
  let context = null;
  video.addEventListener('ended', () => {
    if (context?.mode === 'initial' && !context.ended && video.ended) { context.ended = true; onEnded(context.roundId); }
  });
  video.addEventListener('error', () => { if (video.getAttribute('src')) onError('Video oynatılamadı. Dosyayı yeniden seçebilir veya bu videoyu atlayabilirsin.'); });
  return {
    get context() { return context; },
    load(round, entry, initial) {
      video.pause();
      context = round ? { roundId: round.id, videoId: round.videoId, mode: initial ? 'initial' : 'replay', ended: false } : null;
      if (entry?.url) { video.src = entry.url; if (entry.thumbnail) video.poster = entry.thumbnail; else video.removeAttribute('poster'); }
      else { video.removeAttribute('src'); video.removeAttribute('poster'); }
      video.load();
    },
    async play(replay = false) {
      if (!context || !video.getAttribute('src')) return;
      if (replay) { context.mode = 'replay'; video.currentTime = 0; }
      try { await video.play(); } catch { onError('Oynatmak için “Videoyu oynat” düğmesine bas.'); }
    },
    stop() { video.pause(); },
    clear() { context = null; video.pause(); video.removeAttribute('src'); video.removeAttribute('poster'); video.load(); }
  };
}
