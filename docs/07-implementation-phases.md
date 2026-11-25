# 07 — Execution phases (one coding session)

Read every spec before starting. Phases are internal sequencing, not separate deliverables or UI labels. Keep working until phase 09. Time-box optional polish; prioritize working game. Do not switch stack.

| Phase | Depends on | Required output |
|---|---|---|
| 01 Server foundation | none | Express, HTTP, static shell, auth, config |
| 02 Session engine | 01 | deterministic transitions, votes, deadline, JSON |
| 03 Socket protocol | 02 | role-safe snapshots, reconnection, acks |
| 04 Local media | 01 | media library, thumbnails, playback context |
| 05 Setup UI | 03,04 | login, file selection, ordering, session creation |
| 06 Live admin | 03,04,05 | QR rail, player, timer, controls, results |
| 07 Participant UI | 03 | QR join, mobile voting, reconnect |
| 08 Leaderboard | 06 | ranking, replay overlay, JSON export, close |
| 09 Integration/deploy | all | run checks, README, operational handoff |

## 01 — Foundation

Inspect repository, create package manifest with type module, scripts start/dev if useful, install exactly three runtime packages and lockfile. Implement validated config, no-store responses, static route shells, login/me/logout, auth cookie, origin checks, rate limits and health. Ensure secrets not tracked. Verify local server starts and protected endpoint rejects unauthenticated requests. Basic HTML may be bare until UI phases.

## 02 — Session engine

Implement plain single-session state and engine functions in src/session.js, including transitions, revision increments, immutable playlist, current round, unique vote map, deadline scheduler, skip, results sorting and export. Avoid duplication between timeout and manual close. Implement JSON backup queue and errors. Make engine expose callback for state change so socket layer can broadcast, or equivalent simple mechanism. Use real server time. Verify transitions with temporary native Node smoke code if useful; remove throwaway files. No frontend dependency.

## 03 — Realtime

Attach Socket.IO to HTTP server. Validate Origin/roles and every message. Implement command acknowledgments and per-role snapshot serialization per doc 04. Join tracks token/socket sets; reconnect uses full state, not stale event queue. QR data URL generated once using qrcode; async creation must guard concurrent creates (lock pending flag or equivalent; session cannot duplicate). Admin resume, auth revocation, error responses, presence. Confirm no raw token, playlist or auth data in participant snapshots. Test invalid ID and unauthorized admin actions.

## 04 — Media

Implement public/js/media.js, file picker/drop handlers, metadata, thumbnail generator, object URL lifetime, selection/order and frozen mapping. Implement safe initial vs replay ended distinction and reattach logic. Handle play promise failure. No server upload. Verify short portrait MP4 and unreadable file handling where sample files exist.

## 05 — Setup UI

Implement common CSS tokens and login/setup views. Build accessible real controls, thumbnail library and ordered list. Create session using only selected metadata. Preserve media across SPA view transitions with History API; handle direct URL reload via resume. Display active session if one exists; do not create conflicting session. Disable controls during pending actions. Fit visual design rather than adding template dashboard.

## 06 — Live admin

Implement stable layout header/stage/QR rail, lobby, initial playback, ended event, timer based on server offset, live counts, +5, manual close, skip, result mean/distribution, replay, next. Keep media element stable across vote/presence updates. Handle offline ended retry and reconnect. UI state must derive from snapshot, not optimistically move phase before ack. Correct behavior when zero votes, all voted, disconnect after vote, skip. Finish only allowed valid phases. Keep QR visible throughout.

## 07 — Participant

Implement index.html shared landing/join logic and client.js. Extract strict session ID, token per session, no sign-in, socket connect/join, full snapshot renderer and responsive ten-button grid. Ack timeout, duplicate handling, reconnect, invalid/closed and finish. No video playback/download. No vote queues while offline. Test two browser tabs sharing a token and a different browser token.

## 08 — Final

Render server-sorted leaderboard with local thumbnail mapping, no-vote/skipped labels and JSON export. Implement replay overlay as separate player, keep QR sharp, preserve scroll and focus. Close session with confirm; notify participants and invalidate QR, return setup. No voting or state changes on replay. Handle missing media after refresh.

## 09 — Finish and deploy readiness

Run local server, exercise happy path and edge cases in doc 08. Fix issues, verify actual console/browser errors where tools permit. Ensure package lock committed, no env secrets, result directory ignored except gitkeep, README deployment clear. Provide exact commands and Cloudflare ingress mapping. No deployment without explicit access and approval. Do not claim passed checks not run. No extra feature work until core is verified.

## Scope/time guard

If time constrained, skip optional drag reorder (up/down required), optional paste join input, decorative animation, optional progress bars and any extra visual polish. Do not skip auth, QR, local preview, automatic voting, server deadline, duplicate checks, reconnect, replay, leaderboard, responsive mobile controls or basic deploy instructions. A simple robust implementation beats complex architecture. No separate test framework, no deployment platform migrations.
