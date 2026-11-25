import { randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { createEngine, validatePlaylist, isUuid, fail } from './session.js';

export function attachSockets(io, auth, config) {
  let creating = false;
  function revoke(socket) {
    socket.emit('admin:revoked', { code: 'UNAUTHORIZED' });
    socket.disconnect(true);
  }
  const engine = createEngine({ ...config,
    onChange() {
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.admin) {
          if (auth.valid(socket.request)) socket.emit('session:state', engine.snapshot('admin'));
          else revoke(socket);
        } else if (socket.data.sessionId === engine.snapshot()?.sessionId) {
          socket.emit('session:state', engine.snapshot('participant', socket.data.token));
        }
      }
    },
    onWarning(warning) {
      for (const socket of io.sockets.sockets.values()) if (socket.data.admin && auth.valid(socket.request)) socket.emit('admin:warning', warning);
    },
    onClosed(sessionId) {
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.admin || socket.data.sessionId === sessionId) socket.emit('session:closed', { sessionId });
        if (socket.data.sessionId === sessionId) { delete socket.data.sessionId; delete socket.data.token; }
      }
    }
  });
  auth.setOnRevoke(() => { for (const socket of io.sockets.sockets.values()) if (socket.data.admin) revoke(socket); });
  io.use((socket, next) => {
    if (!auth.socketAllowed(socket.request)) return next(new Error('UNAUTHORIZED'));
    socket.data.admin = auth.valid(socket.request);
    next();
  });
  io.on('connection', socket => {
    if (socket.data.admin) {
      for (const other of io.sockets.sockets.values()) {
        if (other.id !== socket.id && other.data.admin) revoke(other);
      }
    }
    let windowStart = Date.now(), events = 0;
    const participantEvents = new Set(['session:join', 'vote:submit']);
    const names = ['session:create', 'admin:resume', 'session:join', 'video:start', 'video:ended', 'video:skip', 'vote:submit', 'vote:extend', 'vote:close', 'session:finish', 'session:close'];
    for (const event of names) socket.on(event, async (payload, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (Date.now() - windowStart > 10_000) { events = 0; windowStart = Date.now(); }
        if (++events > 80) fail('RATE_LIMITED');
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('INVALID_PAYLOAD');
        if (!participantEvents.has(event)) {
          if (!socket.data.admin || !auth.valid(socket.request)) fail('UNAUTHORIZED');
        } else if (socket.data.admin) fail('UNAUTHORIZED');
        if (event === 'admin:resume') return ack({ ok: true, state: engine.snapshot('admin') });
        if (event === 'session:create') {
          if (creating || engine.hasSession()) fail('SESSION_ACTIVE');
          const playlist = validatePlaylist(payload.playlist);
          creating = true;
          try {
            const id = randomUUID();
            const qr = await QRCode.toDataURL(`${config.publicUrl}/join/${id}`, { errorCorrectionLevel: 'M', margin: 4, width: 480 });
            if (!auth.valid(socket.request) || !socket.connected) fail('UNAUTHORIZED');
            engine.create(playlist, id, qr);
            return ack({ ok: true, sessionId: id, state: engine.snapshot('admin') });
          } finally { creating = false; }
        }
        if (!isUuid(payload.sessionId)) fail('INVALID_PAYLOAD');
        if (event === 'session:join') {
          if (!isUuid(payload.token)) fail('INVALID_PAYLOAD');
          if (engine.snapshot()?.sessionId !== payload.sessionId) fail('INVALID_SESSION');
          if (socket.data.sessionId === payload.sessionId && socket.data.token === payload.token) {
            engine.join(payload.sessionId, payload.token, socket.id);
          } else {
            engine.leave(socket.data.sessionId, socket.data.token, socket.id);
            socket.data.sessionId = payload.sessionId;
            socket.data.token = payload.token;
            engine.join(payload.sessionId, payload.token, socket.id);
          }
          return ack({ ok: true, state: engine.snapshot('participant', socket.data.token) });
        }
        if (event.startsWith('vote:') || ['video:ended', 'video:skip'].includes(event)) {
          if (!isUuid(payload.roundId)) fail('INVALID_PAYLOAD');
        }
        if (event === 'vote:submit' && socket.data.sessionId !== payload.sessionId) fail('INVALID_SESSION');
        engine.command(event, payload, socket.data.token);
        ack({ ok: true, ...(event === 'vote:submit' ? { accepted: true } : {}), ...(event === 'session:close' ? {} : { state: engine.snapshot(socket.data.admin ? 'admin' : 'participant', socket.data.token) }) });
      } catch (error) {
        const codes = ['UNAUTHORIZED', 'INVALID_PAYLOAD', 'INVALID_SESSION', 'SESSION_ACTIVE', 'INVALID_PHASE', 'STALE_ROUND', 'VOTE_CLOSED', 'ALREADY_VOTED', 'INVALID_SCORE', 'RATE_LIMITED'];
        const code = codes.includes(error.code) ? error.code : 'INTERNAL_ERROR';
        const authorized = socket.data.admin && auth.valid(socket.request);
        const member = socket.data.sessionId === engine.snapshot()?.sessionId;
        ack({ ok: false, code, ...((authorized || member) ? { state: engine.snapshot(authorized ? 'admin' : 'participant', socket.data.token) } : {}) });
      }
    });
    socket.on('disconnect', () => engine.leave(socket.data.sessionId, socket.data.token, socket.id));
  });
  return engine;
}
