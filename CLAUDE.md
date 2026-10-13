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
- `impressum.html`, `datenschutz.html` (+ `legal.css`): legal pages, German binding text plus English. Linked from the mode screen and the info panel. Update the privacy policy before adding accounts, payments, analytics or any third-party service.
- No build step. Vercel serves the files statically.

## Product decisions
- International audience: English is the default language for everyone (also German browsers); German only when the player picks it (button in the header, stored in localStorage `wms-lang`). Translations live in the small script before the main game script: exact phrases in `D`, composed sentences as regex patterns in `P`. Any new German UI text needs an English entry there.
- USA vs Russia is free. Every other nation is paid and locked ("coming soon") until a real checkout
  exists; ownership will then live server-side per account, never in localStorage. Planned pricing:
  bundle of 3 nations 2.99 EUR, all nations 4.99 EUR.
- Caricature mode is on by default.
- View: header button "View" opens camera presets (Free 3D default, Play view, Top view) plus the caricature/flag toggles. Every preset is fitted by `fitCamera()` so the whole board fits between header and info panel (camera view offset); stored in localStorage `wms-view`. The "2D pieces" toggle in that menu swaps every piece for a flat disc with the classic chess symbol in nation colours (`makeFlatPiece()`), forces the top view straight down and is stored in `wms-flat`; choosing another view turns it off.
- Volume: one header button opens sliders for sounds and music (0-100 %, default 70 %, 0 = off), stored in localStorage `wms-vol`. All sound effects go through `sfxBus()`, music through `musicBus()`.
- Online 1v1 runs on Supabase (free plan, project `uerlobtrjmgveqeoykwk`, Frankfurt), see `supabase/README.md`.
  Phase 1 (built): anonymous guest sign-in, unrated friendly games by 4-letter code. Clients only read
  their own rows in `games` (RLS); every write goes through the edge function `game`, which replays and
  checks each move with chess.js 0.10.3 (same as the client) inside a row-locked transaction. Live updates
  via Realtime postgres_changes plus a 6 s polling fallback. supabase-js is self-hosted in `vendor/` and
  only loaded when online play is chosen. Online only USA and Russia (enforced server-side).
- Phase 2 (built): e-mail accounts via magic link (a guest is upgraded in place with `updateUser({email})`),
  player names in `profiles` (public, unique case-insensitive), rated games 10 min + 5 s only via matchmaking
  (`queue` action, Elo window widens with waiting time, max 3 rated games per pair per day), clocks checked by the
  server (first move of each side: 60 s, else aborted, no Elo; early resign also only aborts), flag fall via `claim`
  and the per-minute `sweep_clocks()` cron, Elo settled once in SQL `finish_game()` (start 1200, K 40 for the first
  20 games, then 20), leaderboard from `profiles`. Sign-in mails need custom SMTP (Resend), see supabase/README.md.
- Planned next: Nations League per season: 3/1/0 points,
  ranked by points per game, only rated games between different nations, entry via any nation purchase or a
  small league pass, at most ~10 games per player per day count for the nation, weaker players count less,
  suspected sandbagging silently excluded. Guests can never play rated, league or buy.
- Login rule: playing is always free without login; an account is only needed to buy, play rated or join the league.
- Nation colours must stay distinct: USA navy, Russia red, Europe silver-white, China gold,
  Germany anthracite, Israel sky blue, Iran green. Queens stand slightly below king height.

## Working rules
- After editing, syntax-check the main script with node before pushing.
- Changes go to a branch and a pull request; the owner tests the Vercel preview link and approves before merging to `main` (which is live).
- Keep everything a nation needs together: `NATIONS` entry, flag texture branch, queen builder,
  queen scale, king lapel pin, picker flag SVG and hover CSS.

## Marketing clips
- `tools/clip/` records scripted games as vertical videos (see its README). The game page itself stays untouched; `make_video_page.py` patches a copy.
