# IMPLEMENT THE ENTIRE PROJECT IN ONE SESSION

You are the implementation agent. Build a complete working Reels Night application in the current repository using the attached specification directory. Read every document in `docs/` and `START_HERE.md` before writing code. Do not stop at architecture, wireframes, a plan, scaffolding, or a partial prototype. Implement the actual system, finish its UI, exercise the important paths, and leave a runnable repository with a concise deployment README.

This is a real one-evening university community event with a shared screen and roughly tens of participants. Optimize for reliability, low setup friction, simplicity and readability. The owner has an existing server, Cloudflare account and domain. Do not propose Vercel, Redis, WebRTC, Wrangler, a managed realtime service, a database, a different stack, or a separate projection application. The stack is settled.

## Required working behavior

An administrator opens `/admin`, enters a secret token configured in the environment, chooses local MP4 videos in the browser, sees generated preview thumbnails and durations, selects/excludes and orders videos, and creates a game. Only selected videos enter the session. A QR code points to the unique `/join/:sessionId` URL. It stays visible throughout the live game and final leaderboard. The admin panel is projected onto the communal screen.

People scan the QR and immediately join anonymously. Their phone says that a Reel is playing, or displays ten large score buttons when voting opens. When the video ends for the first time in its round, voting starts automatically for 15 seconds. The host sees live accepted votes and connected participants, can add five seconds, or close voting immediately. The server validates deadlines and accepts only one score from each anonymous browser token for each round. No results are disclosed before close. The host sees the average and distribution, can replay the current video without initiating another vote, and manually proceeds to the next video. The last result leads to a leaderboard of completed videos. Selecting a leaderboard item opens the original local video in a centered overlay with a blurred underlying content area. Close it to return to the unchanged leaderboard. The QR remains legible even during replay.

A phone can lose network, refresh or scan the same QR again and rejoin the current game. Its anonymous token in localStorage is only a convenience to avoid duplicate votes; do not build accounts or claim strong anti-cheat. Recover the current state and whether that browser already voted in the active round from the server snapshot. A distinct private browser can vote separately; this limitation is accepted.

## Constraints

- Runtime: Node.js 22 or later supported LTS, Express, Socket.IO, qrcode; native Node modules for everything else.
- Plain browser JS, HTML, CSS; no TypeScript, React, Next, Tailwind, component library, transpiler, build step, external fonts, analytics or external CDN dependencies.
- One process, one active game, one authoritative state machine, no service layers for their own sake. Keep all data in RAM except compact JSON result exports/backups. Admin media is local only, not uploaded, streamed or persisted to server.
- Implement security at the server, not by hiding URLs. Admin token never appears in projected pages, URLs, logs, client source or participant payloads. Login gives an HttpOnly cookie; protect every admin API and socket event. Validate origin and inputs. Do not open new public application ports.
- UI text in natural Turkish. Source identifiers in English. Dark minimal, projector-first admin, mobile-first participants. Follow visual specification, not a generic AI dashboard. Avoid decorative icons, gradients, glows, glass cards and needless motion.
- Do not add features that are not requested. No account systems, video downloaders, Instagram integration, server-side video processing, chat, teams, score ownership profiles, multi-host control or multi-game dashboard.
- Prefer straightforward functions, clear variable names and small modules. Avoid excessive comments, generated documentation churn, and speculative abstractions. Do not add a test framework or a large automated suite; use the built-in tools and manual/smoke checks described in document 08. A small temporary smoke script is fine if useful. Never claim a check passed unless you actually ran it.

## Execution

Work through phases 01–09 in order in one coding session. Do not request confirmation between phases. Inspect existing repository first and preserve unrelated files. Create the minimal repository structure from document 02; if the spec directory is inside the repo, do not serve it publicly. Read documents before deciding event names and payloads. Implement real functional controls; do not use sample hardcoded results or a fake QR in the shipped application. Do not leave TODO placeholders for core behavior.

Install dependencies and generate package-lock.json. Start the app locally and check routes, authenticated and unauthenticated access, session creation, vote validation, duplicate rejection, automatic closure, timer extension, replay isolation and leaderboard. Use available browser tooling if available; otherwise identify the manual real-device checks still outstanding. Check the layouts at a desktop/projector viewport and narrow phone viewport when possible. Fix defects before finishing. Do not deploy or change real Cloudflare/DNS configuration without an explicitly supplied target/authorization; prepare the exact commands and explain what the operator must configure.

## Final response to operator

Summarize implemented functionality, files, exact local run and server run commands, which checks actually passed, any outstanding real-device verification, and any limitations. The user must be able to run the application using `npm ci`, configure environment, and `npm start`, without a build. Provide concise Cloudflare Tunnel instructions and an event-day checklist. Do not just paste code into the final response if you have access to the repository: write the files.
