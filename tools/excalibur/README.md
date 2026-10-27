# Excalibur ad (AI Challenge)

Code-motion video built with the code-motion-video skill: `index.html` draws every frame from `window.seek(t)`,
`render.mjs` renders it (30 fps, 4 subframes motion blur), `sound.py` makes the placeholder score, `mix.sh` lays the
voice over it (music ducked, -14 LUFS).

Working copy (gitignored): `marketing/excalibur/video/` with `plates/p1-5.png` (game stills rendered by
`tools/clip/capture.js` with `HD=1 PLATE=n CLIP=plates TESTJS=.../plates.js`), `fonts/` (from the repo's `fonts/`)
and `vo.mp3` (ElevenLabs voice "Rex Thunder", take 1, light reverb added locally).

Run: `python3 -m http.server 8765` in the working copy, `node stills.mjs 0 7.5 ...`, then `node render.mjs --dur 27`,
`python3 sound.py`, `./mix.sh [music.wav]`. Final music: Suno track "Quis Erit Primus" (owner), cut 0:28-0:55 to `out/suno27.wav`, `python3 sfx.py`, `MUVOL=0.7 ./mix.sh out/suno27.wav out/sfx.wav` (logo: copy `brand/logo-transparent.png` to `logo.png`).
