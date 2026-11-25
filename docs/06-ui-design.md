# 06 — Complete visual and layout specification

## Creative direction

Dark Minimal. Think quiet media player / screening room, not SaaS dashboard, Instagram clone or gaming neon poster. Video is the brightest visual object. Everything else uses a restrained black-and-white interface. UI must look intentional on a 16:9 projector and a small phone. The club branding is small text (`BİLGİSAYAR TOPLULUĞU`); event title `Reels Night.`. No logo creation, emoji, generic hero illustrations, decorative icons, gradient, glow, giant shadows, excessive rounded cards, pills for every label, stock photo or glass dashboard. Blur is reserved for final replay modal only. Icons, if essential, use native controls or tiny inline SVG with accessible labels; do not install icon library. Use text buttons when clearer.

### Tokens

```css
:root {
  color-scheme: dark;
  --bg: #0c0c0c;
  --surface: #161616;
  --surface-raised: #1c1c1c;
  --border: #292929;
  --text: #f5f5f5;
  --muted: #a3a3a3;
  --accent: #ffffff;
  --accent-text: #0c0c0c;
  --success: #4ade80;
  --danger: #f87171;
  --radius: 8px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

Use 4/8/12/16/24/32/48px spacing, 1px dividers, subtle 4–8px corners. No nested card framing except a functional thumbnail grid. Text hierarchy: desktop page title 28–36px semibold; secondary 14–16px; section label 12px with restrained tracking; timer and score use 48–80px responsive sizing and `font-variant-numeric: tabular-nums`; mobile title 24–32px. Normal text line-height 1.45. Buttons primary near-white with dark text, secondary transparent border, destructive subdued outlined red, disabled lower contrast but legible. Focus visible 2px white outline with offset. Minimum touch target 44px, score grid 56–72px. No hover-only functionality. 150–200ms simple opacity/color transitions, respect prefers-reduced-motion. Use CSS variables and layout grid/flex; no external fonts/CDN. Contrast check especially muted text projected. Document title and `lang="tr"`.

## Page A — Public landing (`/`)

Full-height dark background. Center compact 360px max content. Small club label, large Reels Night title, one sentence `Katılmak için etkinlik ekranındaki QR kodu okut.` Optional paste field accepting a valid join URL/UUID and `Katıl` button; no game discovery, no admin link prominently exposed. If paste URL, accept same origin and valid `/join/UUID`; navigate locally, never open arbitrary URL. No decorative content. On phones use 24px side padding.

## Page B — Admin login (`/admin`)

Centered 360–400px column, 24px padding. Title `Reels Night.` then `Yönetici girişi`. One password-type input labeled `Yönetici anahtarı`, full width primary `Giriş yap`, error below. Disable while pending, no autofilling token from URL, clear value after success. Login should be performed before projector is shared. After success replace history with `/admin/setup` or resume active game. No secret visible in subsequent screen. Keep auth failure message generic. No sign-up/forgot password.

## Page C — Setup (`/admin/setup`)

At 1280x720: app header height 64px, horizontal margins 24–32px. Header left event title 28px + small club text; right `Hazırlık` and optionally logout (only when no active game or confirmed). Main content max width 1440px centered. Top row title `Videoları hazırla` and muted `Yalnızca seçili videolar oynatılacak.`. Drop area full width across library, about 88px tall with dashed border, `Video ekle` primary button and hint `MP4 · sürükle bırak veya dosya seç`. No huge empty hero. When empty show simple text `Henüz video eklenmedi`.

Desktop split after drop area: left library flexible width (~70%), right selected playlist 300–340px. Library grid responsive `repeat(auto-fill,minmax(140px,1fr))`; at typical desktop 4–5 cards. Each thumbnail portrait ratio 9:16 but cap visual height about 170–210px to avoid excessive scrolling; object-fit:cover, duration label bottom right on solid dark background, small selectable check top right. Below thumbnail filename, readable/truncated, and remove action (not overlay blocking selection). Selected card uses 2px near-white outline and checked box, not flashy green. Loading thumbnail text; error card shows `Video açılamadı` and remove/retry. Use native checkbox semantics or button with aria-pressed; keyboard selection.

Right playlist pane: title `Oynatma sırası`, count and total duration, list rows numbered 01,02… with miniature thumbnail 36×52, filename, up/down and deselect controls. The displayed order is authoritative. Scroll when long, but action bar remains accessible. Footer sticky within setup: `N video seçili` left, `Oturum oluştur` prominent right, disabled when invalid. Show pending state and error if server rejects. At widths below 900px stack library and playlist; setup can scroll normally. Admin setup is not the projected live screen yet.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Reels Night. / BİLGİSAYAR TOPLULUĞU                          Hazırlık │
├──────────────────────────────────────────────────────────────────────┤
│ Videoları hazırla                                                    │
│ [ + Video ekle ]      MP4 dosyalarını buraya bırak                    │
├──────────────────────────────────────────────┬───────────────────────┤
│ Video kütüphanesi                 5/6 seçili │ Oynatma sırası        │
│ [preview ✓] [preview ✓] [preview ]          │ 01 thumbnail  ↑ ↓     │
│   a.mp4       b.mp4       c.mp4              │ 02 thumbnail  ↑ ↓     │
│ [preview ✓] [preview ✓] [preview ✓]          │ 03 thumbnail  ↑ ↓     │
│                                              │ ...                   │
├──────────────────────────────────────────────┴───────────────────────┤
│ 5 video · 2 dk 14 sn                        [ Oturum oluştur ]      │
└──────────────────────────────────────────────────────────────────────┘
```

## Page D — Admin live game (`/admin/session/:id`)

This is the public projection and host console in one. No separate presentation page. Use full viewport with no page scroll at 1280×720 and 1920×1080. CSS layout: header 56–72px, remaining grid `minmax(0,1fr) clamp(220px,24vw,320px)` with 16–24px gap, footer integrated into main column or rail as described. Padding 16–24px. At 720p avoid oversized header. Header left small club label + title, center or right `Reels 04 / 20`, connection status and count readable. No UUID displayed as a giant title. A slim network warning replaces status on disconnect.

### Fixed right rail (all live phases and leaderboard)

Top: QR on solid WHITE square, at least 160px on 720p, target 200–240px on 1080p depending on available space, black modules with 4-module quiet zone; generate real qrcode image with error correction M. Do not apply invert, blur, gradients, transparency or animation. Keep enough physical size for people at back of room; verify with real camera. Label `Katılmak için okut` large enough to read; copy link button and short domain text beneath, full join URL available via copy (do not wrap giant UUID into huge text). QR always fixed in rail: lobby, playback, voting, result, final, modal replay. Header/rail layout does not jump when phase changes.

Below QR: two simple metric blocks `Bağlı` and `Oy veren` with 24–36px tabular numbers. Use `34 oy · 42 bağlı`, not guaranteed percentage. Voting: `00:15` timer 48–64px, label `Kalan süre`, two full-width controls `+5 saniye` and `Oylamayı bitir` (secondary and outlined destructive). No QR hidden by timer. Non-voting: timer section replaced by short phase text, not wasted fake widgets. Result: compact `8,42 / 10` and number of votes if space. Host buttons cannot disappear below fold; compact on 720p. For narrower screens stack rail above main or beside with QR still visible, allow scrolling only when needed; projector landscape is primary.

### Lobby

Main area empty player replaced by large title `Hazır mısınız?`, `N Reels · Katılmak için QR kodu okutun.` and centered `Başlat` button. Show selected first preview optionally as small image, no autoplay. Rail shows QR and live participant count. Start enabled even with zero participants (operator decides). Confirm finish if canceling lobby. All controls real.

### Playing

Main area a single large black stage, centered video with max width/height 100%, `object-fit:contain`; preserve original portrait/landscape aspect. At 1280×720 expect portrait clip around 290×515 px, black side space intentional. At 1920×1080 stage grows proportionally. Use `min-height:0` for grid children; size video using actual available height, no forced crop. Native controls visible on hover/touch, but do not force native fullscreen. Footer under stage: current filename (optional truncate), `4 / 20`, `Videoyu oynat` if autoplay failed, `Videoyu atla` secondary if needed with confirmation. No next button while initial playback active; allow skip. Right rail QR and connected count, phase `Reels izleniyor`.

### Voting

Keep stage in same position with last video frame (or local replay). Main lower section shows `Puanlama açık`, `Tekrar izle` control. Right rail timer and vote counts update smoothly without layout shift. Do not show average or distribution yet. Replay while voting leaves timer running. If admin disconnected, controls disabled; reconnect status visible. Phone votes are not listed individually. No automatic close when all connected have voted.

### Results

Main stage can shrink into a two-column result layout while retaining current preview/player: left video (or frame) ~45%, right score and histogram ~55%. Mean large 64–80px, `/10` smaller, text `N oy`. Ten bars horizontal or vertical, labels 1–10 and count; monochrome white/gray fill, no chart library, handle all zero safely. No-vote state `Oy kullanılmadı` not `0/10`. Footer left `Tekrar izle`, right primary `Sonraki video` or `Sıralamayı göster` on last. Secondary `Etkinliği bitir` for early finish with confirmation. Rail QR, connected count and status stay. The result must be readable from a distance, not only small chart labels. While replaying, video stays in same panel; results remain frozen. Stop replay on next/finish.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Reels Night.                       Reels 04 / 20           ● Bağlı   │
├────────────────────────────────────────────────┬─────────────────────┤
│                                                │    ┌────────────┐   │
│             ┌─────────────┐                    │    │  REAL QR   │   │
│             │             │                    │    └────────────┘   │
│             │   VIDEO     │                    │   Katılmak için okut│
│             │   9 : 16    │                    │    [Bağlantıyı kopyala]│
│             │             │                    │                     │
│             └─────────────┘                    │  42 bağlı   34 oy   │
│                                                │       00:09         │
│                                                │    [ +5 saniye ]    │
│                                                │    [ Oylamayı bitir]│
├────────────────────────────────────────────────┤                     │
│ 04 / 20        [ Tekrar izle ]                 │                     │
└────────────────────────────────────────────────┴─────────────────────┘
```

Wireframe represents voting; replace controls appropriately per phase. Main stage and rail are separate semantic regions. Use actual qrcode package, never decorative mock QR. Keep QR crisp on projector and use a readable fallback link copy.

## Page E — Participant (`/join/:sessionId`)

Full viewport `min-height:100dvh`; safe-area insets using env() plus 20–24px. Single centered content column max 440px, header small `Reels Night.` and round count if applicable. Avoid navigation menus. Portrait phone 360×640 must fit all ten score buttons without scrolling. Footer minimal `Bilgisayar Topluluğu` optional. No video element, thumbnails, participant names or QR on phone. Dark background; near-white text. Use aria-live for connection and acknowledgment, but not timer every second.

- Connecting: simple text `Bağlanılıyor…` with restrained progress indicator. No fake countdown.
- Lobby: centered `Hazır mısın?` 30px, `Etkinliğin başlaması bekleniyor.` 16px.
- Playing: `Reels izleniyor` 30px, `Gözler büyük ekranda!` 16px muted, round count. No action.
- Voting: top centered `Puanını ver` 28–32px; countdown 56px tabular and thin horizontal deadline bar optional (updates with extension). Ten actual buttons in 5 columns × 2 rows, order 1–5 then 6–10, gap 8px, min height 56px, text 24px semibold. At 320px narrow use 5 columns with >=44px width, reduce side padding to 12px. All same visual weight: no color gradients or nudging certain scores. Below `1: en düşük · 10: en yüksek`. Tap sends immediately, disable pending. Show no selected score until ack; prevent double tap. Countdown zero disables.
- Voted: large `Oyun alındı!`, small green check if desired, `Sonuçlar bekleniyor.` Keep current countdown optionally small. No change-vote button, no personal history. If ack lost, server snapshot with hasVoted restores this screen.
- Results: `Tur sonucu`, large `8,42 / 10` (or `Oy kullanılmadı` / `Video atlandı`), `N oy`, `Sonraki Reels bekleniyor.` No leaderboard on participant phone.
- Finished: `Oyun bitti!`, `Katıldığın için teşekkürler.` Static until closed.
- Disconnected: overlay or replacement `Yeniden bağlanılıyor…`, `Bağlantın gelince otomatik devam edeceksin.` Disable votes; no offline queue.
- Invalid/closed: `Oturum bulunamadı veya sona erdi.` `Güncel QR kodu okut.` No infinite reconnect loop.

```text
┌─────────────────────┐   ┌─────────────────────┐
│ Reels Night.  4/20  │   │ Reels Night.  4/20  │
│                     │   │                     │
│   Reels izleniyor   │   │    Puanını ver      │
│                     │   │       00:15         │
│ Gözler büyük ekranda│   │                     │
│                     │   │ [1][2][3][4][5]     │
│                     │   │ [6][7][8][9][10]    │
│                     │   │ 1 düşük · 10 yüksek │
│ Bilgisayar Topluluğu│   │ Bilgisayar Topluluğu│
└─────────────────────┘   └─────────────────────┘
```

## Page F — Leaderboard (`/admin/session/:id/leaderboard`)

Same projected shell and right QR rail. Main header `Final sıralaması` 32–40px, `N tamamlanan Reels · N toplam oy` metadata. Do not present total votes as unique participants. Ranked list table-like rows, no card pile. Columns: rank 48px, thumbnail 48×68px, flexible filename/title, vote count, mean large 28–36px, play control. First row slightly stronger white type/border, no gold confetti or podium animation. Sort by engine output; no client recomputation. Completed score rows first, unscored/skipped labeled and unranked at bottom. Make list scroll internally for 20+ clips; top and bottom controls remain accessible. Empty state `Henüz puanlanmış video yok.` Footer `Sonuçları indir (JSON)` and `Oturumu kapat` with confirmation. QR still valid until close. On close return setup and release session media as appropriate; allow operator to reuse library if explicitly retained without retaining old game IDs.

### Replay overlay

Click a row or replay button. Modal visually looks like a new window above blurred leaderboard, but it is DOM overlay not `window.open`. Backdrop only covers main content (or QR rail is positioned above it), dark translucent #000 at ~65%, `backdrop-filter:blur(10px)` with plain dark fallback. Header/rail QR always sharp, not covered. Center panel width min(520px,95% main area), max height available minus 24px, dark surface border 1px, radius 8px. Portrait video largest portion, preserve ratio; close X at top right at least 44px target. Title and frozen score below or above. No decorative effects. Close via X, Escape or backdrop, pause video, restore focus and underlying list scroll. Role dialog, aria-modal only if modal semantics match focus trap; ensure QR remains scannable and copy accessible if outside focus trap. No server event. Native media fullscreen disallowed in this overlay if it hides QR; browser full-page fullscreen okay.

```text
┌─────────────────────────────────────────────┬─────────────────┐
│ Final sıralaması (blurred behind overlay)    │  REAL QR        │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │                 │
│ ░░░░░░░ ┌───────────────────────┐ ░░░░░░░░  │  Katılmak için  │
│ ░░░░░░░ │ Reels #12          X  │ ░░░░░░░░  │  okut           │
│ ░░░░░░░ │    ┌─────────────┐    │ ░░░░░░░░  │                 │
│ ░░░░░░░ │    │    VIDEO    │    │ ░░░░░░░░  │  Oyun bitti     │
│ ░░░░░░░ │    └─────────────┘    │ ░░░░░░░░  │                 │
│ ░░░░░░░ │      9,42 / 10        │ ░░░░░░░░  │                 │
│ ░░░░░░░ └───────────────────────┘ ░░░░░░░░  │                 │
└─────────────────────────────────────────────┴─────────────────┘
```

## Accessibility and finishing criteria

All buttons have meaningful labels; destructive actions confirmed, ordinary actions not. Keyboard tab order follows visual order, focus not lost on state render. Avoid rebuilding live video DOM when vote count updates. Update only changed counters, phase content and countdown; no flickering or video restart due to snapshots. Buttons disabled on pending or invalid phase. Do not leak admin token or raw voter identity into DOM. Use `textContent` for filename. Real QR can scan while video playing, results visible, leaderboard displayed and overlay open. Test on projector-like viewport and actual iOS/Android phones. No horizontal page overflow at 320px. Respect reduced motion; no sound effects by default. UI must contain no phase implementation labels, debug logs, fake scores or placeholder buttons in production.
