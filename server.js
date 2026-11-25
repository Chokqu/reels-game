import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAuth } from './src/auth.js';
import { attachSockets } from './src/socket.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const { ADMIN_TOKEN: adminToken, PUBLIC_URL: rawUrl, HOST: host = '127.0.0.1', PORT: rawPort = '3000' } = process.env;
let publicUrl;
try {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
  publicUrl = url.origin;
} catch { console.error('PUBLIC_URL must be an HTTP(S) origin without path, query or credentials.'); process.exit(1); }
if (!adminToken || adminToken.length < 32 || adminToken.length > 512 || /replace|change.?me|your.?secret/i.test(adminToken)) {
  console.error('ADMIN_TOKEN must be a real secret of 32–512 characters. Generate it with openssl rand -hex 32.'); process.exit(1);
}
const port = Number(rawPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('PORT must be an integer from 1 to 65535.'); process.exit(1); }
const app = express();
app.disable('x-powered-by');
const auth = createAuth({ adminToken, publicUrl });
app.use((req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !auth.originAllowed(req.headers.origin)) return res.status(403).json({ ok: false, code: 'UNAUTHORIZED' });
  next();
});
app.use(express.json({ limit: '64kb' }));
const server = createServer(app);
const io = new Server(server, { maxHttpBufferSize: 64 * 1024, cors: { origin: publicUrl, credentials: true }, allowRequest: (req, done) => done(null, auth.socketAllowed(req)) });
io.engine.use((req, res, next) => {
  if (!auth.socketAllowed(req)) return next(new Error('UNAUTHORIZED'));
  next();
});
const engine = attachSockets(io, auth, { publicUrl, resultsDir: path.join(root, 'data/results') });
app.get('/health', (req, res) => res.json({ ok: true }));
app.post('/api/admin/login', auth.login);
app.post('/api/admin/logout', auth.requireAdmin, auth.logout);
app.get('/api/admin/me', auth.requireAdmin, (req, res) => res.json({ authenticated: true }));
app.get('/api/admin/session', auth.requireAdmin, (req, res) => res.json({ state: engine.snapshot('admin') }));
app.get('/api/admin/session/:id/results', auth.requireAdmin, async (req, res) => {
  try {
    const data = await engine.getResults(req.params.id);
    res.attachment(`reels-game-${data.sessionId}.json`).json(data);
  } catch { res.status(404).json({ ok: false, code: 'INVALID_SESSION' }); }
});
app.get(['/', '/join/:sessionId'], (req, res) => res.sendFile(path.join(root, 'public/index.html')));
app.get(['/admin', '/admin/setup', '/admin/session/:id', '/admin/session/:id/leaderboard'], (req, res) => res.sendFile(path.join(root, 'public/admin.html')));
app.use(express.static(path.join(root, 'public'), { index: false, dotfiles: 'deny' }));
app.use((req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND' }));
app.use((error, req, res, next) => { res.status(error.type === 'entity.too.large' ? 413 : 400).json({ ok: false, code: 'INVALID_PAYLOAD' }); });
server.listen(port, host, () => console.log(`Reels Game listening on http://${host}:${port}`));
server.on('error', error => { console.error(`Server could not listen: ${error.code || 'UNKNOWN'}`); process.exitCode = 1; });
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  io.disconnectSockets(true);
  await engine.shutdown();
  io.close(() => { server.close(); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
