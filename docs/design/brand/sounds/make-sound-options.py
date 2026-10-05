"""Wordocious sound OPTIONS for the founder + Johnny to judge (10-05), and the Sound Lab page.
Same toolkit as make-sounds.py (soft sines, FM bells, filtered noise) plus a few toy timbres
(marimba, glockenspiel, music box, soft retro "chip", tiny voices). Never touches the shipped pack.
  python3 docs/design/brand/sounds/make-sound-options.py
    -> sounds/options/<name>.m4a (AAC 96k)  [WAV masters go to $WAV_DIR or a temp dir, not the repo]
    -> sounds/lab.html  (self-contained: every current sound + every option as a base64 data URI)
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
# The Sound Lab page
# ════════════════════════════════════════════════════════════════════════════
CURRENT = [
    ('tap', 'Every letter key and number pad, Hubbub hex letters + shuffle (pitch wobbles ±3%)'),
    ('delete', 'Delete / backspace'),
    ('flip', 'Each tile turning over in a guess reveal; the opponent\'s row landing in VS (softer)'),
    ('press', 'Squishy button press-down: candy buttons, cast buttons, onboarding coach'),
    ('release', 'Squishy button release (web + Android)'),
    ('hop', 'Mascot hops: the intro\'s landing flourish, mascot builder, onboarding'),
    ('invalid', 'Not a word / wrong move, every game'),
    ('win', 'Win popup at the end of a solved game'),
    ('lose', 'Loss popup / out of guesses'),
    ('celebrate', 'Sweep, flawless, Gauntlet cleared, VS win, Pro welcome'),
    ('streak', 'Streak bump on the result popup, streak shield, VS streaks'),
    ('tick', 'Points counting up on the result popup (max 12 a second)'),
    ('notify', 'THE "HUBBUB COIN": a found word in Hubbub, and every partial success (a Spyglass word, a Kindred group, a Muddle step…) at 70% volume; iOS in-app notices'),
    ('unlock', 'Achievement unlocked popup (iOS also uses it for level-up)'),
    ('vs', 'VS match intro stinger'),
    ('whoosh', 'A popup or sheet opening: result popup, help, Go Pro, streak popups, onboarding tour'),
]
SECTIONS = [
    dict(id='pangram', title='Hubbub pangram 1-up',
         blurb='Johnny\'s idea: using all seven letters gets its own 1-up. All three start from the coin (B5 → E6 bell) so it still feels like Hubbub.',
         items=[('pangram-a', 'A', 'Coin Cascade: the coin, then the arpeggio keeps climbing into a chime with a sparkle tail'),
                ('pangram-b', 'B', 'Triple Coin Climb: three coin pairs stepping up, a little retro, ending on a crown chord'),
                ('pangram-c', 'C', 'Sparkle Bloom: the coin, a quick run up, then a shimmering music-box chord')]),
    dict(id='intro', title='Intro jingle',
         blurb='Cut to the intro\'s beats: the W pops (0 s), one note per hero as each pops in (0.6 to 1.3 s), a lift as the row glides up (1.7 s), and the "ta-da" as it lands in the header (2.2 s) while the cast hops.',
         items=[('intro-a', 'A', 'Marimba Parade: a warm marimba walks up, a glockenspiel "ta-da" on landing'),
                ('intro-b', 'B', 'Music Box: a twinkly music-box tune with a harp-style run and a rolled chord'),
                ('intro-c', 'C', 'Glock & Boing: the W lands with a boing, a zig-zag glock climb, slide-whistle, "ta-DA!"')]),
    dict(id='laugh', title='Cast tap-to-laugh', grid='cast',
         blurb='A tiny sound when you tap a hero in the header. Each one has its own personality. Kept quiet on purpose.',
         sets=[('A', 'Giggles: little synthesized voices', 'laugh-a'), ('B', 'Toy chimes: each hero\'s own little instrument', 'laugh-b')]),
    dict(id='tiers', title='Hubbub coin tiers (longer words)', grid='tiers',
         blurb='The coin gets bigger for longer words: 4, 5, 6, 7 and 8+ letters.',
         sets=[('A', 'Pitch climb: the same coin, higher for longer words', 'tier-a'),
               ('B', 'Coin stack: one more coin per extra letter', 'tier-b')]),
    dict(id='levelup', title='Level-up fanfare',
         blurb='When your XP crosses into a new level.',
         items=[('levelup-a', 'A', 'Toy Fanfare: a marimba pickup into a bright glockenspiel chord'),
                ('levelup-b', 'B', 'Rising Stairs: a glock scale up into a shimmering chord')]),
    dict(id='achieve', title='Achievement unlocked',
         blurb='Alternatives to today\'s "unlock" (play it above to compare).',
         items=[('achieve-a', 'A', 'Badge Shine: a soft two-chord reveal with sparkle'),
                ('achieve-b', 'B', 'Treasure Pop: a bubbly pop, a quick arpeggio, a twinkle')]),
    dict(id='open', title='Game open',
         blurb='A soft "page arriving" when a game opens. Quieter than everything else.',
         items=[('open-a', 'A', 'Page Breeze: a light breeze and a two-note chime'),
                ('open-b', 'B', 'Page Flutter: three paper flicks and a glock up-third')]),
]
CAST_COLORS = dict(w='#7c3aed', o1='#f59e0b', r='#94a3b8', d='#2563eb', o2='#ec4899', c='#0891b2', i='#059669', o3='#f97316', u='#7e22ce', s='#ca8a04')

def uri(path):
    with open(path, 'rb') as f: return 'data:audio/mp4;base64,' + base64.b64encode(f.read()).decode()
AUDIO = {}
def reg(key, path): AUDIO[key] = uri(path); return key
E = html.escape
def btn(key, label, sub='', style=''):
    return (f'<button class="play" data-snd="{key}" style="{style}" aria-label="Play {E(label)}">'
            f'<span class="ico" aria-hidden="true"></span><span class="lbl">{E(label)}</span>'
            + (f'<span class="sub">{E(sub)}</span>' if sub else '') + '</button>')

parts = []
cur = []
for name, where in CURRENT:
    k = reg(f'cur-{name}', os.path.join(CUR, f'{name}.m4a'))
    cur.append(f'<div class="row{" hot" if name == "notify" else ""}">{btn(k, name)}<p>{E(where)}</p></div>')
parts.append(f'<section id="current"><h2>Current sounds</h2><p class="blurb">The 16 sounds in the app today, and where each one plays.</p><div class="rows">{"".join(cur)}</div></section>')
for s in SECTIONS:
    body = ''
    if 'items' in s:
        for key, letter, desc in s['items']:
            k = reg(key, os.path.join(OPT, f'{key}.m4a'))
            head, _, rest = desc.partition(': '); rest = rest[:1].upper() + rest[1:]
            body += f'<div class="opt">{btn(k, letter)}<div><h3>{E(head)}</h3><p>{E(rest)}</p></div></div>'
    else:
        for letter, desc, prefix in s['sets']:
            head, _, rest = desc.partition(': '); rest = rest[:1].upper() + rest[1:]
            cells = ''
            if s['grid'] == 'cast':
                for cid, L, who in CAST:
                    k = reg(f'{prefix}-{cid}', os.path.join(OPT, f'{prefix}-{cid}.m4a'))
                    cells += btn(k, L, who, f'--c:{CAST_COLORS[cid]}')
            else:
                for tier in TIERS:
                    k = reg(f'{prefix}-{tier}', os.path.join(OPT, f'{prefix}-{tier}.m4a'))
                    cells += btn(k, tier, 'letters')
            body += (f'<div class="set"><div class="sethead"><span class="badge">{letter}</span><div><h3>{E(head)}</h3><p>{E(rest)}</p></div></div>'
                     f'<div class="grid {s["grid"]}">{cells}</div></div>')
    parts.append(f'<section id="{s["id"]}"><h2>{E(s["title"])}</h2><p class="blurb">{E(s["blurb"])}</p>{body}</section>')

nav = ''.join(f'<a href="#{i}">{E(n)}</a>' for i, n in [('current', 'Current')] + [(s['id'], s['title'].split(' (')[0]) for s in SECTIONS])
PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wordocious Sound Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap" rel="stylesheet">
<style>
:root{--bg:#f7eefa;--bg2:#f1d7f6;--ink:#2b1640;--muted:#6f5a86;--tile:#ffffffcc;--tile2:#efe2f7;--hot:#fff4d6;
--brand:#7c3aed;--brand2:#c026d3;--on:#fff;--shadow:0 6px 0 #5b21b6,0 10px 22px #7c3aed40;--shadow2:0 3px 0 #00000026}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#160d22;--bg2:#24123a;--ink:#f4ecff;--muted:#b9a6d3;--tile:#2a1a40cc;--tile2:#2f1d47;--hot:#3a2a14;--shadow:0 6px 0 #3b0f86,0 10px 22px #00000066;--shadow2:0 3px 0 #00000066}}
:root[data-theme="dark"]{--bg:#160d22;--bg2:#24123a;--ink:#f4ecff;--muted:#b9a6d3;--tile:#2a1a40cc;--tile2:#2f1d47;--hot:#3a2a14;--shadow:0 6px 0 #3b0f86,0 10px 22px #00000066;--shadow2:0 3px 0 #00000066}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,var(--bg2),var(--bg) 70%) fixed,var(--bg);color:var(--ink);font:600 16px/1.45 Nunito,ui-rounded,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 80px}
header{text-align:center;padding:12px 0 6px}
header h1{margin:0;font-weight:900;font-size:clamp(30px,7vw,46px);letter-spacing:-.5px;background:linear-gradient(90deg,var(--brand),var(--brand2));-webkit-background-clip:text;background-clip:text;color:transparent}
header p{margin:6px auto 0;max-width:560px;color:var(--muted)}
nav{position:sticky;top:0;z-index:5;display:flex;gap:6px;overflow-x:auto;padding:10px 2px;margin:8px -16px 6px;padding-left:16px;padding-right:16px;background:linear-gradient(var(--bg) 70%,transparent);scrollbar-width:none}
nav::-webkit-scrollbar{display:none}
nav a{flex:none;text-decoration:none;color:var(--brand);background:var(--tile2);padding:8px 14px;border-radius:999px;font-weight:800;font-size:14px}
section{margin:30px 0}
h2{font-weight:900;font-size:24px;margin:0 0 4px}
h3{margin:0;font-size:17px;font-weight:900}
.blurb{margin:0 0 14px;color:var(--muted)}
p{margin:2px 0 0}
.rows{display:grid;gap:8px}
.row{display:flex;align-items:center;gap:14px;background:var(--tile);padding:10px 14px 10px 10px;border-radius:20px}
.row.hot{background:var(--hot)}
.row p{color:var(--muted);font-size:15px}
.row .play{min-width:132px}
.opt{display:flex;align-items:center;gap:16px;background:var(--tile);padding:12px 16px 12px 12px;border-radius:22px;margin-bottom:10px}
.opt .play{width:84px;height:84px;border-radius:26px;flex-direction:column;gap:2px;justify-content:center}
.opt .play .lbl{font-size:26px}
.opt p,.sethead p{color:var(--muted);font-size:15px}
.set{background:var(--tile);border-radius:22px;padding:14px;margin-bottom:12px}
.sethead{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.badge{flex:none;width:40px;height:40px;border-radius:14px;display:grid;place-items:center;font-weight:900;font-size:20px;color:var(--on);background:linear-gradient(135deg,var(--brand),var(--brand2))}
.grid{display:grid;gap:10px}
.grid.cast{grid-template-columns:repeat(5,1fr)}
.grid.tiers{grid-template-columns:repeat(5,1fr)}
.grid .play{flex-direction:column;gap:0;min-height:76px;padding:8px 4px;border-radius:20px}
.grid .play .lbl{font-size:24px;line-height:1.1}
.grid .play .sub{font-size:11px;font-weight:700;opacity:.9;line-height:1.15;text-align:center}
.grid.cast .play{background:var(--c);box-shadow:0 5px 0 color-mix(in srgb,var(--c) 60%,#000),0 8px 16px #0002}
.grid .play .ico{display:none}
.play{appearance:none;border:0;cursor:pointer;display:inline-flex;align-items:center;gap:10px;min-height:56px;padding:10px 18px;border-radius:999px;
 color:var(--on);font:900 18px/1 Nunito,ui-rounded,system-ui,sans-serif;background:linear-gradient(160deg,#9b5cf6,var(--brand) 55%,#6d28d9);box-shadow:var(--shadow);
 transition:transform .12s cubic-bezier(.3,1.4,.5,1),box-shadow .12s;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.play:active{transform:translateY(4px) scale(.98);box-shadow:var(--shadow2)}
.play:focus-visible{outline:3px solid var(--brand2);outline-offset:3px}
.play .ico{width:0;height:0;border-left:13px solid currentColor;border-top:8px solid transparent;border-bottom:8px solid transparent;margin-left:2px}
.play.playing{background:linear-gradient(160deg,#f0abfc,var(--brand2));animation:pulse .5s ease-in-out infinite alternate}
.play.playing .ico{border:0;width:12px;height:12px;border-radius:3px;background:currentColor;margin:0 1px}
@keyframes pulse{to{transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){.play.playing{animation:none}}
footer{color:var(--muted);font-size:14px;text-align:center;margin-top:40px}
@media (max-width:560px){
 .row{flex-direction:column;align-items:stretch;gap:6px;padding:10px}
 .row .play{width:100%;justify-content:center}
 .row p{padding:0 6px 4px}
 .opt{gap:12px;padding:10px}
 .opt .play{width:72px;height:72px}
 .grid.cast,.grid.tiers{grid-template-columns:repeat(5,1fr);gap:7px}
 .grid .play{min-height:64px;border-radius:16px}
 .grid .play .sub{display:none}
}
</style></head><body><div class="wrap">
<header><h1>Sound Lab</h1><p>Every Wordocious sound, plus new options to pick from. Tap to listen (one at a time). Tell Claude the letters you like, e.g. "pangram B, intro A, laughs B".</p></header>
<nav>__NAV__</nav>
__BODY__
<footer>Synthesized in code: docs/design/brand/sounds/make-sound-options.py. Nothing here ships until picked.</footer>
</div>
<script>
const SND = __AUDIO__;
const els = {};
for (const [k, src] of Object.entries(SND)) { const a = new Audio(); a.preload = 'auto'; a.src = src; els[k] = a; }
window.__labAudio = els;
let cur = null, curBtn = null;
function stop() {
  if (cur) { try { cur.pause(); cur.currentTime = 0; } catch (e) {} }
  if (curBtn) curBtn.classList.remove('playing');
  cur = null; curBtn = null;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('button.play'); if (!b) return;
  const a = els[b.dataset.snd]; if (!a) return;
  const same = cur === a; stop(); if (same) return;   // tapping the playing one stops it
  cur = a; curBtn = b; b.classList.add('playing');
  a.onended = () => { if (cur === a) stop(); };
  const p = a.play(); if (p && p.catch) p.catch(() => stop());
});
</script></body></html>"""
out = PAGE.replace('__NAV__', nav).replace('__BODY__', '\n'.join(parts)).replace('__AUDIO__', json.dumps(AUDIO))
with open(os.path.join(HERE, 'lab.html'), 'w') as f: f.write(out)
print('options:', len(MADE), 'clips;', 'lab.html', round(len(out) / 1e6, 2), 'MB;', len(AUDIO), 'audio;', 'wav masters in', WAV)
for k, v in MADE.items(): print(f'  {k:16s} {v["dur"]:.2f}s  rms {v["rms"]:.3f}')
