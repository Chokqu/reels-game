# REELS NIGHT — implementation handoff

This directory is a complete specification for a small, live, single-host university community event application. It is not the implementation. Give the entire directory to your coding agent and use `AGENT_PROMPT.md` as the initial instruction.

## Read order

1. `AGENT_PROMPT.md` — task and non-negotiable constraints.
2. `docs/01-product.md` — exact user experience and scope.
3. `docs/02-architecture.md` — stack, repository, HTTP and security.
4. `docs/03-game-engine.md` — state, transitions, voting and persistence.
5. `docs/04-realtime-protocol.md` — Socket.IO wire contract.
6. `docs/05-local-media.md` — local video selection, thumbnails and replay.
7. `docs/06-ui-design.md` — dark-minimal visual system, page layouts and responsive behavior.
8. `docs/07-implementation-phases.md` — dependency-ordered execution.
9. `docs/08-deploy-and-check.md` — Cloudflare deployment and acceptance checks.

Read all files before editing. The documents describe one coherent system. If a minor implementation choice is not specified, choose the simplest reliable option consistent with the acceptance criteria. Do not expand the feature set.

## Locked decisions

- Existing Linux server, one Node.js process, Cloudflare Tunnel and existing domain (or temporary HTTPS address for rehearsal).
- Express, Socket.IO and qrcode are the only runtime npm dependencies. Plain HTML, CSS and browser JavaScript. No bundler or build step.
- One active game at a time; random unique session ID; QR link to that game; new ID for each new game.
- Admin panel IS the projection screen. No separate spectator/player video stream.
- Admin chooses local MP4s, previews and orders them, then starts a game using only selected videos. Files never leave the admin browser.
- Video ends → automatic vote opening. 15 seconds, optional +5 seconds, manual early finish. Live vote count. One accepted vote per anonymous browser token per round.
- Reconnect via the same QR. No registration, names, accounts, personal leaderboard or player history.
- Results after every round; replay without opening another vote; final leaderboard; video replay in blurred overlay; QR stays visible.
- Authoritative session state in server RAM. JSON result backups. No database. No recovery of a live game after server restart.
- Monochrome dark minimal UI, Turkish user-facing text, English code identifiers.

The source of truth for state transitions is document 03; for message payloads document 04; for visual behavior document 06. The phases are an execution order, not user-facing UI.
