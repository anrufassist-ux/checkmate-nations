# Clip recorder

Records a scripted game as a vertical video (720x1280, 24 fps) for TikTok / Reels.

1. `python3 make_video_page.py` builds `video.html` from the game (`../../index.html`) with recording hooks.
2. Needs `playwright` or `playwright-core` (set `PW=` to its path if it is installed globally). The capture serves the repo itself. Chromium is expected at `/opt/pw-browsers/chromium`.
3. `node capture.js test` writes one test frame (`test.png`); `CLIP=scholar|fool node capture.js full` writes `frames-<clip>/f00000.jpg …`
   (scholar: USA mates Russia in 4 moves; fool: Russia mates the USA in 2). The end zooms in front of the cell so the crying face is visible.
   Set `START=<frame>` to re-render only from that frame on (the run is deterministic: Playwright's paused fake clock).
4. `python3 mix.py <clip> [out.mp4]` mixes the frames with the game music (`window.MUSIC`) and every sound the game played
   (`window.SFX` keys, logged with their times in `sounds-<clip>.json`; synth explosions use `audio-extra/boom.wav`).

**Camera language (for every clip):** 1. establishing shot: the area of the action fills the frame, no empty table around it
(`compact(p,true)` hides the title and puts the caption at the very top); 2. chase: the camera rides behind the piece that makes
the key move (`mv(from,to,hold,chase(p))`); 3. push-in: once the action is in one corner, glide in slowly, a second closer
push-in for the mate; 4. every camera move takes at least about 2 s, eased, no hectic zooms. Keep the middle of the screen
calm where possible: platforms put the play button there when someone pauses. Puzzle clips also show a legend (`legend()`) and
small classic symbols on the pieces (`badges()`) until the mate.

**Chess check (mandatory):** `node capture.js check` replays every script with chess.js 0.10.3 (same as the game). It fails on an
illegal move, on a clip that does not end in checkmate (set `end:'open'` for clips that are not meant to end in mate) and
warns when the king of the defending side is stuck and only a few other moves keep it from stalemate: that move must be on
camera, otherwise viewers think it is stalemate (happened in the drones clip: the a-pawn move was out of frame). After filming
it, list the white move before it in `shown` (e.g. `shown:['d5f6']`). `full` runs the same check first and refuses to render.

The moves and titles are set in `SCRIPTS` in `capture.js` (`mv(from,to,holdMs)`, `sub()`, `hideTitle()`).
Software rendering takes about 20 minutes per 28-second clip.

## Puzzle look (owner's choice)
- Classic board (`board:'classic'`), dark earth-from-space background (`bg:'earth'`), coordinates inside the edge squares (`coords:'inner'`, frame and rim hidden).
- Calm wide shot of the whole board (`start`), no orbit at the start; texts with `pop(p,text)` in the free space below the board, never over the pieces.
- TikTok also gets the puzzle as a photo carousel: 1 puzzle, 2 solution, 3 jail/end card (captions over 200 characters).
- TikTok photo safe zone: the app zooms 9:16 photos to fill the screen and lays its UI over them (search bar on the top ~12 %,
  caption and name on the bottom ~35 %, buttons on the right ~15 %). Keep the title and every text between about 15 % and 60 %
  of the height, keep the board clear of the right edge (smaller board, shifted left), nothing important at the bottom.
- Carousel stills: `PZ=<key> SLIDE=1|2|3 CLIP=car_<key> TESTBADGES=1 TESTJS=carousel.js node capture.js test` writes `test.png`
  (puzzles, texts and highlight squares live in `carousel.js`; check every puzzle has exactly one solution with chess.js first).
