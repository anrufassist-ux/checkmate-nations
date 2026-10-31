# Backlog

Open ideas and small decisions the owner wants to revisit. Newest at the top; remove an item once it is done or dropped.

## Game
- Lichess puzzle database (CC0, ~5 million puzzles, https://database.lichess.org/#puzzles): owner downloads `lichess_db_puzzle.csv.zst` (blocked from the build container) and hands it over (Google Drive or a Remote Control folder); take a selection of e.g. 30,000, then a theme picker like handandbrainchess.com (themes with emoji, coloured dot per category and count, "All" mix).
- Puzzles mixed model (owner is considering it): guests get a fixed daily set (e.g. 5 a day, the same puzzles), more only with a free account. Today puzzles are free without limits; an account saves the rating and joins the puzzle ranking.
- Classic 2D checkmate text: the banner still says "Der deutsche König wird abgeführt" although the pieces may be plain black and white. Option: neutral text in classic mode ("Schachmatt! Weiß gewinnt"). Owner leans towards keeping the nation (the game lives from it); change only if it bothers him in play.
- 2D classic pieces in nation colours may still look cheap; options: richer, calmer tones, or white/black with only a small nation-colour accent.
- Career ranks Rekrut → Feldmarschall (proposal made; open: ranks and points, shown on the public leaderboard?). Needs a Supabase migration and a function redeploy.
- Puzzles: more mate-in-2/3 puzzles (optional).
- Trainer stage 2: chat with General Gambit (LLM via edge function, daily limit, sign-up incentive), e.g. "I want to practise the Sicilian". Owner wants this.

## Design ideas (from speedchess.de and handandbrainchess.com, owner likes how tidy they look; collect first, build later)
- One calm colour system: dark warm background, gold for accents, green only for "selected / primary / won", red only for "lost / danger".
- Bottom tab bar on phones (icon + short label: Play, Puzzles, Openings, Rankings, Settings) instead of many header buttons; thumb-friendly.
- Player bars above and below the board: avatar/flag, name, rating, clock (the running clock bright, the other dim), captured pieces with material balance (+1).
- Board markers: last move in a soft olive/green, king in check on a red square.
- Result card: big emoji (trophy / sad face), coloured headline (green won, red lost), reason with icon ("Checkmate", "Time", "Connection lost"), both players with rating and score, buttons Analysis · Rematch · New game.
- Game setup as one sheet: time presets as chips (1+0 … 30+20), segmented switch Friendly/Rated, colour picker White · Random · Black with icons.
- Leaderboard tabs with emoji, medals for places 1-3, a "NEW" badge for new players.
- Puzzle theme list with emoji, coloured dot per category and count (see the Lichess item above).
- Trust line in the footer: "Independent project · no ads · no tracking".
- Don't copy: their mixed languages (Romanian text in the German UI) - every text in our two languages only.

## Marketing
- Ad video "General Gambit" rendered (`marketing/general-gambit.mp4`, V14 in POSTS.md). Note: the phone screenshots in it still show the old 3D board with the wide rim; re-shot (2D phone screenshot plus a 3D close-up of the scholar's mate position).
- Tracking: in-game counters (cookieless) plus a matched landing for `?src=tiktok-ad` (likely approved, not built).
- Re-render the USA carousel sharp before posting it; post V9 beat-the-ai-earth.
