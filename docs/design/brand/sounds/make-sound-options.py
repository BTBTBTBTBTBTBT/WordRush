"""Wordocious sound OPTIONS for the founder + Johnny to judge (10-05), and the Sound Lab page.
Same toolkit as make-sounds.py (soft sines, FM bells, filtered noise) plus a few toy timbres
(marimba, glockenspiel, music box, soft retro "chip", tiny voices). Never touches the shipped pack.
  python3 docs/design/brand/sounds/make-sound-options.py
    -> sounds/options/<name>.m4a (AAC 96k)  [WAV masters go to $WAV_DIR or a temp dir, not the repo]
  then python3 docs/design/brand/sounds/build-lab.py -> sounds/lab.html (the Sound Lab, self-contained)
To ship a pick: copy options/<name>.m4a to out/<event>.m4a, then run ship-sounds.sh."""
import base64, json, os, subprocess, tempfile, html
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OPT = os.path.join(HERE, 'options'); os.makedirs(OPT, exist_ok=True)
CUR = os.path.join(HERE, 'out')
WAV = os.environ.get('WAV_DIR') or tempfile.mkdtemp(prefix='wordo-sfx-'); os.makedirs(WAV, exist_ok=True)
rng = np.random.default_rng(1005)
N = lambda m: 440 * 2 ** ((m - 69) / 12)   # midi -> Hz

# ── The shared helpers (same shapes as make-sounds.py) ─────────────────────
def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.004, d=None, curve=6.0):
    x = np.arange(n) / SR; e = np.minimum(1, x / max(a, 1e-4))
    dd = (n / SR) if d is None else d
    return e * np.exp(-curve * x / dd)
def sweep(f0, f1, d):
    x = t(d); f = f0 * (f1 / f0) ** (x / d); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def bell(f, d, ratio=2.0, index=1.2, curve=5.0):
    x = t(d); mod = index * np.exp(-4 * x / d) * np.sin(2 * np.pi * f * ratio * x)
    return np.sin(2 * np.pi * f * x + mod) * env(len(x), 0.002, d, curve)
def soft(f, d, curve=7.0):
    x = t(d); return (np.sin(2*np.pi*f*x) + 0.18*np.sin(4*np.pi*f*x)) * env(len(x), 0.003, d, curve)
def noise(d, lo, hi, curve=8.0):
    b, a = butter(2, [lo / (SR/2), hi / (SR/2)], 'band'); n = lfilter(b, a, rng.standard_normal(int(SR*d)))
    return n / (np.abs(n).max() + 1e-9) * env(len(n), 0.002, d, curve)
def lp(sig, fc, order=2): b, a = butter(order, fc / (SR/2)); return lfilter(b, a, sig)
def at(buf, sig, sec, gain=1.0):
    i = int(round(sec * SR)); end = i + len(sig)
    if end > len(buf): buf = np.concatenate([buf, np.zeros(end - len(buf))])
    buf[i:end] += sig * gain; return buf
def verb(sig, mix=0.2, taps=((0.031, .5), (0.047, .38), (0.071, .27), (0.103, .18), (0.149, .1), (0.21, .06))):
    wet = np.concatenate([sig, np.zeros(int(SR * 0.3))]); dry = wet.copy()
    for dt, g in taps: wet = at(wet, sig * g, dt)
    return lp(wet, 7000) * mix + dry * (1 - mix)

# ── Toy timbres ────────────────────────────────────────────────────────────
def marimba(f, d=0.5):
    """Warm wooden bar: fundamental + the bar's ~3.9x and ~9.2x modes (fast decay) + a soft mallet."""
    x = t(d); a = np.minimum(1, x / 0.0015)
    s = (np.sin(2*np.pi*f*x) * np.exp(-x * 7 / d) + 0.32 * np.sin(2*np.pi*3.93*f*x) * np.exp(-x * 30 / d)
         + 0.08 * np.sin(2*np.pi*9.2*f*x) * np.exp(-x * 70 / d))
    return lp(s * a, 6000)
def glock(f, d=0.7):
    """Bright metal bar (glockenspiel): 1, 2.76, 5.4 modes, long ring."""
    x = t(d); a = np.minimum(1, x / 0.001)
    s = (np.sin(2*np.pi*f*x) * np.exp(-x * 4.5 / d) + 0.28 * np.sin(2*np.pi*2.76*f*x) * np.exp(-x * 12 / d)
         + 0.1 * np.sin(2*np.pi*5.4*f*x) * np.exp(-x * 25 / d))
    return lp(s * a, 9000)
def musicbox(f, d=0.8):
    """Music-box tine: pure tone + soft octave + a tiny inharmonic ping at the start."""
    x = t(d); a = np.minimum(1, x / 0.0012)
    s = (np.sin(2*np.pi*f*x) * np.exp(-x * 5 / d) + 0.2 * np.sin(4*np.pi*f*x) * np.exp(-x * 9 / d)
         + 0.12 * np.sin(2*np.pi*4.2*f*x) * np.exp(-x * 60 / d))
    return lp(s * a, 8000)
def chip(f, d=0.12, curve=6.0):
    """Retro-but-soft pulse: a few odd harmonics, low-passed so it never buzzes."""
    x = t(d); s = np.sin(2*np.pi*f*x) + 0.3*np.sin(6*np.pi*f*x) + 0.12*np.sin(10*np.pi*f*x)
    return lp(s * env(len(x), 0.002, d, curve), 3800)
def coin(f, d=0.35, curve=5.0):
    """The shipped `notify` bell (Johnny's "Hubbub coin"): bell(f, ratio 2, index 0.7)."""
    return bell(f, d, 2.0, 0.7, curve)
def boing(d=0.18, lo=260, hi=520):
    x = t(d); f = lo + (hi - lo) * np.sin(np.pi * x / d) + 18 * np.sin(2 * np.pi * 22 * x)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.004, d, 4)
def bloop(f0=280, f1=760, d=0.09): return sweep(f0, f1, d) * env(int(SR * d), 0.002, d, 6)
def sparkle(buf, start, span, count, lo=96, hi=108, gain=0.18, scale=(0, 2, 4, 7, 9), kind='glock', dur=0.3):
    for _ in range(count):
        m = lo + int(rng.integers(0, hi - lo + 1)); m -= (m % 12) - min(scale, key=lambda s: abs(s - m % 12))
        sig = glock(N(m), dur) if kind == 'glock' else bell(N(m), dur, 3.0, 0.5, 6)
        buf = at(buf, sig, start + rng.uniform(0, span), gain * rng.uniform(0.6, 1.0))
    return buf
def voice(f0, f1, d, syll=2, bright=0.55, vib=0.0, vib_hz=6.0, shape='lin', lpf=3200):
    """A tiny synthesized giggle: a pitch contour sung on soft harmonics, pulsed into syllables."""
    x = t(d)
    f = (f0 + (f1 - f0) * x / d) if shape == 'lin' else (f0 + (f1 - f0) * np.sin(np.pi * x / d))
    f = f * (1 + vib * np.sin(2 * np.pi * vib_hz * x)); ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum((bright ** (h - 1)) * np.sin(h * ph) / h for h in range(1, 7))
    k = (x / d) * syll; pulse = np.sin(np.pi * (k % 1)) ** 1.5      # one bump per syllable
    s = s * pulse * env(len(x), 0.004, d, 2.5)
    return lp(s, lpf)

# ── Save: peak-normalized like the shipped pack, 3 ms fade-in + 8 ms fade-out, no clicks ──
MADE = {}
def level(sig, thr=0.22, ratio=4.0, win=0.008):
    """Gentle leveler for the long, busy pieces: tames the loudest hits so the whole tune sits
    closer to the pack's loudness at the same ~0.65-0.7 peak (no saturation, so nothing turns harsh)."""
    sig = sig / (np.abs(sig).max() + 1e-9); n = int(SR * win)
    e = np.convolve(np.abs(sig), np.ones(n) / n, 'same') * 1.6 + 1e-6
    g = np.where(e > thr, (thr / e) ** (1 - 1 / ratio), 1.0)
    g = np.convolve(g, np.ones(n) / n, 'same')
    return sig * g
def save(name, sig, peak=0.65, cap=None):
    sig = np.asarray(sig, dtype=float)
    if cap and len(sig) > SR * cap:                 # hard length cap with a 250 ms fade
        sig = sig[:int(SR * cap)].copy(); f = int(SR * 0.25); sig[-f:] *= np.linspace(1, 0, f) ** 2
    sig = sig / (np.abs(sig).max() + 1e-9) * peak
    fi = int(SR * 0.003); fo = int(SR * 0.008)
    sig[:fi] *= np.linspace(0, 1, fi); sig[-fo:] *= np.linspace(1, 0, fo)
    # trim trailing near-silence (keeps files tight), keep a 20 ms cushion
    above = np.nonzero(np.abs(sig) > 0.0015)[0]
    if len(above): sig = sig[:min(len(sig), above[-1] + int(SR * 0.02))]; sig[-fo:] *= np.linspace(1, 0, fo)
    w = os.path.join(WAV, f'{name}.wav'); wavfile.write(w, SR, (sig * 32767).astype(np.int16))
    m = os.path.join(OPT, f'{name}.m4a')
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', w, m], check=True)
    MADE[name] = dict(dur=len(sig) / SR, rms=float(np.sqrt(np.mean(sig ** 2))))

# ════════════════════════════════════════════════════════════════════════════
# 1 · Hubbub pangram "1-up" — built on the coin (notify = B5 → E6 bell, ratio 2 / index 0.7)
# ════════════════════════════════════════════════════════════════════════════
# A  Coin Cascade: the coin, then the E-major arpeggio keeps climbing into a chime + sparkle tail.
b = np.zeros(1)
b = at(b, coin(N(83), 0.3), 0.00); b = at(b, coin(N(88), 0.35), 0.075)
for i, m in enumerate([92, 95, 100]): b = at(b, coin(N(m), 0.4, 4.5), 0.15 + i * 0.065, 0.9)
b = at(b, bell(N(100), 0.75, 2.0, 0.5, 3.5), 0.35, 0.7); b = at(b, bell(N(107), 0.7, 2.0, 0.4, 3.8), 0.36, 0.45)
b = sparkle(b, 0.38, 0.45, 10, 100, 112, 0.16, scale=(4, 6, 8, 11, 1))
save('pangram-a', verb(b, 0.24), 0.65)
# B  Triple Coin Climb: three coin pairs stepping up a major third (retro chip under the bell), then a crown chord.
b = np.zeros(1)
for k, (lo, hi) in enumerate([(83, 88), (87, 92), (90, 95)]):
    s0 = k * 0.13
    b = at(b, coin(N(lo), 0.22), s0); b = at(b, chip(N(lo), 0.07), s0, 0.25)
    b = at(b, coin(N(hi), 0.3), s0 + 0.055); b = at(b, chip(N(hi), 0.08), s0 + 0.055, 0.25)
for m, g in [(100, 0.8), (104, 0.55), (107, 0.45)]: b = at(b, bell(N(m), 0.7, 2.0, 0.6, 3.5), 0.42, g)
b = sparkle(b, 0.48, 0.42, 8, 100, 112, 0.14, scale=(4, 8, 11, 1, 6))
save('pangram-b', verb(b, 0.22), 0.65)
# C  Sparkle Bloom: the coin, a quick pentatonic run up, blooming into a music-box chord with a soft shimmer.
b = np.zeros(1)
b = at(b, coin(N(83), 0.3), 0.00); b = at(b, coin(N(88), 0.32), 0.085)
for i, m in enumerate([90, 92, 95, 97, 100, 102, 104]): b = at(b, glock(N(m), 0.3), 0.18 + i * 0.03, 0.42)
bloom = np.zeros(1)
for m, g in [(88, 0.7), (95, 0.6), (100, 0.6), (104, 0.45)]: bloom = at(bloom, musicbox(N(m), 0.8), 0, g)
x = t(len(bloom) / SR); bloom = bloom * (1 + 0.25 * np.sin(2 * np.pi * 7 * x))   # music-box shimmer
b = at(b, bloom, 0.40)
b = sparkle(b, 0.45, 0.5, 7, 102, 112, 0.12, scale=(4, 8, 11, 1, 6))
save('pangram-c', level(verb(b, 0.26)), 0.65)

# ════════════════════════════════════════════════════════════════════════════
# 2 · Intro jingle — cut to the iOS cold-start clock (ColdStartIntro.swift, pace 1.4):
#   0.00 W pops (bounce apex ≈0.25) · 0.59 + k·0.084 the nine pop-ins · 1.68–2.17 glide up · 2.17 land
#   + the all-cast hop flourish (2.17 + i·0.05, 0.42 each → ends ≈3.04)
# ════════════════════════════════════════════════════════════════════════════
POPS = [0.588 + 0.084 * k + 0.04 for k in range(9)]; GLIDE = 1.68; LAND = 2.17
def glide_whoosh(gain=0.22):
    x = t(0.5); return noise(0.5, 900, 6000, 1.5) * np.sin(np.pi * x / 0.5) ** 2 * gain
# A  Marimba Parade: a warm marimba walks up C-major pentatonic, one note per hero, glock "ta-da" on landing.
b = np.zeros(int(SR * 3.2))
b = at(b, bloop(), 0.02, 0.45); b = at(b, marimba(N(67), 0.5), 0.22, 0.8)
for s0, m in zip(POPS, [72, 74, 76, 79, 81, 84, 86, 88, 91]): b = at(b, marimba(N(m), 0.45), s0, 0.62)
b = at(b, glide_whoosh(0.2), GLIDE - 0.05)
for i, m in enumerate([84, 88, 91, 96]): b = at(b, glock(N(m), 1.0), LAND + i * 0.012, 0.5)
b = at(b, marimba(N(48), 0.7), LAND, 0.7); b = at(b, marimba(N(60), 0.6), LAND, 0.45)
b = sparkle(b, LAND + 0.08, 0.5, 12, 96, 108, 0.16)
save('intro-a', level(verb(b, 0.22)), 0.65, cap=3.0)
# B  Music Box: a twinkly music-box tune over soft pizzicato bass, harp-style run on the glide, rolled chord on landing.
b = np.zeros(int(SR * 3.2))
b = at(b, musicbox(N(79), 0.7), 0.04, 0.8); b = at(b, soft(N(48), 0.3, 6), 0.04, 0.5)
for s0, m in zip(POPS, [84, 88, 86, 89, 88, 91, 93, 91, 95]): b = at(b, musicbox(N(m), 0.55), s0, 0.55)
b = at(b, soft(N(55), 0.3, 6), POPS[4], 0.4)
for i, m in enumerate([84, 86, 88, 91, 93, 96, 98, 100]): b = at(b, musicbox(N(m), 0.35), GLIDE + 0.05 + i * 0.045, 0.3)
for i, m in enumerate([91, 96, 100, 103]): b = at(b, musicbox(N(m), 1.0), LAND + i * 0.04, 0.55)
b = at(b, soft(N(48), 0.5, 5), LAND, 0.6); b = at(b, soft(N(36), 0.5, 5), LAND, 0.35)
b = sparkle(b, LAND + 0.15, 0.45, 10, 100, 110, 0.13, kind='bell')
save('intro-b', level(verb(b, 0.25)), 0.65, cap=3.0)
# C  Glock & Boing: the W lands with a boing, a zig-zag glockenspiel climb, a slide-whistle glide, then "ta-DA!".
b = np.zeros(int(SR * 3.2))
b = at(b, boing(0.2, 280, 600), 0.02, 0.55); b = at(b, glock(N(72), 0.5), 0.24, 0.55)
for s0, m in zip(POPS, [72, 76, 74, 77, 76, 79, 77, 81, 83]): b = at(b, glock(N(m), 0.4), s0, 0.5)
x = t(0.46); f = 620 * (1500 / 620) ** (x / 0.46) * (1 + 0.012 * np.sin(2 * np.pi * 7 * x))
slide = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * x / 0.46) ** 1.5
b = at(b, lp(slide, 3000), GLIDE, 0.28)
for m in [79, 83, 86]: b = at(b, glock(N(m), 0.25), LAND - 0.13, 0.35)            # "ta-"
for i, m in enumerate([84, 88, 91, 96]): b = at(b, glock(N(m), 1.0), LAND + i * 0.008, 0.5)   # "DA!"
b = at(b, marimba(N(48), 0.7), LAND, 0.7)
b = sparkle(b, LAND + 0.1, 0.5, 12, 96, 108, 0.15)
save('intro-c', level(verb(b, 0.22)), 0.65, cap=3.0)

# ════════════════════════════════════════════════════════════════════════════
# 3 · Extras (2 options each)
# ════════════════════════════════════════════════════════════════════════════
CAST = [('w', 'W', 'the confident leader'), ('o1', 'O', 'the bubbly cheerleader'), ('r', 'R', 'sleepy'),
        ('d', 'D', 'the brainy one'), ('o2', 'O', 'the dramatic star'), ('c', 'C', 'the curious explorer'),
        ('i', 'I', 'shy and sweet'), ('o3', 'O', 'the goofy prankster'), ('u', 'U', 'zen'), ('s', 'S', 'speedy')]
# Cast tap-to-laugh, set A "Giggles": tiny synthesized voices.
def giggle(cid):
    if cid == 'w':  return voice(560, 470, 0.26, 2, 0.5)
    if cid == 'o1': return voice(820, 1000, 0.3, 4, 0.5)
    if cid == 'r':  return voice(360, 250, 0.5, 1, 0.35, 0.03, 4)                     # a little yawn
    if cid == 'd':
        b = np.zeros(1)
        for i, f in enumerate([880, 1175, 740]): b = at(b, chip(f, 0.06, 5), i * 0.07)
        return b
    if cid == 'o2': return voice(520, 900, 0.36, 2, 0.5, 0.025, 6.5, shape='arc')      # "ooh-hoo!"
    if cid == 'c':  return voice(430, 720, 0.22, 1, 0.45)                              # "hm?"
    if cid == 'i':  return voice(980, 900, 0.2, 2, 0.4)                         # tee-hee (quieter)
    if cid == 'o3': return voice(420, 420, 0.34, 3, 0.55, 0.12, 9)                     # wobbly "hyuk"
    if cid == 'u':
        x = t(0.55); return lp((np.sin(2*np.pi*330*x) + 0.25*np.sin(2*np.pi*660*x)) * np.sin(np.pi * x / 0.55) ** 2, 2000) * 0.8
    if cid == 's':  return voice(620, 1050, 0.18, 4, 0.5)
# Set B "Toy chimes": each hero's own little instrument riff.
def chime(cid):
    b = np.zeros(1)
    seq = {'w': ('glock', [79, 83, 86], 0.06), 'o1': ('marimba', [84, 88, 84, 91], 0.055),
           'r': ('marimba', [67, 64], 0.2), 'o2': ('musicbox', [84, 88, 91, 96], 0.035),
           'c': ('musicbox', [84, 88, 93], 0.09), 'i': ('musicbox', [96, 100], 0.08),
           's': ('glock', [84, 86, 88, 91, 93], 0.032)}
    if cid in seq:
        kind, notes, gap = seq[cid]; fn = dict(glock=glock, marimba=marimba, musicbox=musicbox)[kind]
        for i, m in enumerate(notes): b = at(b, fn(N(m), 0.4 if cid != 'r' else 0.6), i * gap, 0.6 if cid == 'i' else 1)
        return b
    if cid == 'd':
        for i, f in enumerate([1320, 990, 1480]): b = at(b, chip(f, 0.05, 5), i * 0.05)
        return b
    if cid == 'o3': b = at(b, boing(0.2, 240, 480), 0); return at(b, glock(N(79), 0.3), 0.14, 0.5)
    if cid == 'u': return bell(N(77), 0.9, 2.76, 0.35, 3.0)                            # singing bowl
for cid, _, _ in CAST:
    pk = {'i': 0.32, 'u': 0.38, 'r': 0.4}.get(cid, 0.45)          # shy I + zen U + sleepy R sit lower
    save(f'laugh-a-{cid}', verb(giggle(cid), 0.12), pk)
    save(f'laugh-b-{cid}', verb(chime(cid), 0.15), pk)

# Hubbub coin tiers by word length (4 · 5 · 6 · 7 · 8+ letters)
TIERS = ['4', '5', '6', '7', '8+']
for k, st in enumerate([0, 2, 4, 5, 7]):          # A: the same coin, pitched up
    b = np.zeros(1); b = at(b, coin(N(83 + st)), 0); b = at(b, coin(N(88 + st), 0.45), 0.12)
    if k == 4: b = sparkle(b, 0.2, 0.25, 4, 100, 110, 0.15, scale=(4, 8, 11, 1, 6))
    save(f'tier-a-{TIERS[k]}', verb(b, 0.2), 0.55)
for k in range(5):                                 # B: more coins for longer words (the pitch climbs with them)
    notes = [83, 88, 92, 95, 100, 104][:2 + k]
    b = np.zeros(1)
    for i, m in enumerate(notes): b = at(b, coin(N(m), 0.32 if i < len(notes) - 1 else 0.45), i * 0.07)
    save(f'tier-b-{TIERS[k]}', verb(b, 0.2), 0.55)

# Level-up fanfare
b = np.zeros(1)                                    # A Toy Fanfare: marimba pickup triplet → glock chord
for i in range(3): b = at(b, marimba(N(79), 0.25), i * 0.085, 0.7); b = at(b, glock(N(79), 0.2), i * 0.085, 0.25)
b = at(b, marimba(N(84), 0.6), 0.28, 0.9); b = at(b, glock(N(84), 0.6), 0.28, 0.4)
for i, m in enumerate([84, 88, 91, 96]): b = at(b, glock(N(m), 1.1), 0.46 + i * 0.012, 0.5)
b = at(b, marimba(N(48), 0.8), 0.46, 0.75); b = sparkle(b, 0.55, 0.6, 10, 96, 108, 0.15)
save('levelup-a', level(verb(b, 0.24)), 0.7)
b = np.zeros(1)                                    # B Rising Stairs: a glock scale up into a shimmering maj7 chord
for i, m in enumerate([72, 74, 76, 77, 79, 81, 83, 84]): b = at(b, glock(N(m), 0.35), i * 0.05, 0.45)
ch = np.zeros(1)
for m, g in [(84, .6), (88, .5), (91, .5), (95, .4)]: ch = at(ch, musicbox(N(m), 1.0), 0, g); ch = at(ch, glock(N(m), 1.0), 0, g * 0.5)
x = t(len(ch) / SR); b = at(b, ch * (1 + 0.2 * np.sin(2 * np.pi * 6 * x)), 0.42)
b = at(b, soft(N(48), 0.6, 5), 0.42, 0.5); b = sparkle(b, 0.5, 0.7, 9, 98, 110, 0.13)
save('levelup-b', level(verb(b, 0.26)), 0.7)

# Achievement unlocked (alternatives to the shipped `unlock`)
b = np.zeros(1)                                    # A Badge Shine: a soft F → C chord reveal + sparkle
for m in [77, 81, 84]: b = at(b, bell(N(m), 0.45, 2.0, 0.6, 5), 0, 0.5)
for i, m in enumerate([84, 88, 91, 96]): b = at(b, glock(N(m), 0.9), 0.18 + i * 0.01, 0.5)
b = sparkle(b, 0.25, 0.55, 9, 96, 110, 0.15)
save('achieve-a', level(verb(b, 0.24)), 0.65)
b = np.zeros(1)                                    # B Treasure Pop: a bubbly pop + quick arpeggio + twinkle
b = at(b, bloop(300, 900, 0.08), 0, 0.6)
for i, m in enumerate([84, 88, 91, 96]): b = at(b, bell(N(m), 0.45, 2.0, 0.8, 4.5), 0.06 + i * 0.05)
b = sparkle(b, 0.3, 0.45, 8, 98, 110, 0.16, kind='bell')
save('achieve-b', verb(b, 0.22), 0.65)

# Game open: a soft "page arriving"
x = t(0.32); b = noise(0.32, 700, 5000, 1.5) * np.sin(np.pi * x / 0.32) ** 2 * 0.6   # A Page Breeze: breeze + one chime
b = at(b, musicbox(N(88), 0.45), 0.2, 0.55); b = at(b, musicbox(N(93), 0.5), 0.27, 0.5)
save('open-a', verb(b, 0.2), 0.4)
b = np.zeros(1)                                    # B Page Flutter: three paper flicks + a glock up-third
for i in range(3): b = at(b, noise(0.035, 1800, 6500, 6), i * 0.045, 0.55 - i * 0.1)
b = at(b, glock(N(84), 0.45), 0.15, 0.6); b = at(b, glock(N(88), 0.5), 0.21, 0.6)
save('open-b', verb(b, 0.2), 0.4)

# ════════════════════════════════════════════════════════════════════════════
# 4 · Alternatives for EVERY shipped sound (v2, founder 10-05: "the current sound next to other options").
#   alt-<sound>-a = softer · -b = brighter · -c = more playful. Peaks match the shipped sound's.
# ════════════════════════════════════════════════════════════════════════════
PK = dict(tap=.55, delete=.5, flip=.5, press=.5, release=.35, hop=.5, invalid=.55, win=.7, lose=.55, celebrate=.6,
          streak=.65, tick=.35, notify=.55, unlock=.65, vs=.6, whoosh=.3)
def alt(name, k, sig, v=0.0, pk=None): save(f'alt-{name}-{k}', verb(sig, v) if v else sig, pk or PK[name])
def mix(a, b, g=1.0): return at(np.array(a, dtype=float), b, 0, g)
def glide(f0, f1, d, curve=7, a=0.002): return sweep(f0, f1, d) * env(int(SR * d), a, d, curve)
# tap
alt('tap', 'a', lp(glide(520, 430, 0.07, 7, 0.004), 1800))                                  # felt
alt('tap', 'b', mix(bell(1480, 0.06, 2.0, 0.5, 9), bell(2960, 0.03, 2.0, 0.3, 10), 0.3))        # glass
alt('tap', 'c', glide(480, 900, 0.055, 6))                                                    # bubble
# delete
alt('delete', 'a', lp(glide(380, 300, 0.09, 6, 0.004), 1500))
alt('delete', 'b', at(bell(1320, 0.05, 2.0, 0.4, 9), bell(990, 0.06, 2.0, 0.4, 9), 0.035))
alt('delete', 'c', glide(820, 340, 0.08, 5))
# flip
alt('flip', 'a', lp(noise(0.06, 600, 2500, 14) * 0.5 + soft(880, 0.06, 9), 3000))             # soft card
alt('flip', 'b', mix(bell(1660, 0.06, 2.0, 0.5, 9), noise(0.03, 3000, 7000, 25), 0.2))            # glass click
alt('flip', 'c', marimba(N(84), 0.09))                                                         # wood block
# press / release
alt('press', 'a', lp(glide(200, 480, 0.08, 6, 0.004), 1400))
alt('press', 'b', glide(400, 1250, 0.06, 6))
x = t(0.09); alt('press', 'c', np.sin(2*np.pi*np.cumsum(600 + 300*x/0.09 + 40*np.sin(2*np.pi*35*x))/SR) * env(len(x), 0.002, 0.09, 5))   # rubber squeak
alt('release', 'a', lp(glide(700, 900, 0.05, 8, 0.003), 2000))
alt('release', 'b', glide(1200, 1850, 0.04, 8))
alt('release', 'c', glide(900, 1500, 0.06, 6) * (1 + 0.3 * np.sin(2*np.pi*40*t(0.06))))
# hop
alt('hop', 'a', lp(boing(0.18, 240, 400), 1500))
alt('hop', 'b', boing(0.15, 420, 820))
b = at(boing(0.16, 260, 560), boing(0.12, 300, 520) * 0.6, 0.15); alt('hop', 'c', b)         # boing-oing
# invalid (always kind)
alt('invalid', 'a', lp(glide(330, 250, 0.22, 4, 0.006), 1200))                                # soft "hmm"
b = at(bell(N(69), 0.2, 2.0, 0.4, 5), bell(N(66), 0.25, 2.0, 0.4, 5), 0.11); alt('invalid', 'b', lp(b, 4000), 0.12)
alt('invalid', 'c', voice(420, 330, 0.26, 2, 0.45), pk=0.45)                                            # "uh-uh"
# win
b = np.zeros(1)
for i, m in enumerate([72, 76, 79, 84]): b = at(b, marimba(N(m), 0.5), i * 0.09)
b = at(b, musicbox(N(88), 0.7), 0.36, 0.6); b = sparkle(b, 0.4, 0.4, 6, 96, 108, 0.1, kind='bell')
alt('win', 'a', b, 0.22)
b = np.zeros(1)
for i, m in enumerate([84, 88, 91, 96]): b = at(b, glock(N(m), 0.7), i * 0.075)
b = sparkle(b, 0.3, 0.55, 14, 96, 110, 0.2); alt('win', 'b', b, 0.25)
b = at(boing(0.16, 280, 600), np.zeros(1), 0)
for i, m in enumerate([79, 84]): b = at(b, musicbox(N(m), 0.4), 0.15 + i * 0.12, 0.8)
for m in [84, 88, 91, 96]: b = at(b, musicbox(N(m), 0.9), 0.42, 0.45)
b = sparkle(b, 0.48, 0.4, 7, 98, 110, 0.12); alt('win', 'c', b, 0.22)
# lose (kind, never sad-trombone)
b = np.zeros(1)
for i, m in enumerate([79, 76, 72]): b = at(b, musicbox(N(m), 0.6), i * 0.2, 0.8)
alt('lose', 'a', b, 0.2)
b = np.zeros(1)
for i, m in enumerate([84, 79, 76]): b = at(b, glock(N(m), 0.5), i * 0.14, 0.7)
b = at(b, glock(N(79), 0.7), 0.48, 0.6); alt('lose', 'b', b, 0.2)                               # ends on a hopeful lift
x = t(0.5); f = 520 * (390 / 520) ** (x / 0.5) * (1 + 0.02 * np.sin(2*np.pi*6*x))
alt('lose', 'c', lp(np.sin(2*np.pi*np.cumsum(f)/SR) * np.sin(np.pi * x / 0.5) ** 0.7 * np.exp(-1.5 * x), 1500), 0.15, pk=0.4)   # soft "aww" (sustained, so it sits lower)
# celebrate
b = np.zeros(int(SR * 1.2))
for m, s0 in [(84, 0), (88, 0.12), (91, 0.24), (96, 0.36), (100, 0.5)]: b = at(b, musicbox(N(m), 0.8), s0, 0.6)
b = sparkle(b, 0.2, 0.8, 12, 96, 110, 0.12, kind='bell'); alt('celebrate', 'a', b, 0.3)
b = np.zeros(int(SR * 1.3)); b = at(b, noise(1.0, 4000, 11000, 3) * 0.1, 0)
b = sparkle(b, 0, 1.0, 34, 88, 108, 0.35); alt('celebrate', 'b', b, 0.3)
x = t(0.4); f = 500 * (1400 / 500) ** (x / 0.4); b = np.sin(2*np.pi*np.cumsum(f)/SR) * np.sin(np.pi*x/0.4) ** 1.5 * 0.4
for i in range(6): b = at(b, bloop(400 + 80*i, 900 + 120*i, 0.06), 0.4 + i * 0.07, 0.4)
b = sparkle(b, 0.45, 0.7, 16, 92, 108, 0.25); alt('celebrate', 'c', lp(b, 9000), 0.25)
# streak
x = t(0.4); w = noise(0.4, 250, 1800, 2) * np.sin(np.pi * x / 0.4)
b = at(w * 0.5, marimba(N(81), 0.6), 0.3); alt('streak', 'a', b, 0.2)
x = t(0.4); w = noise(0.4, 600, 4000, 2) * np.sin(np.pi * x / 0.4)
b = at(w * 0.5, glock(N(88), 0.6), 0.3); b = at(b, glock(N(93), 0.6), 0.37, 0.7); b = sparkle(b, 0.42, 0.3, 5, 100, 110, 0.15); alt('streak', 'b', b, 0.22)
b = at(glide(180, 700, 0.3, 2, 0.02) * 0.5, boing(0.15, 500, 900), 0.26); b = at(b, bell(N(88), 0.5, 2.0, 0.8, 4), 0.34, 0.8); alt('streak', 'c', b, 0.2)
# tick
alt('tick', 'a', soft(1400, 0.04, 9))
alt('tick', 'b', glock(N(96), 0.05))
alt('tick', 'c', chip(1760, 0.035, 7))
# notify = the Hubbub coin (B5 → E6)
b = at(musicbox(N(83), 0.35), musicbox(N(88), 0.5), 0.12); alt('notify', 'a', b, 0.2)
b = at(glock(N(83), 0.3), glock(N(88), 0.5), 0.1); b = sparkle(b, 0.18, 0.2, 3, 100, 110, 0.15); alt('notify', 'b', b, 0.2)
b = at(chip(N(83), 0.08), chip(N(88), 0.4, 4), 0.08); alt('notify', 'c', b, 0.12)            # 8-bit coin
# unlock — A/B are the achievement options above; C = a playful one
b = boing(0.15, 300, 640)
for i, m in enumerate([79, 84, 88, 91]): b = at(b, glock(N(m), 0.5), 0.12 + i * 0.06, 0.8)
b = at(b, musicbox(N(96), 0.8), 0.38, 0.6); b = sparkle(b, 0.42, 0.45, 8, 98, 110, 0.15); alt('unlock', 'c', b, 0.24)
# vs
b = at(lp(glide(90, 60, 0.25, 4), 600) * 0.8, marimba(N(64), 0.5), 0.1); alt('vs', 'a', b, 0.15)
b = at(noise(0.18, 1500, 7000, 6) * 0.4, glock(N(76), 0.5), 0.1); b = at(b, glock(N(83), 0.6), 0.22); alt('vs', 'b', b, 0.2)
b = at(bell(N(84), 0.3, 3.5, 0.6, 5), bell(N(84), 0.5, 3.5, 0.6, 4), 0.14); b = at(b, boing(0.16, 260, 560), 0.34, 0.7); alt('vs', 'c', b, 0.15)   # ding-ding!
# whoosh
x = t(0.26); alt('whoosh', 'a', noise(0.26, 300, 2200, 2) * np.sin(np.pi * x / 0.26))
x = t(0.2); alt('whoosh', 'b', at(noise(0.2, 1200, 6500, 2) * np.sin(np.pi * x / 0.2), musicbox(N(96), 0.25) * 0.25, 0.14))
x = t(0.2); alt('whoosh', 'c', at(noise(0.2, 600, 5000, 2) * np.sin(np.pi * x / 0.2), bloop(500, 1100, 0.06) * 0.5, 0.17))
# tabs (silent today): two tiny ideas
alt_tab = {'a': lp(glide(640, 600, 0.05, 8, 0.003), 2200), 'b': bell(N(91), 0.06, 2.0, 0.3, 9)}
for k, s in alt_tab.items(): save(f'tab-{k}', s, 0.35)
# pocket games (silent today): a friend's move arriving
b = at(musicbox(N(88), 0.3), musicbox(N(84), 0.4), 0.09); save('pocket-turn-a', verb(b, 0.15), 0.45)
b = at(bloop(350, 800, 0.07), glock(N(91), 0.35), 0.06, 0.6); save('pocket-turn-b', verb(b, 0.15), 0.45)
print('options:', len(MADE), 'clips; wav masters in', WAV)
