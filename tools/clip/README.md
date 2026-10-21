# Clip recorder

Records a scripted game as a vertical video (720x1280, 24 fps) for TikTok / Reels.

1. `python3 make_video_page.py` builds `video.html` from the game (`../../index.html`) with recording hooks.
2. Needs `playwright` or `playwright-core` (set `PW=` to its path if it is installed globally). The capture serves the repo itself. Chromium is expected at `/opt/pw-browsers/chromium`.
3. `node capture.js test` writes one test frame (`test.png`); `CLIP=scholar|fool node capture.js full` writes `frames-<clip>/f00000.jpg …`
   (scholar: USA mates Russia in 4 moves; fool: Russia mates the USA in 2). The end zooms in front of the cell so the crying face is visible.
   Set `START=<frame>` to re-render only from that frame on (the run is deterministic: Playwright's paused fake clock).
4. `python3 mix.py <clip> [out.mp4]` mixes the frames with the game music (`window.MUSIC`) and every sound the game played
   (`window.SFX` keys, logged with their times in `sounds-<clip>.json`; synth explosions use `audio-extra/boom.wav`).

**Chess check (mandatory):** `node capture.js check` replays every script with chess.js 0.10.3 (same as the game). It fails on an
illegal move, on a clip that does not end in checkmate (set `end:'open'` for clips that are not meant to end in mate) and
warns when the king of the defending side is stuck and only a few other moves keep it from stalemate: that move must be on
camera, otherwise viewers think it is stalemate (happened in the drones clip: the a-pawn move was out of frame). After filming
it, list the white move before it in `shown` (e.g. `shown:['d5f6']`). `full` runs the same check first and refuses to render.

The moves and titles are set in `SCRIPTS` in `capture.js` (`mv(from,to,holdMs)`, `sub()`, `hideTitle()`).
Software rendering takes about 20 minutes per 28-second clip.
