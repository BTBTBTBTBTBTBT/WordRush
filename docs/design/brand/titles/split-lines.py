# Split a keyed multi-title lettering image into one PNG per line (top to bottom).
#   python3 split-lines.py <keyed.png> <name1,name2,...>
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
im = Image.open(sys.argv[1]).convert('RGBA')
names = sys.argv[2].split(',')
a = np.array(im.getchannel('A')) > 40
rows = a.any(axis=1)
runs, y = [], 0
while y < len(rows):
    if rows[y]:
        s = y
        while y < len(rows) and rows[y]:
            y += 1
        runs.append((s, y))
    else:
        y += 1
# Merge runs separated by small gaps (descenders, rims) until we have one per name.
while len(runs) > len(names):
    gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
    _, i = min(gaps)
    runs[i:i + 2] = [(runs[i][0], runs[i + 1][1])]
for n, (y0, y1) in zip(names, runs):
    piece = im.crop((0, y0, im.width, y1))
    piece = piece.crop(piece.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())
    piece.save(os.path.join(HERE, f'{n}-lettering-keyed.png'))
    print(n, piece.size)
