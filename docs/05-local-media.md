# 05 — Local media and playback

## Privacy and lifetime

The admin selects files through `<input type="file" multiple accept="video/mp4,.mp4">` or drag/drop. Files and generated PNGs remain entirely in the admin tab. No upload endpoint, multipart requests, CDN, video transcoding, Instagram scraping, remote media fetching or server-side FFmpeg. Use only files the operator is entitled to display. A filename is metadata, not a filesystem path on the server. Do not attempt to access local disk without the browser file picker.

Maintain a local library with `Map<videoId, MediaEntry>` plus ordered selected IDs. Each entry contains ID, original File, original name, size, lastModified, duration, thumbnail Blob URL, video Blob URL, status and selection. Generate ID using crypto.randomUUID on HTTPS (local localhost is a secure context). Keep file refs and object URLs alive across SPA route changes and replays; revoke object URLs when a file is removed or the session/library is disposed, not after every playback. Avoid reading the entire video into JS memory; use URL.createObjectURL(file). File input value reset after handling so same file can be selected again. Deduplicate obvious repeats by name, size and lastModified; if ambiguity exists, surface it rather than silently replacing a distinct video.

## Thumbnail pipeline

1. Create temporary detached video element, preload metadata, muted, playsInline. Assign Blob URL. Await loadedmetadata with timeout and error handler.
2. Validate duration finite and positive, videoWidth/videoHeight positive. Seek to min(1 second, duration/2) so very short clips still work. Await seeked and loadeddata as appropriate; handle a zero seek that fires no event.
3. Draw current frame into a canvas, preserving aspect ratio, max height 360 px and max width 360 px. Canvas background dark; no crop required. Convert with canvas.toBlob('image/png'), generate thumbnail URL. Use thumbnail as card image with object-fit:cover or contain depending on card. Do not base64 all videos or persist thumbnails in localStorage.
4. Clean detached media element (pause, remove src, load); preserve entry's object URL for actual player. Process sequentially or with small concurrency (2), not dozens of simultaneous video decoders. Show per-card loading and failure state. Thumbnail failure with playable metadata may use filename placeholder and allow selection; unreadable video cannot be selected.

MP4 container does not guarantee browser codec support. For rehearsal recommend H.264 video + AAC audio in MP4. Use clear Turkish error and retry/reselect; do not attempt transcoding. Video player uses `playsinline`, native controls, visible unmute/volume; no reliance on autoplay with sound if user gesture is unavailable. Host clicks Başlat/Sonraki to initiate playback; if `play()` rejects show a big `Videoyu oynat` control, preserve PLAYING state and don't open voting until natural end. On playing failure allow explicit skip via server event. On network loss local media can still play; track pending ended as described in protocol.

## Library controls

Setup: multiple files, drag-drop, thumbnails, filename (ellipsis but accessible title), duration mm:ss, selection toggle, remove, selected order. Selected count and total duration shown. Newly valid files selected automatically; explicit select all/deselect all if convenient. Up/down arrows or labeled buttons reorder selected list without relying on drag gestures. The order presented at session creation is exact playback order. Remove or deselect can never change an active session's playlist; additions/exclusions happen before create. Disable create until at least one valid selected item and all selected metadata ready. Double click / pending request must not create two games. Max 100 selected per game; show actionable error if exceeded.

## Playback semantics

Main player owns a playback context `{roundId, videoId, mode}` where mode is `initial` or `replay`. Attach one `ended` handler or explicitly remove old listener. For initial playback, send `video:ended` once only, with matching current round; set an ended-sent guard and allow retry after reconnect only if server snapshot still PLAYING and same ID. Do not emit ended during seek, pause, source change, local replay, modal playback, or stale event from previous round. Server guard is required even if client is correct. On ack failure resync and retry only if still applicable. On successful next round start, stop old video and reset playback context. Natural end retains frame until admin replays or advances. No autoplay of next clip.

Replay control is enabled in VOTING and RESULTS. Replay uses same source, starts at zero, sets mode replay, never sends vote start. Timer continues in VOTING even while video is replaying. If deadline expires during replay, display result without disrupting playback unless host advances. Next/finish stops local playback. Keep QR visible; do not use native element fullscreen because it hides the join rail. Browser fullscreen for entire page is acceptable if user activates it; layout must remain usable. `Esc` must close modal when open, not change game.

## Admin refresh / reattach

A hard reload destroys File objects and Blob URLs. Server knows only playlist metadata. On authenticated resume, restore current phase and show `Videoları yeniden seç` if local files missing. Use a multi-file picker, match exact name/size/lastModified against frozen playlist. Never choose wrong video just because same basename; if no exact match, explicitly show unmatched and allow operator to reselect correct file (no silent substitution; skip if unavailable). Do not change IDs or order. Regenerate thumbnails after reattach. If current phase PLAYING, restart that same original clip only after host action; it may then naturally open its vote. If VOTING/RESULTS, reattached media is replay-only. Leaderboard can render filenames and scores without files; unavailable replay buttons disabled with explanation. No IndexedDB or persistent file handles required.

## Leaderboard playback

Use separate modal video element so it cannot share the initial player's ended handler. Clicking result row opens overlay with selected clip, starts on click when possible, shows controls and title/score. Maintain scroll position and return focus to triggering row on close. Pause, detach modal source and close on X, Escape or backdrop click. Do not revoke shared library URL until session/library disposal. Never send any round or voting command from leaderboard modal. QR rail sits above overlay or outside its backdrop and remains fully legible.
