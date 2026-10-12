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
- International audience: English is the default language; German when the browser is German or the player picks it (button in the header, stored in localStorage `wms-lang`). Translations live in the small script before the main game script: exact phrases in `D`, composed sentences as regex patterns in `P`. Any new German UI text needs an English entry there.
- USA vs Russia is free. Every other nation is paid (purchase is simulated for now, unlocks in
  localStorage `wms-unlocked`). Planned pricing: bundle of 3 nations 2.99 EUR, all nations 4.99 EUR.
- Caricature mode is on by default.
- Online 1v1 only works inside the Claude artifact runtime (`window.claude`); on the website the
  button is hidden until a real backend (e.g. Supabase) with login and ranking exists.
- Nation colours must stay distinct: USA navy, Russia red, Europe silver-white, China gold,
  Germany anthracite, Israel sky blue, Iran green. Queens stand slightly below king height.

## Working rules
- After editing, syntax-check the main script with node before pushing.
- Keep everything a nation needs together: `NATIONS` entry, flag texture branch, queen builder,
  queen scale, king lapel pin, picker flag SVG and hover CSS.
