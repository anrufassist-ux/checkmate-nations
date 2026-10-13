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
  `window.SPRITES`. Three.js r128 (cdnjs), OrbitControls (jsdelivr three@0.128.0), chess.js 0.10.3.
- No build step. Vercel serves the file statically.

## Product decisions
- International audience: English is the default language for everyone (also German browsers); German only when the player picks it (button in the header, stored in localStorage `wms-lang`). Translations live in the small script before the main game script: exact phrases in `D`, composed sentences as regex patterns in `P`. Any new German UI text needs an English entry there.
- USA vs Russia is free. Every other nation is paid and locked ("coming soon") until a real checkout
  exists; ownership will then live server-side per account, never in localStorage. Planned pricing:
  bundle of 3 nations 2.99 EUR, all nations 4.99 EUR.
- Caricature mode is on by default.
- View: header button "View" opens camera presets (Free 3D default, Play view, Top view) plus the caricature/flag toggles. Every preset is fitted by `fitCamera()` so the whole board fits between header and info panel (camera view offset); stored in localStorage `wms-view`. The "2D pieces" toggle in that menu swaps every piece for a flat disc with the classic chess symbol in nation colours (`makeFlatPiece()`), forces the top view straight down and is stored in `wms-flat`; choosing another view turns it off.
- Volume: one header button opens sliders for sounds and music (0-100 %, default 70 %, 0 = off), stored in localStorage `wms-vol`. All sound effects go through `sfxBus()`, music through `musicBus()`.
- Online 1v1 moves to Supabase (free plan) with login, server-validated moves, Elo and a
  Nations League. The Claude artifact path (`window.claude`) gets removed in that step; until then
  the online button stays hidden on the website. Rated games: 10 min + 5 s, opponents only via
  matchmaking. Code games between friends are unrated. Online only USA and Russia for now.
- Nation colours must stay distinct: USA navy, Russia red, Europe silver-white, China gold,
  Germany anthracite, Israel sky blue, Iran green. Queens stand slightly below king height.

## Working rules
- After editing, syntax-check the main script with node before pushing.
- Changes go to a branch and a pull request; the owner tests the Vercel preview link and approves before merging to `main` (which is live).
- Keep everything a nation needs together: `NATIONS` entry, flag texture branch, queen builder,
  queen scale, king lapel pin, picker flag SVG and hover CSS.

## Marketing clips
- `tools/clip/` records scripted games as vertical videos (see its README). The game page itself stays untouched; `make_video_page.py` patches a copy.
