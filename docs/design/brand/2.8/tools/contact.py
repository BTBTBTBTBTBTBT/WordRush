#!/usr/bin/env python3
"""contact.py <dir> <out.png> [cols] [cell] [bg]: contact sheet of every PNG in <dir> (alphabetical) on a dark and light half."""
import glob, os, sys
from PIL import Image
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
cell = int(sys.argv[4]) if len(sys.argv) > 4 else 260
files = sorted(f for f in glob.glob(os.path.join(d, '*.png')) if not os.path.basename(f).startswith('_') and 'contact' not in f)
rows = (len(files) + cols - 1) // cols
im = Image.new('RGB', (cols * cell, rows * cell), (96, 84, 140))
for i, f in enumerate(files):
    g = Image.open(f).convert('RGBA')
    k = min(1, (cell - 24) / max(g.size))
    g = g.resize((max(1, round(g.width * k)), max(1, round(g.height * k))), Image.LANCZOS)
    bg = Image.new('RGB', (cell - 8, cell - 8), (96, 84, 140) if (i // cols + i % cols) % 2 else (236, 230, 250))
    im.paste(bg, ((i % cols) * cell + 4, (i // cols) * cell + 4))
    im.paste(g, ((i % cols) * cell + (cell - g.width) // 2, (i // cols) * cell + (cell - g.height) // 2), g)
im.save(out)
print(out, len(files))
