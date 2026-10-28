# Third-party code and assets

| What | Where | License |
|---|---|---|
| three.js r128 | `vendor/three-r128.min.js`, `vendor/OrbitControls-r128.js` | MIT |
| chess.js 0.10.3 | `vendor/chess-0.10.3.js` | BSD-2-Clause |
| supabase-js 2.117.3 | `vendor/supabase-2.117.3.js` | MIT |
| flag-icons 7.2.3 (national flags in the picker and shop, inlined as `FLAGS` in `index.html`) | https://github.com/lipis/flag-icons | MIT, Copyright (c) 2013 Panayiotis Lipiridis |
| Stockfish.js 18 lite, single-threaded WASM (trainer engine, runs in a Web Worker) | `vendor/stockfish/`, source: https://github.com/nmrugg/stockfish.js (npm `stockfish@18.0.8`), based on https://github.com/official-stockfish/Stockfish | GPLv3, full text in `vendor/stockfish/COPYING.txt`; the unmodified source is available at the links |
| Opening names (trainer, `vendor/openings.json`, positions → ECO code and name) | https://github.com/lichess-org/chess-openings | CC0 1.0 |
| Chess pieces "cburnett" (2D mode, inlined as `CBURNETT` in `index.html`, recoloured in nation colours) | https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces, also the Lichess default set | by Colin M.L. Burnett; multi-licensed on Wikimedia Commons (GFDL, CC BY-SA 3.0, BSD, GPL), used under the BSD license |
