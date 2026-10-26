# Placeholder epic score + hits for the Excalibur ad (numpy only). Writes out/sound.wav (48 kHz stereo).
# Hits sit on the T times of index.html; the Suno track can replace the music bed later (keep the hits).
import numpy as np, wave
SR = 48000; DUR = 27.0; N = int(SR * DUR)
out = np.zeros((N, 2))
rng = np.random.default_rng(7)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); s = sig[: max(0, N - i)] * gain
    out[i:i + len(s), 0] += s * (1 - pan) ** .5; out[i:i + len(s), 1] += s * (1 + pan) ** .5

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc = (1 - a) * v + a * acc; y[i] = acc
    return y

def env(n, att, dec):
    t = np.arange(n) / SR; return np.minimum(1, t / max(att, 1e-4)) * np.exp(-t / dec)

def saw(f, dur):
    t = np.arange(int(dur * SR)) / SR; return 2 * ((t * f) % 1) - 1

def braam(t0, root=36.71, dur=3.2, g=.55):   # big low brass-like hit (D1 + fifths)
    n = int(dur * SR); s = sum(saw(root * m, dur) * a for m, a in ((1, 1), (2, .7), (3, .45), (1.5, .5), (4, .25)))
    s = lowpass(s, 700) * env(n, .03, 1.1); add(s / np.abs(s).max(), t0, g)

def taiko(t0, g=.8):
    n = int(.9 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (55 + 60 * np.exp(-t * 25)) * t) * np.exp(-t * 6) + .25 * lowpass(rng.standard_normal(n), 900) * np.exp(-t * 30)
    add(s / np.abs(s).max(), t0, g)

def whoosh(t_end, dur=.7, g=.35):
    n = int(dur * SR); x = rng.standard_normal(n); t = np.arange(n) / dur / SR
    y = np.empty(n); acc = 0.0
    for i in range(n):
        fc = 300 + 5000 * t[i] ** 2; a = np.exp(-2 * np.pi * fc / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc
    add(y * np.sin(np.pi * t) ** 2 / np.abs(y).max(), t_end - dur, g)

def bell(t0, f=587.33, g=.35):
    n = int(4 * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * m * t) * a * np.exp(-t * (1.2 + m * .6)) for m, a in ((1, 1), (2.76, .5), (5.4, .25), (8.9, .12)))
    add(s / np.abs(s).max(), t0, g, -.2); add(s / np.abs(s).max(), t0 + .012, g * .8, .2)

# drone bed: D minor pad, darker at first, brighter for the final question
t = np.arange(N) / SR
pad = sum(np.sin(2 * np.pi * f * t + p) for f, p in ((73.42, 0), (110.0, 1), (146.83, 2), (174.61, 3)))
pad += .4 * sum(np.sin(2 * np.pi * f * 1.003 * t) for f in (73.42, 146.83))
lvl = .10 + .06 * np.clip((t - 4.6) / 2, 0, 1) + .08 * np.clip((t - 18.3) / .4, 0, 1)
lvl *= np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 2.5, 0, 1)
pad = pad / np.abs(pad).max() * lvl; out[:, 0] += pad; out[:, 1] += pad

braam(0.0, g=.45); braam(4.65); braam(10.4, g=.6); braam(14.95, g=.5)
for k, tt in enumerate(np.arange(10.4, 14.9, .75)): taiko(tt, .55 + .1 * (k % 2))   # war drums under the punishing shots
for tt in (12.0, 13.5): taiko(tt, .9)
taiko(6.65, .6)                       # someone tries the sword
taiko(16.45, .9)                      # 0 WINNERS stamp
for tt in (4.65, 10.4, 14.95): whoosh(tt)
whoosh(18.35, 2.0, .45)               # long riser into the question
braam(18.35, root=36.71, dur=5, g=.75); taiko(18.35, 1.0)
bell(20.75)

out /= np.abs(out).max() / .9
fade = np.clip((DUR - t) / .8, 0, 1); out *= fade[:, None]
w = wave.open('out/sound.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close(); print('out/sound.wav')
