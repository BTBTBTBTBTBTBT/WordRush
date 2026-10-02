"""Wordocious sound pack (founder 10-02: sound + haptics to match the tactile candy look).
Synthesized offline (soft sines, FM bells, filtered noise) so it's ours, tiny and consistent.
  python3 sounds/make-sounds.py  -> sounds/out/<name>.wav (44.1k mono 16-bit) + .m4a (AAC) via afconvert
Shipped by sounds/ship-sounds.sh to web public/sounds, iOS Resources/Sounds, Android res/raw."""
import os, subprocess, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter
SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.004, d=None, curve=6.0):
    x = np.arange(n) / SR; e = np.minimum(1, x / max(a, 1e-4))
    dd = (n / SR) if d is None else d
    return e * np.exp(-curve * x / dd)
def sweep(f0, f1, d, shape='exp'):
    x = t(d); f = f0 * (f1 / f0) ** (x / d) if shape == 'exp' else f0 + (f1 - f0) * x / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def bell(f, d, ratio=2.0, index=1.2, curve=5.0):
    x = t(d); mod = index * np.exp(-4 * x / d) * np.sin(2 * np.pi * f * ratio * x)
    return np.sin(2 * np.pi * f * x + mod) * env(len(x), 0.002, d, curve)
def soft(f, d, curve=7.0):   # rounded "boop": sine + a little 2nd harmonic
    x = t(d); return (np.sin(2*np.pi*f*x) + 0.18*np.sin(4*np.pi*f*x)) * env(len(x), 0.003, d, curve)
def noise(d, lo, hi, curve=8.0):
    b, a = butter(2, [lo / (SR/2), hi / (SR/2)], 'band'); n = lfilter(b, a, rng.standard_normal(int(SR*d)))
    return n / (np.abs(n).max() + 1e-9) * env(len(n), 0.002, d, curve)
def at(buf, sig, sec, gain=1.0):
    i = int(sec * SR); end = i + len(sig)
    if end > len(buf): buf = np.concatenate([buf, np.zeros(end - len(buf))])
    buf[i:end] += sig * gain; return buf
def verb(sig, mix=0.18, taps=((0.031, .5), (0.047, .38), (0.071, .27), (0.103, .18), (0.149, .1))):
    out = np.concatenate([sig, np.zeros(int(SR * 0.25))])
    for dt, g in taps: out = at(out, sig * g, dt)
    return sig.tolist() and (out * mix + np.concatenate([sig, np.zeros(len(out) - len(sig))]) * (1 - mix))
def save(name, sig, peak=0.7):
    sig = sig / (np.abs(sig).max() + 1e-9) * peak
    fade = min(len(sig), int(SR * 0.006)); sig[-fade:] *= np.linspace(1, 0, fade)
    p = os.path.join(OUT, f'{name}.wav'); wavfile.write(p, SR, (sig * 32767).astype(np.int16))
    subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', p, p.replace('.wav', '.m4a')], check=True)

N = lambda m: 440 * 2 ** ((m - 69) / 12)   # midi -> Hz

# 1 key tap: soft candy boop with a tiny pitch drop
x = t(0.07); f = 700 * (560/700) ** (x/0.07); s = np.sin(2*np.pi*np.cumsum(f)/SR) * env(len(x), 0.002, 0.07, 7)
save('tap', s + 0.15 * noise(0.07, 2500, 6000, 30)[:len(s)], 0.55)
# 2 delete: lower, rounder
x = t(0.08); f = 470 * (380/470) ** (x/0.08); save('delete', np.sin(2*np.pi*np.cumsum(f)/SR) * env(len(x), 0.002, 0.08, 7), 0.5)
# 3 tile flip: wooden tick + glassy blip
save('flip', noise(0.05, 1500, 4500, 18) * 0.6 + soft(1250, 0.05, 10), 0.5)
# 4 squish press: bubbly pop (rising)
save('press', sweep(260, 820, 0.075) * env(int(SR*0.075), 0.002, 0.075, 6), 0.5)
# 5 squish release: tiny high pop
save('release', sweep(900, 1300, 0.045) * env(int(SR*0.045), 0.001, 0.045, 8), 0.35)
# 6 hop: boing
x = t(0.18); f = 260 + 260*np.sin(np.pi*x/0.18) + 18*np.sin(2*np.pi*22*x)
save('hop', np.sin(2*np.pi*np.cumsum(f)/SR) * env(len(x), 0.004, 0.18, 4), 0.5)
# 7 invalid: gentle two-note "nope" (soft, never harsh)
b = np.zeros(1); b = at(b, soft(N(57), 0.13, 5), 0); b = at(b, soft(N(55), 0.17, 5), 0.11)
lp_b, lp_a = butter(2, 1800/(SR/2)); save('invalid', lfilter(lp_b, lp_a, b), 0.55)
# 8 win: sparkly arpeggio C6 E6 G6 C7 + shimmer
b = np.zeros(1)
for i, m in enumerate([72, 76, 79, 84]): b = at(b, bell(N(m), 0.55, 2.0, 1.0, 4), i * 0.085)
for i in range(10): b = at(b, bell(N(int(rng.integers(88, 100))), 0.25, 3.0, 0.6, 6), 0.34 + i * 0.045, 0.22)
save('win', np.array(verb(b, 0.25)), 0.7)
# 9 lose: kind descending marimba G5 E5 C5
b = np.zeros(1)
for i, m in enumerate([79, 76, 72]): b = at(b, bell(N(m), 0.45, 4.0, 0.5, 6), i * 0.15)
save('lose', np.array(verb(b, 0.2)), 0.55)
# 10 celebrate: confetti shimmer (sweep / flawless / champion)
b = np.zeros(int(SR * 1.3))
for i in range(28): b = at(b, bell(N(int(rng.integers(84, 103))), 0.3, 3.0, 0.7, 6), rng.uniform(0, 1.0), rng.uniform(0.15, 0.4))
b = at(b, noise(1.1, 4000, 12000, 3) * 0.12, 0)
save('celebrate', np.array(verb(b, 0.3)), 0.6)
# 11 streak: warm whoosh + ding
b = np.zeros(1); x = t(0.45)
w = noise(0.45, 300, 2500, 2) * np.sin(np.pi * x / 0.45); b = at(b, w * 0.6, 0)
b = at(b, bell(N(81), 0.7, 2.0, 0.9, 3.5), 0.32); b = at(b, bell(N(88), 0.6, 2.0, 0.6, 4), 0.38, 0.5)
save('streak', np.array(verb(b, 0.25)), 0.65)
# 12 coin tick (points count-up)
save('tick', bell(1850, 0.04, 2.0, 0.4, 10), 0.35)
# 13 notify: friendly two-note chime
b = np.zeros(1); b = at(b, bell(N(83), 0.35, 2.0, 0.7, 5), 0); b = at(b, bell(N(88), 0.45, 2.0, 0.7, 5), 0.12)
save('notify', np.array(verb(b, 0.2)), 0.55)
# 14 unlock: achievement — rising 5-note run + sparkle
b = np.zeros(1)
for i, m in enumerate([67, 71, 74, 79, 83]): b = at(b, bell(N(m), 0.4, 2.0, 0.9, 5), i * 0.06)
for i in range(8): b = at(b, bell(N(int(rng.integers(91, 101))), 0.22, 3.0, 0.5, 7), 0.32 + i * 0.05, 0.2)
save('unlock', np.array(verb(b, 0.25)), 0.65)
# 15 vs stinger: punchy two-hit
b = np.zeros(1); b = at(b, sweep(110, 70, 0.18) * env(int(SR*0.18), 0.002, 0.18, 4), 0)
b = at(b, noise(0.12, 2000, 8000, 10) * 0.5, 0); b = at(b, bell(N(76), 0.4, 1.5, 1.4, 4), 0.14)
save('vs', b, 0.6)
# 16 whoosh (popup open / page slide), very soft
x = t(0.22); save('whoosh', noise(0.22, 600, 5000, 2) * np.sin(np.pi * x / 0.22), 0.3)
print('ok', sorted(f for f in os.listdir(OUT) if f.endswith('.m4a')))
