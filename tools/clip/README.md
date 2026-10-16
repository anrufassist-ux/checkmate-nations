# Clip recorder

Records a scripted game as a vertical video (720x1280, 24 fps) for TikTok / Reels.

1. `python3 make_video_page.py` builds `video.html` from the game (`../../index.html`) with recording hooks.
2. Needs `playwright` or `playwright-core` (set `PW=` to its path if it is installed globally). The capture serves the repo itself. Chromium is expected at `/opt/pw-browsers/chromium`.
3. `node capture.js test` writes one test frame (`test.png`); `node capture.js full` writes `frames/f00000.jpg …`.
   Set `START=<frame>` to re-render only from that frame on (the run is deterministic: Playwright's paused fake clock).
4. `python3 mix.py [clip.mp4]` mixes the frames with the game music (`window.MUSIC`) and every sound the game played
   (`window.SFX` keys, logged with their times in `sounds.json`; synth explosions use `audio-extra/boom.wav`).

The moves, titles and nations are set in `capture.js` (`mv(from,to,holdMs)`, `#vidTitle`, `setNations`).
Software rendering takes about 20 minutes per 28-second clip.
