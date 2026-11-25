# 08 — Deployment, rehearsal and acceptance

## Configuration

Assumptions: operator controls an existing server and a Cloudflare-managed domain. Actual server OS, tunnel name and domain are not supplied; use placeholders and do not invent working credentials. Node 22+ supported LTS, npm, git and cloudflared available or installed by operator according to their OS. Use an existing unprivileged service user. Avoid root for application. Keep server process and tunnel alive throughout event. Do not expose application port publicly.

`.env.example`:

```dotenv
HOST=127.0.0.1
PORT=3000
PUBLIC_URL=http://localhost:3000
ADMIN_TOKEN=replace-with-a-random-secret
```

Production PUBLIC_URL is exact HTTPS origin (e.g. `https://reels.example.com`, placeholder). Generate token with `openssl rand -hex 32` and store locally, never commit. `.gitignore` covers `.env`, `.env.*` except `.env.example`, node_modules, temporary logs, local media, `data/results/*.json` and temp backup files. Protect `.env` permissions. Fail startup with helpful message if placeholder token or missing required vars. Use actual domain in PUBLIC_URL before QR generation.

## Local run

```sh
npm ci
cp .env.example .env
# edit .env: choose a real random ADMIN_TOKEN
npm start
```

Open http://localhost:3000/admin. Local localhost works for browser secure-context APIs; participant tests on other devices use HTTPS tunnel rather than a plain LAN IP. Verify `curl http://127.0.0.1:3000/health` yields ok. Local QR pointing at localhost will NOT work from phones; use real PUBLIC_URL during device rehearsal.

## Server run

```sh
git clone <repository-url>
cd reels-night
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
# edit PUBLIC_URL and ADMIN_TOKEN; set free PORT if 3000 already in use
npm start
```

Use existing process supervisor (systemd/user service or tmux for short event). No Docker required. Do not start clustered Node processes; all game state is in one process. Use same working directory for results backup. Check log output for local bind and startup, never print admin token.

## Cloudflare Tunnel

Preferred: reuse existing named tunnel and add a public hostname `reels.<your-domain>` → HTTP service `http://127.0.0.1:3000` in Cloudflare dashboard (Networks/Tunnels or current equivalent). If operator uses locally managed tunnel, add ingress to existing config without deleting other services:

```yaml
# illustrative fragment; preserve existing credentials and ingress
 ingress:
   - hostname: reels.example.com
     service: http://127.0.0.1:3000
   # other existing hostnames go here
   - service: http_status:404
```

Use the operator's existing tunnel authentication and DNS route; if needed for a locally managed tunnel, `cloudflared tunnel route dns <tunnel-name> reels.example.com` then run/reload existing tunnel with its normal service/config. Dashboard-managed and locally managed configurations differ; do not overwrite one with the other. Ensure DNS hostname not already in use. Cloudflare forwards WebSocket upgrades and Socket.IO polling; verify actual connectivity. Set cache bypass for application paths if custom caching rules exist; no challenges that break Socket.IO. The tunnel is outbound; no inbound port 3000 required. Keep existing exposed services protected separately. Cloudflare Tunnel is not Wrangler; no Workers or Vercel deployment required.

Temporary rehearsal fallback: `cloudflared tunnel --url http://127.0.0.1:3000` generates a temporary HTTPS origin. Set PUBLIC_URL to exact generated address and restart app before creating session. Temporary URL changes and availability is not guaranteed. Do not mix named tunnel and quick tunnel URLs in the same game. Named tunnel preferred for event.

## Acceptance checklist (actual execution required)

Mark each as PASS, FAIL or NOT RUN with reason. Agent may use browser tooling and native Node smoke commands where available; operator must do real-phone checks. No invented test results.

### Startup/security
- npm ci and npm start succeed on supported Node, no build.
- `/health` responds, admin login fails with bad token and works with configured token.
- Unauthorized HTTP result export and unauthorized socket admin commands rejected.
- QR and participant payload contain no token/credential. Invalid session rejected. Same-origin restrictions work. Secret not in git or logs.
- Port bound loopback only in production; public HTTPS origin works through tunnel.

### Setup and media
- Choose at least 3 playable short MP4s; thumbnails, filenames, duration appear; unreadable file error safe.
- Deselect one, reorder remaining, add/remove before session. Only selected order used. No video uploaded (check network requests if tools available).
- Create game produces unique UUID and real scannable QR. Double click cannot create two sessions. No zero-video session.
- Projector layout at 1280×720 and 1920×1080; QR stays visible and readable, no controls off-screen. Phone 320–390px no horizontal overflow.

### Real voting path
- Two distinct browser contexts join by QR without signup; connected count correct.
- Start initial video; phones show watching. End automatically starts 15-second voting exactly once. No scores leaked before close.
- Vote 8 and 10; host sees 2 votes; second vote from same token rejected; after close mean 9.00, correct histogram.
- Invalid 0/11/decimal score, wrong round, stale session rejected. At deadline no late votes accepted. Timer closes even if admin disconnects.
- +5 extends exactly five seconds and phones update; manual close before deadline works; timer cannot close twice. All participants voting does not force immediate closure.
- Zero votes gives null/unscored, no NaN or zero-as-mean. Skip creates skipped result, not fake score.
- Replaying during vote keeps deadline and votes; replay after result does not open another vote. Next manual only. Final after last result shows ranked results correctly.

### Reconnect and final
- Vote, turn phone airplane mode on/off, rescan QR or reload same browser: current phase and voted status restored; no duplicate. New phone joining mid-vote sees remaining time. Disconnect count adjusts without discarding accepted vote.
- Admin network drop while local video ends: reconnect snapshot and pending ended behavior correct. Admin reload: resume phase and reselect local files; missing clips don't corrupt mapping.
- Leaderboard order uses unrounded mean, count, original order. Zero-vote/skipped labeled. Modal replay opens, blurs main content, keeps QR visible, close pauses video and returns focus/scroll; no new vote.
- Export valid JSON and inspect disk backup after round/finish. No raw tokens or media. Simulated backup failure visible to admin without stopping game if feasible.
- Close game, old QR invalid; new session new ID. On server restart active game lost as documented; completed backups still exportable by authenticated route.

## Event-day operator checklist

1. Have all intended MP4s in one local folder, known playable in projector browser, with audio tested. Keep permitted copies available offline. Disable system sleep on host, plug power, silence notifications; don't project token entry.
2. Start single Node process and Cloudflare tunnel; confirm public HTTPS and health; verify mobile data and venue Wi-Fi separately. Real iPhone Safari and Android Chrome if available. Test QR from back of room, audio, projector aspect ratio and voting/replay with two phones.
3. Create rehearsal session, do one round, close it; create fresh real session before audience scans. Keep QR rail visible, use browser fullscreen only if it preserves layout. Avoid admin hard refresh; keep originals at hand for reattach.
4. During event watch connected and accepted vote counts independently; extend if needed; do not restart server mid-game. If tunnel/Internet hiccup, let phones reconnect, use +5 only while voting still open. If server dies, prior JSON results survive but active game does not; create new session or use manual scoring for remaining videos.
5. Show final leaderboard, replay selected clip(s), download JSON and close session. Stop service/tunnel if dedicated to this event; don't interrupt unrelated existing services. Keep only result backup as needed.

## Accepted trade-offs

One process and RAM simplify deployment; restart loses active state. Browser token prevents accidental duplicate votes, not deliberate multi-browser abuse. Local file references disappear on hard reload; reattach needed. No guarantee free tunnel/network availability or capacity; rehearsal matters. Domain and server setup are operator-specific and not performed by this specification. No app or code is delivered by the documentation ZIP itself: coding agent must implement and verify it.
