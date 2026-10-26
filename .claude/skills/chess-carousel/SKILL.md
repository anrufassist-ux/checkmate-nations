---
name: chess-carousel
description: Build TikTok/Instagram photo carousels with chess puzzles in the Checkmate Nations look (tools/clip/carousel.js). Use for every puzzle carousel, puzzle still or "mate in N" post, and whenever the owner gives feedback on one. Holds the owner's layout rules; keep it up to date.
---

# Chess puzzle carousels

Chess content (puzzles, patterns, mistakes) goes out as photo carousels; videos only introduce new nations
(owner's decision, 24.10.2026: the first carousel had 659 views after 2.5 h, the puzzle video 285 in a day).

## Workflow
1. Pick or build the position. Check it with chess.js before anything else: exactly one solution (mate in 1: one
   mating move; mate in 2: one key move that mates against every defence). Never call something checkmate that is not.
2. Add the puzzle to `PZ` in `tools/clip/carousel.js` (fen, post-mate fen, highlight squares, badge, texts, `rs` = the
   empty rank for "X to move") and a `car_<key>` entry with the nations in `capture.js`.
3. Render ONE image first and send only that one (the owner checks it on his phone):
   `cd tools/clip && PHONE=1 PZ=<key> SLIDE=1 CLIP=car_<key> TESTBADGES=1 TESTJS=carousel.js node capture.js test` (writes test.png;
   with `DEBUG=1` a text that still touches a piece is logged as `TEXT TOUCHES A PIECE`).
4. Only after his OK: all slides (1 puzzle, 2 solution, 3 jail with the link), copied to `marketing/carousels/` (gitignored).
5. Look at every image yourself before sending it. Tell him clearly which file is which.

## Layout rules (owner)
- Format: always `PHONE=1` = 1080x2340 (phone ratio 9:19.5, full resolution). The old 720x1280 was blurry on the phone
  and TikTok cropped its sides.
- Board: classic board, dark earth background (`bg:'earth'`), coordinates inside the edge squares. Framing as the owner
  set it on his phone: big board shifted a bit left (camera `.2,0,20.6,14.3` in the phone format), the bottom-left square may be cut a little,
  the right side stays free for TikTok's like/comment buttons.
- Title ("MATE IN 1 🧩", "SOLUTION ✅") just above the board, left-aligned with it, a little gap, not high up.
- Who is to move ("USA to move 🇺🇸") / the solution move on the board, on empty squares.
- Call to action ("Comment your move 👇") / the explanation directly below the board, centred under it, not far below.
- A text box NEVER touches a piece (and never a caricature head). `carousel.js` checks the screen boxes of all pieces
  and moves the text to another empty rank or sideways (a title only up or right, never out of the picture); badges get
  `badgeDx`/`badgeDy` so they cover neither a piece nor the title. Check the image anyway.
- Text boxes: small, dark and semi-transparent (rgba .62).
- Piece symbols (classic chess glyphs): about 42 % of a square, inside the front right corner, never past the square's
  edge; hidden where a caricature head in front covers them.
- Solution slide: last move yellow, the winning move's square green, the mated king red; rating badge (!! green, ! blue)
  next to the moving piece without covering any other piece (the rook on g8 in a smothered mate must stay visible).
- Jail slide: camera higher than in the game (about 35-40 degrees, `carousel.js`), so the caricature head is big, the
  crown stays visible and the padlock hangs at the chin, not in front of the face; clear gap between the two text boxes.
- Nations: Germany may win, never be the beaten side in ads; no Ukraine vs Russia; satire, no violence.

## Platforms
Carousels go on TikTok only (25.10.: 800+ views in a day on TikTok, almost none on Instagram). Instagram gets Reels.

## Backlog
- Harder puzzles that teach something (mate in 2-3 with a sacrifice, famous combinations, typical patterns: Greek gift,
  Anastasia's mate, back-rank tricks, removing the defender). Mix levels: label each slide Easy / Medium / Hard so beginners
  (our main audience) and real players both find something.
- Explainer carousels with arrows (opening traps like the Queen's Gambit, 5 beginner mistakes).

## Music
Our own theme (`window.MUSIC` in index.html, extracted to `tools/clip/snd/music.mp3`) is the brand sound: send it as
`marketing/carousels/checkmate-nations-theme.mp3` with every carousel. Instagram/TikTok only allow their own library for
photo posts unless the post is a video, so offer a slideshow video with the theme if he wants the song itself.

## Captions
Short (about 150 characters plus 5 hashtags), so TikTok's caption leaves room for the board. Never reveal the solution.

## Keep this skill alive
Every time the owner corrects a carousel, add the rule here (and fix the code so it cannot happen again) in the same PR.
