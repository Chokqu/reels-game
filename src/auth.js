import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createAuth({ adminToken, publicUrl }) {
  const digest = value => createHash('sha256').update(value).digest();
  const expected = digest(adminToken);
  const secure = publicUrl.startsWith('https:');
  const cookieName = 'reels_admin';
  let credential = null;
  let expiresAt = 0;
  let onRevoke = () => {};
  const attempts = new Map();

  function valid(request) {
    const cookies = request.headers.cookie || '';
    const value = cookies.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return Boolean(credential && Date.now() < expiresAt && value && timingSafeEqual(digest(value), digest(credential)));
  }
  function originAllowed(origin) { return origin === publicUrl; }
  function socketAllowed(request) {
    // Same-origin browser polling can omit Origin; Fetch Metadata still identifies it.
    const origin = request.headers.origin;
    return originAllowed(origin) || (!origin && request.headers['sec-fetch-site'] === 'same-origin');
  }
  function revoke() {
    credential = null;
    expiresAt = 0;
    onRevoke();
  }
  function cookie(value, age) {
    return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? '; Secure' : ''}`;
  }
  function requireAdmin(req, res, next) {
    if (!valid(req)) return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
    next();
  }
  function login(req, res) {
    const now = Date.now();
    for (const [key, bucket] of attempts) if (bucket.until <= now) attempts.delete(key);
    const ip = req.socket.remoteAddress;
    let bucket = attempts.get(ip);
    if (!bucket) {
      if (attempts.size >= 1000) return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
      bucket = { count: 0, until: now + 60_000 };
      attempts.set(ip, bucket);
    }
    if (++bucket.count > 10) return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
    const token = req.body?.token;
    if (typeof token !== 'string' || token.length > 512 || !timingSafeEqual(digest(token), expected)) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
    }
    revoke();
    credential = randomBytes(32).toString('hex');
    expiresAt = now + 8 * 60 * 60 * 1000;
    res.setHeader('Set-Cookie', cookie(credential, 8 * 60 * 60));
    res.json({ ok: true });
  }
  function logout(req, res) {
    revoke();
    res.setHeader('Set-Cookie', cookie('', 0));
    res.json({ ok: true });
  }
  return { valid, originAllowed, socketAllowed, requireAdmin, login, logout, setOnRevoke(fn) { onRevoke = fn; } };
}
