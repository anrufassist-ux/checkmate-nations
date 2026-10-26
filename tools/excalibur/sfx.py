# Sound effects on the picture events of index.html (times = T), laid over the Suno music. Writes out/sfx.wav.
import numpy as np, wave
SR = 48000; DUR = 27.0; N = int(SR * DUR)
out = np.zeros((N, 2)); rng = np.random.default_rng(11)
T = dict(swordIn=4.65, tries=6.65, nobody=8.25, plate2=10.4, plate3=12.0, plate4=13.5, hallIn=14.95, empty=16.45,
         willIn=18.35, urlIn=20.75)

def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); s = sig[: max(0, N - i)] * gain
    out[i:i + len(s), 0] += s * (1 - pan) ** .5; out[i:i + len(s), 1] += s * (1 + pan) ** .5

def lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc = (1 - a) * v + a * acc; y[i] = acc
    return y

def norm(x): return x / (np.abs(x).max() + 1e-9)

def impact(dur=1.6):          # cinematic boom: sub drop + noise burst
    n = int(dur * SR); t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 70 * np.exp(-t * 14)) * t) * np.exp(-t * 2.6)
    burst = lp(rng.standard_normal(n), 1800) * np.exp(-t * 18)
    return norm(sub + .5 * burst)

def metal(dur=1.4, f0=420):    # sword ring / clang: inharmonic partials
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f0 * m * t) * a * np.exp(-t * d) for m, a, d in ((1, 1, 3), (2.41, .6, 4), (3.93, .45, 5), (5.6, .3, 7), (8.2, .2, 9)))
    s += .3 * rng.standard_normal(n) * np.exp(-t * 60)
    return norm(s)

def rattle(dur=1.1):           # sword shaking in the stone: fast metal ticks
    n = int(dur * SR); s = np.zeros(n)
    for k in range(16):
        i = int(k * .065 * SR); c = metal(.25, 900 + 120 * (k % 3))[: n - i] * (1 - k / 16); s[i:i + len(c)] += c
    return norm(s)

def whoosh(dur=.6):
    n = int(dur * SR); x = rng.standard_normal(n); u = np.arange(n) / n; y = np.empty(n); acc = 0.0
    for i in range(n):
        fc = 250 + 6000 * u[i] ** 2; a = np.exp(-2 * np.pi * fc / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc
    return norm(y * np.sin(np.pi * u) ** 2)

def stamp():                   # heavy rubber stamp: thud + paper slap
    n = int(.7 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (70 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 12) + .6 * lp(rng.standard_normal(n), 3000) * np.exp(-t * 45)
    return norm(s)

def shimmer(dur=2.5):          # magic glint for the URL / logo
    n = int(dur * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (2 + i)) * np.clip(t / .02, 0, 1) for i, f in enumerate((1568, 2093, 2637, 3136)))
    return norm(s)

add(whoosh(), T['swordIn'] - .55, .35); add(metal(1.8, 380), T['swordIn'], .45)       # the sword appears, rings
add(rattle(), T['tries'], .5)                                                          # someone tries to pull it
add(impact(), T['nobody'], .7)                                                         # nobody pulls it out
for k in ('plate2', 'plate3', 'plate4'): add(whoosh(.35), T[k] - .3, .3); add(impact(1.2), T[k], .75)
add(whoosh(.5), T['hallIn'] - .45, .3)
add(stamp(), T['empty'], .9)                                                           # 0 WINNERS stamp
add(impact(2.2), T['willIn'], .85)                                                     # the question lands
add(shimmer(), T['urlIn'], .35, -.2); add(shimmer(), T['urlIn'] + .6, .3, .2)          # URL, then logo
out /= np.abs(out).max() / .9
w = wave.open('out/sfx.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((out * 32767).astype('<i2').tobytes()); w.close(); print('out/sfx.wav')
