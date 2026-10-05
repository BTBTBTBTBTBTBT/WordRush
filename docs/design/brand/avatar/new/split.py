#!/usr/bin/env python3
"""Split a ChatGPT sheet (flat key background) into pieces for the mascot maker's new additions (10-05).
  python3 split.py <capture.png> <sheet-name> <key: cyan|magenta> <piece1> <piece2> ...   (row-major order; '-' skips)
raw capture -> raw/<sheet>.webp ; pieces -> pieces/<piece>.png (keyed, trimmed, native resolution)."""
import os, subprocess, sys, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.abspath(os.path.join(HERE, '..', '..'))
cap, sheet, key, names = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
Image.open(cap).convert('RGB').save(os.path.join(HERE, 'raw', sheet + '.webp'), quality=92)
keyed = os.path.join(tempfile.gettempdir(), f'keyed-{sheet}.png')
subprocess.run([sys.executable, os.path.join(BRAND, 'key-capture.py'), cap, 'full', key, keyed, 'native-all'], check=True, capture_output=True)
A = np.asarray(Image.open(keyed).convert('RGBA'))
solid = A[..., 3] > 30
lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=int(os.environ.get('MERGE', '6'))))
blobs = []
for i in range(1, n + 1):
    ys, xs = np.where((lab == i) & solid)
    if len(ys) < int(os.environ.get('MINPX', '600')):
        continue
    blobs.append((ys.min(), ys.max(), xs.min(), xs.max(), i))
blobs.sort(key=lambda b: (b[0] + b[1]) / 2)
rows, cur = [], []
for b in blobs:
    if cur and (b[0] + b[1]) / 2 - np.mean([(c[0] + c[1]) / 2 for c in cur]) > (b[1] - b[0]) * 0.5:
        rows.append(cur); cur = []
    cur.append(b)
rows.append(cur)
ordered = [b for r in rows for b in sorted(r, key=lambda b: b[2])]
print(sheet, 'found', len(ordered), 'pieces for', len(names), 'names')
for b, nm in zip(ordered, names):
    if nm == '-':
        continue
    P = A.copy(); P[..., 3] = np.where(lab == b[4], P[..., 3], 0)
    piece = Image.fromarray(P, 'RGBA').crop((b[2], b[0], b[3] + 1, b[1] + 1))
    piece.save(os.path.join(HERE, 'pieces', nm + '.png')); print(' ', nm, piece.size)
