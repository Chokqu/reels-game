import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import path from 'node:path';

export const isUuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function fail(code) { throw Object.assign(new Error(code), { code }); }
const histogram = () => Array(10).fill(0);

export function validatePlaylist(playlist) {
  if (!Array.isArray(playlist) || playlist.length < 1 || playlist.length > 100) fail('INVALID_PAYLOAD');
  const seen = new Set();
  return playlist.map(item => {
    if (!item || !isUuid(item.id) || seen.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 180 || /[\x00-\x1f]/.test(item.name) || !Number.isSafeInteger(item.size) || item.size < 0 || !Number.isFinite(item.lastModified) || item.lastModified < 0 || !Number.isFinite(item.duration) || item.duration <= 0) fail('INVALID_PAYLOAD');
    seen.add(item.id);
    return Object.freeze({ id: item.id, name: item.name, size: item.size, lastModified: item.lastModified, duration: item.duration });
  });
}

export function createEngine({ resultsDir, publicUrl, onChange = () => {}, onWarning = () => {}, onClosed = () => {} }) {
  let session = null;
  let writes = Promise.resolve();
  let backupFailed = false;
  function touch() {
    session.revision++;
    session.updatedAt = Date.now();
    onChange();
  }
  function requireSession(id) {
    if (!session || session.id !== id) fail('INVALID_SESSION');
    return session;
  }
  function requireRound(id) {
    if (!session.round || session.round.id !== id) fail('STALE_ROUND');
    return session.round;
  }
  function requirePhase(...phases) { if (!phases.includes(session.phase)) fail('INVALID_PHASE'); }
  function leaderboard() {
    return session.results.map(result => ({ ...result, name: `Reels ${String(result.index + 1).padStart(2, '0')}` })).sort((a, b) => {
      if (a.average === null && b.average === null) return a.index - b.index;
      if (a.average === null) return 1;
      if (b.average === null) return -1;
      return b.average - a.average || b.voteCount - a.voteCount || a.index - b.index;
    });
  }
  function exportData(finalized = session.phase === 'LEADERBOARD') {
    return { version: 1, sessionId: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt, finalized,
      playlist: session.playlist.map((video, index) => ({ id: video.id, name: `Reels ${String(index + 1).padStart(2, '0')}`, index })), results: session.results, leaderboard: leaderboard() };
  }
  function persist(finalized) {
    const id = session.id;
    const contents = JSON.stringify(exportData(finalized));
    writes = writes.then(async () => {
      await mkdir(resultsDir, { recursive: true });
      const target = path.join(resultsDir, `${id}.json`);
      await writeFile(`${target}.tmp`, contents, { mode: 0o600 });
      await rename(`${target}.tmp`, target);
    }).catch(() => {
      backupFailed = true;
      console.error('Result backup failed; check data/results permissions and disk space.');
      onWarning({ code: 'BACKUP_FAILED' });
    });
  }
  function finalize(status = 'completed') {
    const round = session.round;
    clearTimeout(round.timer);
    round.timer = null;
    const distribution = histogram();
    for (const score of round.votes.values()) distribution[score - 1]++;
    const voteCount = round.votes.size;
    const average = voteCount ? distribution.reduce((sum, count, index) => sum + count * (index + 1), 0) / voteCount : null;
    session.results.push({ roundId: round.id, videoId: round.videoId, index: round.index, status, average, voteCount, distribution, completedAt: Date.now() });
    round.status = status;
    session.phase = 'RESULTS';
    touch();
    persist(false);
  }
  function closeIfEveryoneVoted() {
    if (session.phase !== 'VOTING' || session.eligibleConnections.size === 0) return false;
    if (![...session.eligibleConnections.keys()].every(token => session.round.votes.has(token))) return false;
    finalize();
    return true;
  }
  function expire() {
    if (session?.phase === 'VOTING' && Date.now() >= session.round.endsAt) { finalize(); return true; }
    return false;
  }
  function schedule() {
    const sessionId = session.id, roundId = session.round.id, deadline = session.round.endsAt;
    clearTimeout(session.round.timer);
    session.round.timer = setTimeout(() => {
      if (session?.id !== sessionId || session.phase !== 'VOTING' || session.round.id !== roundId || session.round.endsAt !== deadline) return;
      if (!expire()) schedule();
    }, Math.max(1, deadline - Date.now()));
  }
  function create(playlist, id, qrImage) {
    if (session) fail('SESSION_ACTIVE');
    const now = Date.now();
    backupFailed = false;
    session = { id, phase: 'LOBBY', createdAt: now, updatedAt: now, revision: 1, playlist: Object.freeze(playlist), currentIndex: -1, round: null, results: [], eligibleConnections: new Map(), joinUrl: `${publicUrl}/join/${id}`, qrImage };
    onChange();
  }
  function command(event, payload, token) {
    requireSession(payload.sessionId);
    if (event.startsWith('vote:') || ['video:ended', 'video:skip'].includes(event)) requireRound(payload.roundId);
    if (event.startsWith('vote:')) {
      if (expire() || session.phase !== 'VOTING') fail('VOTE_CLOSED');
    }
    switch (event) {
      case 'video:start': {
        requirePhase('LOBBY', 'RESULTS');
        const index = session.currentIndex + 1;
        if (index >= session.playlist.length) fail('INVALID_PHASE');
        session.currentIndex = index;
        session.round = { id: randomUUID(), videoId: session.playlist[index].id, index, startedAt: Date.now(), endsAt: null, votes: new Map(), status: 'playing', timer: null };
        session.phase = 'PLAYING';
        touch();
        break;
      }
      case 'video:ended':
        requirePhase('PLAYING');
        session.phase = 'VOTING';
        session.round.status = 'voting';
        session.round.endsAt = Date.now() + 15_000;
        schedule(); touch(); break;
      case 'video:skip': requirePhase('PLAYING'); finalize('skipped'); break;
      case 'vote:submit':
        if (!session.eligibleConnections.has(token)) fail('INVALID_SESSION');
        if (!Number.isInteger(payload.score) || payload.score < 1 || payload.score > 10) fail('INVALID_SCORE');
        if (session.round.votes.has(token)) fail('ALREADY_VOTED');
        session.round.votes.set(token, payload.score);
        if (!closeIfEveryoneVoted()) touch();
        break;
      case 'vote:extend': session.round.endsAt += 5000; schedule(); touch(); break;
      case 'vote:close': finalize(); break;
      case 'session:finish': requirePhase('LOBBY', 'RESULTS'); session.phase = 'LEADERBOARD'; touch(); persist(true); break;
      case 'session:close': {
        requirePhase('LEADERBOARD');
        clearTimeout(session.round?.timer);
        persist(true);
        const id = session.id;
        session = null;
        onClosed(id);
        break;
      }
      default: fail('INVALID_PAYLOAD');
    }
  }
  function join(id, token, socketId) {
    requireSession(id);
    expire();
    let connections = session.eligibleConnections.get(token);
    if (!connections) session.eligibleConnections.set(token, connections = new Set());
    const changed = connections.size === 0;
    connections.add(socketId);
    if (changed && !closeIfEveryoneVoted()) touch();
  }
  function leave(id, token, socketId) {
    if (!session || session.id !== id) return;
    const connections = session.eligibleConnections.get(token);
    if (!connections) return;
    connections.delete(socketId);
    if (!connections.size) {
      session.eligibleConnections.delete(token);
      if (!closeIfEveryoneVoted()) touch();
    }
  }
  function snapshot(role = 'participant', token) {
    if (!session) return null;
    const round = session.round;
    const terminal = ['RESULTS', 'LEADERBOARD'].includes(session.phase);
    const lastResult = terminal && round ? session.results.find(result => result.roundId === round.id) : null;
    const state = { sessionId: session.id, revision: session.revision, phase: session.phase, serverNow: Date.now(), roundId: round?.id ?? null, roundNumber: round ? round.index + 1 : 0, totalRounds: session.playlist.length, endsAt: round?.endsAt ?? null, connectedCount: session.eligibleConnections.size, voteCount: round?.votes.size ?? 0, hasVoted: Boolean(token && round?.votes.has(token)), result: lastResult ? { average: lastResult.average, voteCount: lastResult.voteCount, distribution: lastResult.distribution, status: lastResult.status } : null };
    if (role === 'admin') Object.assign(state, { playlist: session.playlist, currentIndex: session.currentIndex, currentRound: round ? { id: round.id, videoId: round.videoId, index: round.index, startedAt: round.startedAt, endsAt: round.endsAt, status: round.status } : null, results: session.results, leaderboard: leaderboard(), joinUrl: session.joinUrl, qrImage: session.qrImage, backupFailed });
    return state;
  }
  async function getResults(id) {
    if (!isUuid(id)) fail('INVALID_SESSION');
    if (session?.id === id) return exportData();
    try { return JSON.parse(await readFile(path.join(resultsDir, `${id}.json`), 'utf8')); }
    catch { fail('INVALID_SESSION'); }
  }
  return { create, command, join, leave, snapshot, getResults, hasSession: () => Boolean(session), shutdown: async () => { clearTimeout(session?.round?.timer); await writes; } };
}
