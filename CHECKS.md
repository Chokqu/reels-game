# Executed acceptance checks

Executed 2026-11-25 using Node 22.17.0, npm 11.4.2, native Node assertions, Socket.IO clients and real headless Google Chrome on macOS. Smoke tools, generated MP4s and screenshots were kept outside the repository. No automated test suite or extra application dependency was added. This is an MVP rehearsal, not a capacity or cross-browser certification.

| Check from the specification | Outcome and evidence |
| --- | --- |
| Clean install / start without build | **PASS** — `npm ci`, `npm start`, `/health`; exactly Express, Socket.IO and qrcode at runtime. `npm audit --omit=dev` reported zero vulnerabilities. |
| Configuration validation | **PASS** — missing/placeholder secret, path-bearing public URL and invalid port all rejected at startup. |
| Login, cookie and authorization | **PASS** — wrong secret rejected, valid login accepted, HttpOnly/SameSite cookie inspected, HTTPS Secure flag checked; unauthenticated state/export and participant admin commands rejected. New login revokes old credentials/sockets; logout tested. |
| Origin/security headers/static isolation | **PASS** — hostile HTTP Origin and socket handshake rejected; existing polling-session WebSocket upgrade with hostile Origin rejected after a reproduced defect was fixed. Same-origin browser polling works without Origin using Fetch Metadata. Specs, `.env`, source, node_modules and backups return 404. 64 KB HTTP body cap exercised. |
| One host / concurrent session creation | **PASS** — a second authenticated admin socket disconnects the former; simultaneous creation commands produce one session and one `SESSION_ACTIVE` response. |
| Secrets / public payload | **PASS** — participant snapshots contain no filenames, playlist, QR data, credentials or live distribution. JSON export inspected for absence of anonymous token and admin secret. `.env`, dependencies and generated result files verified ignored by Git. |
| Loopback / public HTTPS | **PASS locally** — listener inspected at `127.0.0.1:3000`. **NOT RUN publicly** — no real domain/tunnel/server target supplied or changed. |
| Import three MP4s and invalid media | **PASS** — three generated H.264/AAC portrait MP4s produced PNG thumbnails and two-second durations; unreadable MP4 showed safe error and was unselectable. |
| Selection / ordering / removal / no upload | **PASS** — deselected the second file, moved the third ahead of the first, removed the invalid file. Session contained only that selected order. Browser request capture found no media-upload request; files remained blob URLs. |
| Empty / oversized playlist / unique IDs / QR | **PASS** — zero and over-100 playlists rejected, active session creation rejected, closed/new sessions have distinct UUIDs. QR decoded from actual voting, results, final and blurred-overlay screenshots. **NOT RUN** — physical camera scan at projector distance. |
| Projector / mobile layout | **PASS** — screenshots visually inspected at 1280×720 and 1920×1080. Document height matched viewport; QR 160px / 240px respectively, controls visible. 320×640 and 390×844 phone views checked; no horizontal overflow, ten buttons fit. **NOT RUN** — physical projector and actual iOS/Android rendering. |
| Joining / presence | **PASS** — two isolated browser contexts joined without signup; same-token socket tabs counted once. WebSocket and polling transport paths both exercised. Invalid sessions rejected. |
| Initial video → automatic voting | **PASS** — actual video playback naturally opened 15-second voting; duplicate ended command rejected; current scores withheld until close. |
| Votes / duplicates / results | **PASS** — scores 8 and 10 produced two votes, average 9.00 and correct histogram. Same-token second tab rejected; reconnect preserved voted status. |
| Invalid and late votes | **PASS** — 0, 11, decimal and string scores rejected; wrong round/session rejected; no votes accepted after deadline. |
| Extension / close / all voted | **PASS** — deadline increased by exactly 5000 ms, browser timer updated, manual close worked. Original no-early-close behavior passed initially; superseded by the later operator request for automatic closure when everyone connected has voted. Duplicate close could not add results. |
| Timer independent of host | **PASS** — admin disconnected during voting; server deadline still closed exactly one round. |
| Zero votes / skip / unplayed clips | **PASS** — zero-vote average null; skipped result marked with no invented votes; early finish excluded the unplayed fourth item. |
| Replay isolation / manual advance | **PASS** — real video replay during voting preserved vote count and open phase; result replay did not reopen voting. Next round began only after host action. |
| Participant reconnect / late join | **PASS** — same token recovered accepted vote, same-browser reload retained voted screen, new connection during voting received active state. Counts decreased on disconnect without removing votes. Offline phone disabled controls immediately after fix. **NOT RUN** — physical airplane-mode and venue network behavior. |
| Admin offline end / reload | **PASS** — offline host disabled controls while local video ended; phone stayed in watching phase until host reconnected, then voting opened. Reload restored active voting state without files; exact original files reattached under unchanged IDs. |
| Sorting | **PASS** — full-precision means sort before vote counts, including a case where both displayed scores round identically. Exact ties resolved by vote count then original index. Zero-vote/skipped results remain unranked. |
| Final replay / QR / focus | **PASS** — separate modal player played original local file; blurred main content left QR scannable. Escape paused/detached video and restored replay-button focus; leaderboard remained unchanged. |
| Export / backups / write failure | **PASS** — browser downloaded valid JSON; authenticated export matched disk backup. Simulated unwritable results path raised admin-only warning while the engine continued. |
| Close / restart | **PASS** — close reset setup and invalidated old QR. Real server restart discarded active game/auth; prior saved JSON remained downloadable after login. |
| Console / final review | **PASS** — final browser smoke had no JavaScript exceptions. Manual source review checked guards, snapshot privacy, media lifetime, replay separation and persistence. No subagents were used. |

## Fixes made during checks

- Disconnecting an unjoined/admin socket after game closure could access a null session. Added the missing session guard and repeated the full protocol smoke.
- Same-origin polling omitted Origin in Chrome. Allowed browser-asserted `Sec-Fetch-Site: same-origin` when Origin is absent, while rejecting foreign Origin even if that header claims same-origin.
- Added origin enforcement to every Engine.IO request, including upgrades with an existing session ID.
- Added browser offline/online handlers and immediate score-button disabling; verified pending initial-video end recovery in real browser execution.

## Operator checks still required

Use the README event-day checklist for real HTTPS through the existing tunnel, iPhone Safari, Android Chrome, projector/audio, back-of-room QR readability, mobile data, venue Wi-Fi and the expected audience size. No external deployment or load guarantee is claimed. Native video-fullscreen suppression should be checked in the chosen host browser; whole-browser fullscreen preserves the QR rail.

## Operator update — automatic closure and Reels Game naming

**PASS (2026-11-25):** Native smoke checks verified automatic closure on the last connected participant's vote, shared-token tabs, preservation of disconnected votes without substituting for missing votes, closure when only voted participants remain, no early closure with zero participants, and exactly one terminal result. Static checks verified Reels Game branding, consistent package/lockfile names, and removal of the QR rail's URL/copy controls while retaining the QR image. JavaScript syntax checks passed. This update supersedes the original no-automatic-close requirement. The running live server was not restarted to avoid losing the operator's active session.

## Operator update — hide original filenames

**PASS (2026-11-25):** An isolated loopback server and real headless Chrome checked that an identifiable original filename never appeared in the setup library, selected order, duplicate-file warning, live caption, leaderboard, replay title, HTML attributes/accessibility labels or exported JSON. Numbered Reels labels appeared instead; no browser JavaScript exceptions occurred. Original filenames remain only in private metadata for exact reattachment. The existing live server and its session were left untouched.
