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

## Marketing
- Ad video "General Gambit" rendered (`marketing/general-gambit.mp4`, V14 in POSTS.md). Note: the phone screenshots in it still show the old 3D board with the wide rim; re-shot (2D phone screenshot plus a 3D close-up of the scholar's mate position).
- Tracking: in-game counters (cookieless) plus a matched landing for `?src=tiktok-ad` (likely approved, not built).
- Re-render the USA carousel sharp before posting it; post V9 beat-the-ai-earth.
