#!/usr/bin/env python3
"""Contact sheet: every TITLE-INVENTORY title + the pocket titles, beside 3 finished cast-color titles.
  python3 contact-all.py → ../cast-colors-all-2026-10-03.png"""
import os, re
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
F = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15)
inv = open(os.path.join(HERE, '..', '..', 'TITLE-INVENTORY.md')).read()
slugs = [s for s in re.findall(r'^\| (\S+) \| .+? \| \w+ \|$', inv, re.M) if s != 'Slug']
slugs = ['dailies', 'puzzles', 'stats'] + ['pocket-rps', 'pocket-ttt', 'pocket-coin', 'pocket-pass', 'pocket-ghost', 'pocket-chain', 'pick-friend'] + slugs
cols, cw, ch = 4, 560, 100
img = Image.new('RGBA', (cols * cw + 20, ((len(slugs) + cols - 1) // cols) * (ch + 26) + 60), (238, 228, 250, 255))
d = ImageDraw.Draw(img)
d.text((12, 10), 'Cast-color titles: 3 finished (reference) · 7 pocket · %d inventory — API, color-matched (10-03)' % (len(slugs) - 10), font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22), fill=(60, 40, 95))
for i, s in enumerate(slugs):
    x, y = 10 + (i % cols) * cw, 50 + (i // cols) * (ch + 26)
    p = os.path.join(HERE, s + '.png')
    if os.path.exists(p):
        t = Image.open(p).convert('RGBA'); k = min((cw - 30) / t.width, (ch - 8) / t.height)
        t = t.resize((max(1, int(t.width * k)), max(1, int(t.height * k))), Image.LANCZOS)
        img.alpha_composite(t, (x + (cw - 20 - t.width) // 2, y + (ch - t.height) // 2))
    d.text((x + 4, y + ch + 4), s + ('  (reference)' if i < 3 else ''), font=F, fill=(60, 40, 95) if os.path.exists(p) else (200, 0, 0))
out = os.path.join(HERE, '..', 'cast-colors-all-2026-10-03.png')
img.convert('RGB').save(out, optimize=True); print('wrote', out, len(slugs))
