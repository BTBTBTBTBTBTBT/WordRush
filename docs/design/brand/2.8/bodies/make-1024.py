#!/usr/bin/env python3
"""DRAFT 1024 x 1024 body art for the avatar body pipeline (parts/art-av-body-<id>.png).
The ChatGPT sheet pieces are only ~250-320 px, so these are Lanczos-UPSCALED drafts (x3-4): good enough to run
landmarks.py / compare.py / rig-body.py and judge fit; regenerate the chosen ones one-per-image (~870 px) before shipping.
Placement follows the shipped bodies: feet bottom at y = 988, tallest side <= 890, centered in x."""
import glob, os
from PIL import Image
H = os.path.dirname(os.path.abspath(__file__))
os.makedirs(f'{H}/draft1024', exist_ok=True)
for f in sorted(glob.glob(f'{H}/out/*.png')):
    n = os.path.basename(f)[:-4]
    g = Image.open(f).convert('RGBA')
    k = min(890 / g.height, 900 / g.width)
    g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
    c = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    c.alpha_composite(g, ((1024 - g.width) // 2, 988 - g.height))
    c.save(f'{H}/draft1024/art-av-body-{n}.png')
print('ok')
