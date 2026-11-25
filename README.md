# Reels Game.

Single-host screening and anonymous phone voting. Node.js 22+, Express, Socket.IO and qrcode; plain browser HTML/CSS/JavaScript. No build, database, media uploads or external assets. The admin browser is also the projection screen. Original filenames are never rendered in the app, tooltips, accessibility labels, error messages or result exports; videos use numbered Reels labels. Original names are retained only in private playlist metadata for exact local-file reattachment.

The latest operator changes rename the app to Reels Game, remove link text and copy controls beside the QR, and close voting when everyone connected has voted; these changes supersede the original specification where it differs.

## Run locally

```sh
npm ci
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
# Set ADMIN_TOKEN in .env to the generated value.
npm start
```

Open [http://localhost:3000/admin](http://localhost:3000/admin), enter the configured key before sharing the projector, and choose MP4 files. For the initial development checkout, a random local key has already been generated in the ignored `.env`; inspect that file locally or replace it. Do not copy it into chat, URLs or source control.

```sh
curl http://127.0.0.1:3000/health
# {"ok":true}
```

| Variable | Meaning |
| --- | --- |
| `HOST` | Bind address; keep `127.0.0.1` behind the tunnel |
| `PORT` | Default `3000`; choose an unused local port |
| `PUBLIC_URL` | Exact public origin, no path/query/credentials; local default `http://localhost:3000` |
| `ADMIN_TOKEN` | Random secret, 32–512 characters; placeholders rejected |

Use the exact configured origin in the browser. A localhost QR only works on the host computer. Phones need the HTTPS tunnel origin. Stop the process with Ctrl+C. `npm run dev` enables Node's file watcher for development; a restart discards any live game.

## Hosting on the existing Linux server

Use an existing unprivileged service user and one Node process. Node 22+ LTS, npm and cloudflared must already be installed for that server's OS.

```sh
git clone <repository-url> reels-game
cd reels-game
npm ci --omit=dev
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
# Edit .env: real ADMIN_TOKEN and PUBLIC_URL=https://reels.example.com
npm start
```

For a short event, run `npm start` inside the operator's existing tmux session. For systemd, adapt this unit to the real paths/user and the installed Node binary; do not run multiple workers:

```ini
[Unit]
Description=Reels Game
After=network.target

[Service]
Type=simple
User=<existing-service-user>
WorkingDirectory=/srv/reels-game
ExecStart=/usr/bin/node --env-file=/srv/reels-game/.env /srv/reels-game/server.js
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

After installing the adapted unit as `/etc/systemd/system/reels-game.service` through your normal server administration workflow:

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now reels-game
sudo systemctl status reels-game
journalctl -u reels-game -n 50 --no-pager
```

Give that user write access to `data/results/`. An automatic process restart restores availability, **not the active game**. Do not expose port 3000 publicly or configure cluster mode. This implementation has not changed any server, DNS or Cloudflare account settings.

## Cloudflare Tunnel

Prefer the existing named tunnel. Add a public hostname such as `reels.example.com` with service `http://127.0.0.1:3000` in its existing dashboard configuration. Set `PUBLIC_URL=https://reels.example.com` before starting the app. The domain is a placeholder; replace it with your own.

For a **locally managed** existing tunnel, merge this route into its existing ingress, before the final catch-all. Preserve other hostnames, credentials and tunnel settings:

```yaml
ingress:
  - hostname: reels.example.com
    service: http://127.0.0.1:3000
  # Preserve other existing hostname entries here.
  - service: http_status:404
```

If the hostname is unused and needs a DNS route:

```sh
cloudflared tunnel route dns <existing-tunnel-name> reels.example.com
cloudflared tunnel ingress validate
# Reload the existing tunnel with its normal supervisor/configuration.
# Foreground alternative for a locally managed tunnel:
cloudflared tunnel run <existing-tunnel-name>
```

Reference: [Cloudflare ingress configuration](https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/configuration-file/) and [hostname routing](https://developers.cloudflare.com/tunnel/concepts/routing/).

Do not mix dashboard-managed and locally managed configurations. Verify HTTPS, polling and WebSocket upgrades through the real hostname. Bypass any custom cache rules for the app, and avoid challenge rules that interrupt `/socket.io/`. The tunnel makes outbound connections; no inbound application port is required.

Temporary rehearsal option:

```sh
cloudflared tunnel --url http://127.0.0.1:3000
```

Copy the generated HTTPS origin into `PUBLIC_URL`, then restart the app **before creating a session**. Temporary addresses can change and are not guaranteed; use a named tunnel for the event.

## Operating the game

1. Add local MP4s, inspect thumbnails and durations, deselect unwanted videos, and use **Yukarı / Aşağı** to order the selected playlist. Maximum 100 videos. H.264 video with AAC audio is recommended; MP4 alone does not guarantee a supported codec.
2. Create the session. Project this same page; the QR remains in the right rail throughout. Participants scan it without entering names or accounts.
3. Press **Başlat**. The first natural video end opens 15 seconds of voting. If browser autoplay is blocked, press **Videoyu oynat**. Pause does not open voting; **Videoyu atla** requires confirmation and produces an unscored skipped result.
4. Watch accepted votes and connected browsers separately. **+5 saniye** extends the current deadline; **Oylamayı bitir** closes it early. Voting closes automatically as soon as every currently connected anonymous participant has voted. Multiple tabs with the same token count once. Disconnected votes remain in results, but do not substitute for votes from people still connected. If nobody is connected, the timer continues.
5. Replay during voting or results without opening another vote. Advance manually. The last round leads to the final ranking; early finish excludes unplayed videos.
6. Replay final entries in the overlay, download JSON, then confirm session closure. Old QR links become invalid. New games have new IDs.

The UI confirms a vote only after server acceptance. Only one admin socket is active at a time; opening another authenticated host tab transfers control to it. One browser token per session is stored in localStorage. Tabs sharing it count as one connected participant and can cast only one accepted vote per round. Storage clearing/private browsers can vote separately; this is accidental-duplicate prevention, not strong anti-cheat.

## Recovery and stored data

- Network loss: controls disable, Socket.IO reconnects, and snapshots restore phase/deadline/voted status. An initial clip ending offline is retried only for the same still-playing round. Votes are never queued offline.
- Admin reload: reselect the **original files**. Matching requires filename, size and last-modified timestamp, with ambiguous matches rejected. Reattached clips never change playlist IDs or order. Restart a still-playing initial clip manually. Voting/result clips are replay-only. Host voting/finish controls work without files.
- Local files and thumbnail object URLs remain in the admin tab. No video data is sent to the server or participants. Closing the session clears the local library.
- Server restart: all live state and admin credentials are lost. Log in again and create a new game. Backups cannot resume a live session.
- Backups: `data/results/<session UUID>.json`, written atomically in order after every completed/skipped round and finish/close. Contains metadata and aggregated results, never anonymous tokens, raw votes, credentials or media. Backup failure warns the admin but does not halt the event. The final JSON download still works from RAM.
- After restart, prior JSON remains downloadable while authenticated at `/api/admin/session/<saved-session-uuid>/results`. There is deliberately no public or admin multi-session listing.

## Files

- `server.js`: configuration, HTTP, headers, static routes, lifecycle.
- `src/auth.js`: credential/cookie/origin checks and bounded login throttling.
- `src/session.js`: authoritative transitions, deadlines, aggregation and backups.
- `src/socket.js`: role checks, payload validation, per-token snapshots and presence.
- `public/js/media.js`: local inspection, thumbnails, file matching and playback context.
- `public/js/admin.js`, `client.js`, `leaderboard.js`: host, phone and final replay UI.
- `public/css/`: the specified monochrome projector/mobile layouts.
- `START_HERE.md`, `AGENT_PROMPT.md`, `docs/`: original authoritative specification, not publicly served.

## Verification

Lightweight temporary smoke scripts and a real headless Chrome browser were used; no test framework, automated suite or development dependency was added to this repository. Detailed executed outcomes are in [CHECKS.md](CHECKS.md). Run `npm ci`, `npm start` and the event rehearsal after environment changes.

## Event-day checklist

- Keep permitted, playable MP4 originals in one local folder. Check projector audio. Disable host sleep/notifications and connect power. Enter the admin secret before projecting.
- Verify public HTTPS and `/health`, then join from venue Wi-Fi and mobile data. Rehearse on actual iPhone Safari and Android Chrome; scan the QR from the back of the room.
- Use two phones for a complete rehearsal: play, vote, extend, close, replay, advance, final replay, JSON download and close. Create a fresh real session afterward.
- Keep the QR rail visible. Use whole-browser fullscreen if needed; native video fullscreen hides the rail and is disabled where the browser supports that restriction. Avoid admin hard refresh and server restarts.
- Keep original files available for reattachment. If a server restart occurs, preserve existing JSON and create a new session for remaining videos.
- Download final results, close the game, and stop only event-specific services. Keep or delete result files according to your own retention needs.
