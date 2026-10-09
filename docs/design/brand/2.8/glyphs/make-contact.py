#!/usr/bin/env python3
"""Contact sheet of every sliced glyph on a dark and a light checker (out/contact.png)."""
import json, os
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
a = json.load(open(f'{H}/out/atlas.json'))['glyphs']
names = list(a)
cell = 250
cols = 8
rows = (len(names) + cols - 1) // cols
im = Image.new('RGB', (cols * cell, rows * cell), (64, 56, 92))
for i, n in enumerate(names):
    g = Image.open(f'{H}/out/{n}.png')
    k = min(1, (cell - 20) / max(g.size))
    g = g.resize((max(1, round(g.width * k)), max(1, round(g.height * k))), Image.LANCZOS)
    x = (i % cols) * cell + (cell - g.width) // 2
    y = (i // cols) * cell + (cell - g.height) // 2
    im.paste(g, (x, y), g)
im.save(f'{H}/out/contact.png')
