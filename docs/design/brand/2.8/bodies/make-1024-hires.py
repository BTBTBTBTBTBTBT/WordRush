#!/usr/bin/env python3
"""Key the one-per-image ChatGPT bodies (hires/<id>.png, ~870 px, flat cyan) and place each on a 1024 x 1024 canvas as
draft1024-hires/art-av-body-<id>.png (feet bottom y = 988, tallest side <= 890, centered), the format INTEGRATION.md "How to add
a new body" expects. Next per body: manifest face/letter anchors, landmarks.py, compare.py, rig-body.py."""
import glob, os, subprocess, sys, tempfile
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
KEYER = os.path.join(H, '..', 'tools', 'slice_grid.py')
sys.path.insert(0, os.path.join(H, '..', 'tools'))
import slice_grid as sg
import numpy as np
os.makedirs(f'{H}/draft1024-hires', exist_ok=True)
for f in sorted(glob.glob(f'{H}/hires/*.png')):
    n = os.path.basename(f)[:-4]
    rgba = sg.key_sheet(f, edge_px=3, all_pockets=True)
    a = np.asarray(rgba.getchannel('A')) > 24
    ys, xs = np.nonzero(a)
    g = rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    k = min(890 / g.height, 900 / g.width)
    g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
    c = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0)); c.alpha_composite(g, ((1024 - g.width) // 2, 988 - g.height))
    c.save(f'{H}/draft1024-hires/art-av-body-{n}.png')
    print(n, g.size)
