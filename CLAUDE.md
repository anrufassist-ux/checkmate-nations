# Checkmate Nations (Weltmacht Schach)

Satirical 3D chess in the browser: countries play each other. Pawns are infantry, rooks tanks,
knights drones, bishops fighter jets; kings are bobblehead figures (caricature heads for USA and
Russia), queens are national symbols (Statue of Liberty, Matryoshka, panda, Europa, hoopoe,
Persian cat, German shepherd in a dirndl). Checkmate ends with the king arrested and put in a
jail cell next to the board.

Owner: Michael Klapproth (KI Solutions Michael Klapproth). Domain: checkmatenations.com (Vercel).

## Structure
- `index.html` is the whole game, one self-contained file (~4.5 MB): sounds, music, caricature
  images and sprites are embedded as base64 in `window.SFX`, `window.MUSIC`, `window.HEADS`,
  `window.SPRITES`. Three.js r128, OrbitControls (three@0.128.0) and chess.js 0.10.3 are self-hosted in `vendor/`,
  fonts (Black Ops One, Barlow, Barlow Condensed) in `fonts/`. No external requests (no Google Fonts, no CDNs), keep it that way (GDPR).
- `impressum.html`, `datenschutz.html`, `agb.html` (terms + withdrawal, + `legal.css`): legal pages, German binding text plus English. Linked from the mode screen and the info panel. Update the privacy policy before adding accounts, payments, analytics or any third-party service.
- No build step. Vercel serves the files statically.

## Product decisions
- International audience: English is the default language for everyone (also German browsers); German only when the player picks it (button in the header, stored in localStorage `wms-lang`). Translations live in the small script before the main game script: exact phrases in `D`, composed sentences as regex patterns in `P`. Any new German UI text needs an English entry there.
- USA vs Russia is free. Every other nation is paid: 3 nations of your choice 2.99 EUR, all locked nations 4.99 EUR,
  league pass 0.99 EUR per season. Owner is a Kleinunternehmer (§ 19 UStG, no VAT). Stripe Checkout created by the
  `checkout` action (inline price_data, consent to immediate unlock required, stored in `checkouts`); the function itself
  asks Stripe whether a session is paid (`me` action, on return via `?paid=`), no webhook. Ownership lives server-side in
  `owned_nations` / `league_passes`, never in localStorage (client keeps it in memory in `OWNED`). Bought nations are
  playable offline, online and in the league; the server checks ownership for `create` and `queue`. Terms in `agb.html`.
- Caricature mode is on by default.
- View: header button "View" opens camera presets (Free 3D default, Play view, Top view) plus the caricature/flag toggles. Every preset is fitted by `fitCamera()` so the whole board fits between header and info panel (camera view offset); stored in localStorage `wms-view`. The "2D pieces" toggle in that menu swaps every piece for a flat disc with the classic chess symbol in nation colours (`makeFlatPiece()`), forces the top view straight down and is stored in `wms-flat`; choosing another view turns it off.
- Backgrounds: the View menu also picks the scene background: Classic (grid floor, default), Kommandotisch, Kartentisch, Erde bei Nacht. The non-classic ones are AI-generated WebP images in `bg/` (loaded lazily, lying flat under the board, scaled up on portrait screens), stored in localStorage `wms-bg`.
- Board styles: the View menu also picks the board: Holz (default) and Marmor use AI-generated photo textures in `board/` (each square a different cut, loaded lazily), Stahl is drawn, Klassisch is the original flat board; stored in localStorage `wms-board` (`setBoard()`, `drawRim()` redraws the coordinate rim). Lighting: ACES tone mapping plus a small studio environment map; `polish()` makes every piece a bit glossier and its colours richer, image parts (heads, crowns, sprites, backgrounds) are excluded from tone mapping.
- Volume: one header button opens sliders for sounds and music (0-100 %, default 70 %, 0 = off), stored in localStorage `wms-vol`. All sound effects go through `sfxBus()`, music through `musicBus()`.
- Online 1v1 runs on Supabase (free plan, project `uerlobtrjmgveqeoykwk`, Frankfurt), see `supabase/README.md`.
  Phase 1 (built): anonymous guest sign-in, unrated friendly games by 4-letter code. Clients only read
  their own rows in `games` (RLS); every write goes through the edge function `game`, which replays and
  checks each move with chess.js 0.10.3 (same as the client) inside a row-locked transaction. Live updates
  via Realtime postgres_changes plus a 6 s polling fallback. supabase-js is self-hosted in `vendor/` and
  only loaded when online play is chosen. Online only USA and Russia (enforced server-side).
- Phase 2 (built): e-mail accounts via a 6-digit code only (no link: opening a link on another device would burn the code; the code is in the mail subject, the field submits itself) (`verifyOtp`, type `email_change` when a guest is upgraded in place with `updateUser({email})`, else `email`; the code must be in the Supabase mail templates, see supabase/README.md),
  player names in `profiles` (public, unique case-insensitive), rated games 15 min + 10 s only via matchmaking (if both picked the same nation, whoever waited longer keeps it)
  (`queue` action, Elo window widens with waiting time, max 3 counted rated games per pair per week; games under 10 moves per side never change Elo), clocks checked by the
  server (first move of each side: 60 s, else aborted, no Elo; early resign also only aborts), flag fall via `claim` (a draw if the side with time left has only K, K+B or K+N)
  and the per-minute `sweep_clocks()` cron, abandoned games: clients `ping` every 15 s while a rated game is open (`game_seen`, migrations/007), the opponent may `abandon`-claim the win after 2 minutes without a ping or move (before both sides moved it only aborts); leaving a running rated game asks to resign, Elo settled once in SQL `finish_game()` (start 1200, K 40 for the first
  20 games, then 20), leaderboard via SQL `leaderboard()` (only players with rated games against at least 5 different opponents; `?` = provisional, under 20 games). Sign-in mails need custom SMTP (Resend), see supabase/README.md.
  Lobby shows players online in the online area (Realtime presence channel `lobby`, nothing stored) and how many
  are searching (`stats` action). Friendly code games keep a private head-to-head
  record per pair (`friend_records`, counted in `finish_game()`); they never touch Elo or the leaderboard.
- Nations League (built, `migrations/006`): season = calendar month (Europe/Berlin), one fixed nation per player and season
  (`league_entries`), entry with any bought nation or the season's league pass. `finish_game()` calls `record_league_game()`
  for rated games that changed Elo when both players are in the league with the nations they signed up with and the nations
  differ; 3/1/0 points, at most 10 counted games per player per day, weight 0.5 each for provisional players and players under
  1000 Elo. `league_suspects()` silently drops players with >= 10 games, >= 80 % lost and >= half against one opponent.
  Public `league_table(season)` (nations by weighted points per game, players by points) and `hall_of_fame()` (champion nation
  with >= 10 games and best player with >= 5 games per finished season, titles, all-time table). Guests can never play rated,
  league or buy.
- Login rule: playing is always free without login; an account is only needed to buy, play rated or join the league.
- Nation colours must stay distinct: USA navy, Russia red, Europe silver-white, China gold,
  Germany anthracite, Israel sky blue, Iran green. Queens stand slightly below king height, measured head to foot (Liberty's raised torch does not count).

## Working rules
- After editing, syntax-check the main script with node before pushing.
- Changes go to a branch and a pull request. While the owner is the only player he tests live: merge to `main` right away and tell him the Supabase steps (SQL migrations, function redeploy) needed first.
- Keep everything a nation needs together: `NATIONS` entry, flag texture branch, queen builder,
  queen scale, king lapel pin, picker flag SVG and hover CSS.

## Marketing clips
- `tools/clip/` records scripted games as vertical videos (see its README). The game page itself stays untouched; `make_video_page.py` patches a copy.
