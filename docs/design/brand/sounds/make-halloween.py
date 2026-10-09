"""Halloween sounds (FRIDAY-QUEUE item 49, founder 10-09): our own synthesized, royalty-free audio, no recordings.

  python3 docs/design/brand/sounds/make-halloween.py
    -> out/intro-halloween.{wav,m4a}            the intro jingle re-orchestrated: same melody and timing, minor key
                                                (C minor pentatonic), organ + celesta + bone-xylophone, a church bell
                                                and an organ swell on the landing
    -> out/note-h-<id>.{wav,m4a}  (10)          the musical cast's notes in season: each hero's OWN voice (the shipped
                                                out/note-<id>.wav, untouched) with a spooky instrument under it at the same
                                                pitch: organ (W S), celesta (R C U), bone-xylophone (O I), low strings (D O)
    -> options/intro-halloween-a.m4a            the same two as Sound Library clips (admin > Sound Library > Halloween)
    -> options/note-h-<id>.m4a
Ships x3 with ship-sounds.sh (web public/sounds/<n>.m4a, iOS sfx-<n>.m4a, Android sfx_<n>.m4a); in season the registry's
`slots.sounds` (packages/core/src/season-registry.json) picks them; the everyday jingle and notes return Nov 1.

Needs numpy + macOS afconvert only (no scipy / ffmpeg). Loudness matches the everyday sounds (K-weighted, BS.1770-style).
"""
import os, subprocess, tempfile, wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
OPT = os.path.join(HERE, 'options')
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
MIDI = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]      # C4 .. E5 (core MUSICAL_SCALE)
# Each hero's spooky instrument (organ / celesta / bone-xylophone / low strings): a mix, so the cast sounds like an orchestra.
VOICING = {'w': 'organ', 'o1': 'bones', 'r': 'celesta', 'd': 'strings', 'o2': 'organ', 'c': 'celesta', 'i': 'bones', 'o3': 'strings', 'u': 'celesta', 's': 'organ'}
rng = np.random.default_rng(1031)
N = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def t(d): return np.arange(int(SR * d)) / SR

def env(n, a=0.004, d=None, curve=6.0):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4))
    dd = (n / SR) if d is None else d
    return e * np.exp(-curve * x / dd)

def lp(sig, fc):
    """One-pole low-pass x2 (no scipy)."""
    a = np.exp(-2 * np.pi * fc / SR)
    for _ in range(2):
        out = np.empty_like(sig); y = 0.0
        for i, v in enumerate(sig):
            y = (1 - a) * v + a * y
            out[i] = y
        sig = out
    return sig

def at(buf, sig, sec, gain=1.0):
    i = int(round(sec * SR)); end = i + len(sig)
    if end > len(buf): buf = np.concatenate([buf, np.zeros(end - len(buf))])
    buf[i:end] += sig * gain
    return buf

# ── The spooky instruments ──────────────────────────────────────────────────
def organ(f, d=0.8, swell=0.02):
    """A pipe organ: drawbar harmonics 1 2 3 4 6, a breath of chiff, slow vibrato, a soft attack."""
    x = t(d)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * x)
    s = sum(g * np.sin(2 * np.pi * f * h * x * vib) for h, g in ((1, 1.0), (2, 0.55), (3, 0.38), (4, 0.22), (6, 0.1)))
    a = np.minimum(1, x / max(swell, 1e-3)); r = np.minimum(1, (d - x) / 0.08)
    return s * a * np.clip(r, 0, 1) * 0.35

def bones(f, d=0.5):
    """A xylophone of bones: a hollow wooden knock (1, 3.0, 6.3 modes) with a dry click, fast decay."""
    x = t(d)
    s = (np.sin(2 * np.pi * f * x) * np.exp(-x * 16 / d) + 0.45 * np.sin(2 * np.pi * 3.0 * f * x) * np.exp(-x * 40 / d)
         + 0.15 * np.sin(2 * np.pi * 6.3 * f * x) * np.exp(-x * 80 / d))
    click = rng.standard_normal(len(x)) * np.exp(-x * 900)
    return (s + 0.08 * click) * np.minimum(1, x / 0.001)

def celesta(f, d=0.9):
    """A celesta: soft bell partials (1, 4, 6.2), a gentle ring."""
    x = t(d)
    s = (np.sin(2 * np.pi * f * x) * np.exp(-x * 4.0 / d) + 0.32 * np.sin(2 * np.pi * 4.0 * f * x) * np.exp(-x * 11 / d)
         + 0.1 * np.sin(2 * np.pi * 6.2 * f * x) * np.exp(-x * 20 / d))
    return s * np.minimum(1, x / 0.002)

def strings(f, d=0.8):
    """Low strings: a detuned saw pair under a low-pass, a slow bow attack and vibrato."""
    x = t(d)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.6 * x)
    ph = lambda ff: (2 * np.pi * ff * x * vib)
    saw = sum(np.sin(h * ph(f)) / h for h in range(1, 9)) + sum(np.sin(h * ph(f * 1.004)) / h for h in range(1, 9))
    s = lp(saw, 1800)
    return s * np.minimum(1, x / 0.09) * np.clip((d - x) / 0.1, 0, 1) * 0.5

def tubular_bell(f, d=2.4):
    """A church / tubular bell: inharmonic partials (0.5, 1, 1.19, 1.56, 2, 2.51, 3.2), long ring."""
    x = t(d)
    s = sum(g * np.sin(2 * np.pi * f * r * x) * np.exp(-x * c / d)
            for r, g, c in ((0.5, 0.5, 2.5), (1.0, 1.0, 3.5), (1.19, 0.7, 4.5), (1.56, 0.55, 5.5), (2.0, 0.5, 6.5), (2.51, 0.3, 8.0), (3.2, 0.2, 10.0)))
    return s * np.minimum(1, x / 0.001)

def whoosh(d=0.5, gain=0.2):
    x = t(d)
    n = rng.standard_normal(len(x))
    n = lp(n, 4200) - lp(n, 700)
    return n / (np.abs(n).max() + 1e-9) * np.sin(np.pi * x / d) ** 2 * gain

def verb(sig, mix=0.22, taps=((0.037, .5), (0.053, .4), (0.079, .3), (0.113, .2), (0.163, .12), (0.23, .07))):
    wet = np.concatenate([sig, np.zeros(int(SR * 0.4))]); dry = wet.copy()
    for dt, g in taps: wet = at(wet, sig * g, dt)
    return wet * mix + dry * (1 - mix)

# ── Loudness (K-weighted, gated, 100 ms blocks: make-sounds.py, without scipy) ────
def biquad(b, a, x):
    y = np.zeros(len(x)); x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = b[0] * v + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        x2, x1 = x1, v; y2, y1 = y1, o; y[i] = o
    return y

def loudness(x):
    y = biquad([1, -2, 1], [1, -1.98916967363, 0.98919159782], biquad([1.53090959966, -2.65116903469, 1.16916686977], [1, -1.66375011193, 0.71265753585], x))
    n, hop = int(0.1 * SR), int(0.025 * SR)
    if len(y) < n: y = np.concatenate([y, np.zeros(n - len(y))])
    ms = np.array([np.mean(y[i:i + n] ** 2) for i in range(0, len(y) - n + 1, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12); g = ms[L > -70]
    if not len(g): return -99.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    return float(-0.691 + 10 * np.log10(ms[(L > -70) & (L > rel)].mean()))

PEAK_CAP = -1.5

def match(sig, target_lufs):
    """Gain so the loudness hits the target, capped so the peak stays under PEAK_CAP dBFS."""
    gain_db = min(target_lufs - loudness(sig), PEAK_CAP - 20 * np.log10(np.abs(sig).max() + 1e-12))
    return sig * 10 ** (gain_db / 20)

def read_wav(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0

def save(name, sig, outdirs):
    fade = min(len(sig), int(SR * 0.006)); sig = sig.copy(); sig[-fade:] *= np.linspace(1, 0, fade)
    tmp = tempfile.mktemp(suffix='.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(sig, -1, 1) * 32767).astype(np.int16).tobytes())
    for d, keep_wav in outdirs:
        os.makedirs(d, exist_ok=True)
        if keep_wav: subprocess.run(['cp', tmp, os.path.join(d, f'{name}.wav')], check=True)
        subprocess.run(['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', tmp, os.path.join(d, f'{name}.m4a')], check=True)
    os.remove(tmp)

# ── The notes: each hero's own voice + a spooky instrument at the same pitch ───────
INSTR = {'organ': lambda m: organ(N(m), 0.5, 0.012), 'bones': lambda m: bones(N(m + 12), 0.4), 'celesta': lambda m: celesta(N(m + 12), 0.6),
         'strings': lambda m: strings(N(m - 12), 0.5)}

def make_notes():
    for cid, m in zip(CAST, MIDI):
        base = read_wav(os.path.join(OUT, f'note-{cid}.wav'))
        inst = INSTR[VOICING[cid]](m)
        n = max(len(base), len(inst))
        mix = np.zeros(n); mix[:len(base)] += base * 0.8; mix[:len(inst)] += inst * 0.5 * (np.abs(base).max() / (np.abs(inst).max() + 1e-9))
        target = loudness(base)
        save(f'note-h-{cid}', match(mix, target), [(OUT, True), (OPT, False)])
        print('note-h-' + cid, VOICING[cid])

# ── The intro: same melody and timing as intro-a (make-sound-options.py), re-orchestrated in C minor ─────
POPS = [0.588 + 0.084 * k + 0.04 for k in range(9)]; GLIDE = 1.68; LAND = 2.17
MAJOR_WALK = [72, 74, 76, 79, 81, 84, 86, 88, 91]       # C5 D5 E5 G5 A5 C6 D6 E6 G6 (the everyday jingle)
MINOR_WALK = [72, 75, 77, 79, 82, 84, 87, 89, 91]       # the same contour on the C minor pentatonic: C Eb F G Bb C Eb F G

def make_intro():
    b = np.zeros(int(SR * 3.3))
    # the W's pop: a low organ knock and a bone click
    b = at(b, organ(N(36), 0.45, 0.01), 0.02, 0.6); b = at(b, bones(N(60), 0.3), 0.22, 0.7)
    for s0, m in zip(POPS, MINOR_WALK):
        b = at(b, bones(N(m), 0.4), s0, 0.55)           # the walk on bone-xylophone ...
        b = at(b, celesta(N(m + 12), 0.5), s0 + 0.012, 0.28)   # ... with a celesta shimmer an octave up
    b = at(b, strings(N(43), 0.9), GLIDE - 0.18, 0.5)   # the glide: a bowed low swell + a dark whoosh
    b = at(b, whoosh(0.5, 0.2), GLIDE - 0.05)
    # the landing: a church bell, an organ swell on C minor (C3 Eb3 G3 C4), the celesta "ta-da" in minor
    b = at(b, tubular_bell(N(48), 1.5), LAND, 0.55); b = at(b, tubular_bell(N(60), 1.1), LAND + 0.01, 0.3)
    for m in (48, 51, 55, 60):
        b = at(b, organ(N(m), 1.05, 0.3), LAND - 0.05, 0.5)
    for i, m in enumerate([84, 87, 91, 96]):
        b = at(b, celesta(N(m), 1.0), LAND + i * 0.012, 0.4)
    b = verb(b, 0.26)
    b = b[:int(SR * 3.5)]; b[-int(SR * 0.45):] *= np.linspace(1, 0, int(SR * 0.45))   # ~the cold-start clock + a short tail
    target = loudness(read_wav(os.path.join(OUT, 'intro.wav')))
    save('intro-halloween', match(b, target), [(OUT, True), (OPT, False)])
    # the Sound Library names the clip intro-halloween-a (option A of the Halloween intro event)
    os.replace(os.path.join(OPT, 'intro-halloween.m4a'), os.path.join(OPT, 'intro-halloween-a.m4a'))
    print('intro-halloween', round(len(b) / SR, 2), 's')

if __name__ == '__main__':
    make_notes()
    make_intro()
