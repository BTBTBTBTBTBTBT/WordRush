"""The musical cast's notes (docs/cloud-prompts/10, behind the musicalCast flag): one pitched note per character, in
that character's OWN voice, cut from its shipped laugh (out/laugh-<id>.wav — the Sound Lab "A Giggles" pick).
Left -> right W O R D O C I O U S plays an in-key C major scale: C4 D4 E4 F4 G4 A4 B4 C5 D5 E5.

  python3 docs/design/brand/sounds/make-notes.py   -> out/note-<id>.wav + .m4a, shipped x3 like ship-sounds.sh:
      web public/sounds/note-<id>.m4a · iOS Resources/Sounds/sfx-note-<id>.m4a · Android res/raw/sfx_note_<id>.m4a

Per voice: find the laugh's strongest voiced syllable (10 ms RMS envelope), estimate its pitch (autocorrelation,
median over 40 ms frames), then ffmpeg rubberband shifts it to the target note (formants preserved, so it still
sounds like that character) and stretches it to a short sung note; a soft attack / release envelope, then the same
K-weighted loudness match as make-sounds.py (UI level, peak-capped). The script re-measures each note's pitch and
nudges it until it is within 10 cents (fails past 35). Needs numpy + scipy + ffmpeg (with librubberband).
"""
import os, subprocess, sys, tempfile, numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
# C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 (MIDI) — packages/core/src/musical-cast.ts MUSICAL_SCALE
MIDI = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76]
NOTE_SECONDS = 0.42
UI_LUFS, PEAK_CAP = -21.0, -1.5

hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)

def read(p):
    sr, x = wavfile.read(p)
    x = x.astype(np.float64) / 32768.0
    x = x.mean(1) if x.ndim > 1 else x
    assert sr == SR, (p, sr)
    return x

def loudness(x):   # make-sounds.py's BS.1770 K-weighted, gated, 100 ms blocks
    y = lfilter([1, -2, 1], [1, -1.98916967363, 0.98919159782],
                lfilter([1.53090959966, -2.65116903469, 1.16916686977], [1, -1.66375011193, 0.71265753585], x))
    n, hop = int(0.1 * SR), int(0.025 * SR)
    if len(y) < n: y = np.concatenate([y, np.zeros(n - len(y))])
    ms = np.array([np.mean(y[i:i + n] ** 2) for i in range(0, len(y) - n + 1, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12); g = ms[L > -70]
    if not len(g): return -99.0
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    return float(-0.691 + 10 * np.log10(ms[(L > -70) & (L > rel)].mean()))

def syllables(x):
    n = int(0.01 * SR)
    rms = np.array([np.sqrt(np.mean(x[i:i + n] ** 2)) for i in range(0, len(x) - n, n)])
    on = rms > rms.max() * 0.25
    segs, s = [], None
    for i, v in enumerate(on):
        if v and s is None: s = i
        if not v and s is not None: segs.append((s * n, i * n)); s = None
    if s is not None: segs.append((s * n, len(on) * n))
    return segs

def frame_pitch(f):
    f = f - f.mean()
    if np.sqrt(np.mean(f ** 2)) < 1e-3: return None
    ac = np.correlate(f, f, 'full')[len(f) - 1:]
    lo, hi = int(SR / 1000), int(SR / 70)
    if hi >= len(ac): return None
    k = lo + int(np.argmax(ac[lo:hi]))
    if ac[k] < 0.3 * ac[0]: return None
    # parabolic interpolation
    if 0 < k < len(ac) - 1:
        a, b, c = ac[k - 1], ac[k], ac[k + 1]
        k = k + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    return SR / k

def pitch(x):
    n, hop = int(0.04 * SR), int(0.01 * SR)
    ps = [p for i in range(0, max(1, len(x) - n), hop) if (p := frame_pitch(x[i:i + n])) is not None]
    return float(np.median(ps)) if ps else None

def ffmpeg(args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

def note(cid, midi):
    x = read(os.path.join(OUT, f'laugh-{cid}.wav'))
    segs = syllables(x)
    # the strongest voiced syllable (energy x length), with a little room either side
    a, b = max(segs, key=lambda s: np.sum(x[s[0]:s[1]] ** 2))
    a, b = max(0, a - int(0.01 * SR)), min(len(x), b + int(0.02 * SR))
    syl = x[a:b]
    f0 = pitch(syl)
    if not f0: raise SystemExit(f'no pitch found in laugh-{cid}')
    ratio = hz(midi) / f0
    tempo = (len(syl) / SR) / NOTE_SECONDS   # rubberband tempo < 1 stretches
    with tempfile.TemporaryDirectory() as d:
        src, dst = os.path.join(d, 'in.wav'), os.path.join(d, 'out.wav')
        wavfile.write(src, SR, (syl * 32767).astype(np.int16))
        ffmpeg(['-i', src, '-af', f'rubberband=pitch={ratio:.6f}:tempo={tempo:.6f}:formant=preserved:pitchq=quality', '-ar', str(SR), '-ac', '1', dst])
        y = read(dst)
        # laughs glide, so the first shift can land off: re-measure and nudge (formants kept) until within 10 cents
        for _ in range(4):
            got = pitch(y[: int(0.3 * SR)])
            if not got or abs(1200 * np.log2(got / hz(midi))) < 10: break
            wavfile.write(src, SR, (np.clip(y, -1, 1) * 32767).astype(np.int16))
            ffmpeg(['-i', src, '-af', f'rubberband=pitch={hz(midi) / got:.6f}:formant=preserved:pitchq=quality', '-ar', str(SR), '-ac', '1', dst])
            y = read(dst)
    # a sung note: soft attack, gentle release, trimmed to length
    y = y[:int(NOTE_SECONDS * SR)]
    env = np.ones(len(y))
    att, rel = int(0.008 * SR), int(0.14 * SR)
    env[:att] = np.linspace(0, 1, att)
    env[-rel:] *= np.linspace(1, 0, rel) ** 1.6
    y = y * env
    got = pitch(y[: int(0.3 * SR)])
    cents = 1200 * np.log2(got / hz(midi)) if got else 999
    before = loudness(y); pk = 20 * np.log10(np.abs(y).max() + 1e-12)
    gain_db = min(UI_LUFS - before, PEAK_CAP - pk)
    y = np.clip(y * 10 ** (gain_db / 20), -1, 1)
    p = os.path.join(OUT, f'note-{cid}.wav')
    wavfile.write(p, SR, (y * 32767).astype(np.int16))
    ffmpeg(['-i', p, '-c:a', 'aac', '-b:a', '96k', p.replace('.wav', '.m4a')])
    print(f'note-{cid:3s} laugh f0 {f0:6.1f} Hz -> MIDI {midi} ({hz(midi):6.1f} Hz), measured {got or 0:6.1f} Hz ({cents:+5.1f} c), {loudness(y):5.1f} LUFS')
    return abs(cents)

def ship(cid):
    src = os.path.join(OUT, f'note-{cid}.m4a')
    for dst in (f'apps/web/public/sounds/note-{cid}.m4a', f'apps/ios/Wordocious/Resources/Sounds/sfx-note-{cid}.m4a',
                f'apps/android/app/src/main/res/raw/sfx_note_{cid}.m4a'):
        with open(src, 'rb') as a, open(os.path.join(ROOT, dst), 'wb') as b: b.write(a.read())

if __name__ == '__main__':
    worst = max(note(c, m) for c, m in zip(CAST, MIDI))
    if worst > 35:
        sys.exit(f'a note is {worst:.0f} cents off — check the laugh syllable / pitch estimate')
    for c in CAST: ship(c)
    print('shipped 10 notes x3')
