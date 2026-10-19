# Checkmate Nations (Weltmacht Schach)

Satirical 3D chess in the browser: countries play each other. Pawns are infantry, rooks tanks,
knights drones, bishops fighter jets; kings are bobblehead figures (caricature heads for USA, Russia, China,
Germany, Europe, India (Modi) and UK (Andy Burnham); Israel, Iran and Brazil still generic), queens are national symbols (Statue of Liberty, Matryoshka, panda, Europa, hoopoe,
Persian cat, German shepherd in a dirndl with a raised beer stein) or historic queens (India: Rani Lakshmibai, UK: Queen Elizabeth II, Brazil: Empress Leopoldina; shown with dignity, no caricature). Checkmate ends with the king arrested and put in a
jail cell next to the board.

Owner: Michael Klapproth (KI Solutions Michael Klapproth). Domain: checkmatenations.com (Vercel).

## Structure
- `index.html` is the whole game, one self-contained file (~4.5 MB): sounds, music, caricature
  images and sprites are embedded as base64 in `window.SFX`, `window.MUSIC`, `window.HEADS`,
  `window.SPRITES`. Three.js r128, OrbitControls (three@0.128.0) and chess.js 0.10.3 are self-hosted in `vendor/`,
  fonts (Black Ops One, Barlow, Barlow Condensed) in `fonts/`. No external requests (no Google Fonts, no CDNs), keep it that way (GDPR). Exception on our own domain: Vercel Web Analytics (`/_vercel/insights/script.js`, cookieless, described in the privacy policy); it only counts once enabled in the Vercel project.
- `hilfe.html`: player handbook (game modes, nations, account, rated games incl. the 10-moves-per-side rule, Elo, Nations League), English or German like the game (`wms-lang`); linked from the footers, the account menu and the rated-game dialog. Keep it in sync when rules change.
- `impressum.html`, `datenschutz.html`, `agb.html` (terms + withdrawal, + `legal.css`): legal pages, German binding text plus English. Linked from the mode screen and the info panel. Update the privacy policy before adding accounts, payments, analytics or any third-party service.
- SEO and app basics: title, description, canonical, Open Graph/Twitter card (`brand/og.jpg`, 1200x630), JSON-LD `VideoGame` in the `<head>` of `index.html`; favicons (`favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`), `manifest.webmanifest` with `icon-192/512.png` and a maskable icon (installable web app, groundwork for a Play Store TWA), `robots.txt`, `sitemap.xml`.
- No build step. Vercel serves the files statically.

## Product decisions
- International audience: English is the default language for everyone (also German browsers); German only when the player picks it (button in the header, stored in localStorage `wms-lang`). Translations live in the small script before the main game script: exact phrases in `D`, composed sentences as regex patterns in `P`. Any new German UI text needs an English entry there.
- USA vs Russia is free. Every other nation is paid: 3 nations of your choice 2.99 EUR, all nations 4.99 EUR (includes every nation added later: `ownedNations()` treats a paid `all` checkout as owning all `PAID_NATIONS`),
  league pass 0.99 EUR per season. Owner is a Kleinunternehmer (§ 19 UStG, no VAT). Stripe Checkout created by the
  `checkout` action (inline price_data, consent to immediate unlock required, stored in `checkouts`); the function itself
  asks Stripe whether a session is paid (`me` action, on return via `?paid=`), no webhook. Ownership lives server-side in
  `owned_nations` / `league_passes`, never in localStorage (client keeps it in memory in `OWNED`). Bought nations are
  playable offline, online and in the league; the server checks ownership for `create` and `queue`. Terms in `agb.html`. Payment methods come from the Stripe dashboard (no `payment_method_types` in the code); PayPal is enabled there, linked to the owner's PayPal business account anrufassist@gmail.com (privacy policy mentions PayPal).
- Caricature mode is on by default. King heads are Grok-made busts (white background) turned into cutouts by `brand/heads-src/make_heads.py` (flood-fills the background, cuts just below the tie knot, keeps only a collar-wide band below the chin, writes aspect and eye positions); `window.HEADS[key]` = normal, `window.CRY[key]` = sad face for the jail, `CRY_EYES[key]` = where the 3D tears start. Head keys: usa `kw`, rus `kb`, chn, ger, eu, ind, gbr. Grok prompt: use an existing bust (not Trump, his hair leaks) as style reference only and describe hair, glasses and clothes explicitly.
- View: header button "View" opens camera presets (Free 3D default, Play view, Top view) plus the caricature/flag toggles. Every preset is fitted by `fitCamera()` so the whole board fits between header and info panel (camera view offset); stored in localStorage `wms-view`. The "2D pieces" toggle in that menu swaps every piece for a big flat classic piece (the cburnett set, `CBURNETT`, filled with the nation colour, nearly square-sized for phones; dark nations use the black set) (`makeFlatPiece()`); in 2D the last move is highlighted stronger and move targets are grey dots; in 2D the frame and rim are hidden (`boardDecor()`), the board fills the screen width (`FIT_FLAT` in `fitCamera()`) and the coordinates sit on the edge squares (`COORD`, follows the viewing side), forces the top view straight down and is stored in `wms-flat`; choosing another view turns it off.
- Backgrounds: the View menu also picks the scene background: Kartentisch (default, goes with the wood board), Classic (grid floor), Kommandotisch (goes with steel), Erde bei Nacht, Gipfeltreffen (summit table, goes with marble). The non-classic ones are AI-generated WebP images in `bg/` (loaded lazily, lying flat under the board, scaled up on portrait screens), stored in localStorage `wms-bg`.
- Board styles: the View menu also picks the board: Holz (default) and Marmor use AI-generated photo textures in `board/` (each square a different cut, loaded lazily), Stahl is drawn, Klassisch is the original flat board; stored in localStorage `wms-board` (`setBoard()`, `drawRim()` redraws the coordinate rim). Lighting: ACES tone mapping plus a small studio environment map; `polish()` makes every piece a bit glossier and its colours richer, image parts (heads, crowns, sprites, backgrounds) are excluded from tone mapping.
- Volume: one header button opens sliders for sounds and music (0-100 %, default sounds 30 %, music 70 %, 0 = off), stored in localStorage `wms-vol`. All sound effects go through `sfxBus()`, music through `musicBus()`. Recorded ElevenLabs sounds in `window.SFX`: moves `p r n b` plus `q` (high heels) and `k` (leather shoes), captures `xp xr xb xn xk` (`xk` = slap, also for the queen), `mate`, `jail`, `sel` (piece picked); each falls back to the synthesized Web Audio sound when missing. After a recorded capture no extra explosion plays.
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
  and the per-minute `sweep_clocks()` cron, abandoned games: clients `ping` every 15 s while a rated game is open (`game_seen`, migrations/007), the opponent may `abandon`-claim the win after 2 minutes without a ping or move (before both sides moved it only aborts); online games show a pill under the header (`renderTurn()`): big green "Du bist am Zug" with a short chime and a ♟ tab title when the turn passes to you, the 60 s first-move countdown there (red under 20 s), grey "Gegner ist am Zug" otherwise; leaving a running rated game asks to resign, Elo settled once in SQL `finish_game()` (start 1200, K 40 for the first
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
  league or buy. League players can search for league opponents only (`queue` with `league:true`, `match_queue.league_only`, migrations/008; after 2 minutes the client offers to allow everyone); every rated game shows whether it counts (`league_status` action: "Liga-Partie: du spielst gerade für …" or why not) and the points afterwards.
- Login rule: playing is always free without login; an account is only needed to buy, play rated or join the league.
- Account menu: header button "Konto" (`openAcct('menu')`, `renderMenu()`) in every mode: name/Elo or sign-in, bought nations, league nation, "Länder kaufen" (shop), Nations League, Rangliste, sign out, delete. The online area only shows who you are plus a link into it. The nation picker shows compact flag tiles in two groups, "Spielbereit" (free + owned) and "Freischalten" (price once in the group heading); free nations carry a green "Kostenlos/Free" sticker until the player owns a paid nation; the league pane offers "Weitere Länder kaufen" also after entering. The difficulty select is only shown against the AI. When only one owned nation is left for the opponent (guests: USA/Russia), the picker skips the second step and starts the game.
- Nation colours must stay distinct: USA navy, Russia red, Europe silver-white, China gold,
  Germany anthracite, Israel sky blue, Iran green, India saffron, UK royal purple, Brazil canary yellow with green (helmets/metal, so it never looks like China's gold). Queens stand slightly below king height, measured head to foot (Liberty's raised torch does not count). Size balance in `makePiece()`: caricature heads `HEAD_SCALE` .9, every other piece `PIECE_SCALE` 1.07 (not in 2D mode).

## Working rules
- After editing, syntax-check the main script with node before pushing.
- Changes go to a branch and a pull request. While the owner is the only player he tests live: merge to `main` right away and tell him the Supabase steps (SQL migrations, function redeploy) needed first.
- Keep everything a nation needs together: `NATIONS` entry, flag texture branch, queen builder,
  queen scale, king lapel pin, picker flag SVG (`FLAGS`, the real flag from flag-icons 4x3, MIT, see vendor/THIRD_PARTY.md), crown pearls, hover CSS, English name and the server's `PAID_NATIONS`.

## Marketing clips
- `tools/clip/` records scripted games as vertical videos (see its README). The game page itself stays untouched; `make_video_page.py` patches a copy.
- Owner's wish for every clip: close-ups of the caricature heads, not only in the jail (e.g. an orbit around the board at the start with the heads looking into the camera). Ready texts and the post log live in `marketing/POSTS.md`.
