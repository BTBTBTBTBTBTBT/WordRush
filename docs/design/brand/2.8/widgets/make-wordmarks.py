#!/usr/bin/env python3
"""WORDOCIOUS wordmark in the bubble lettering (glyph atlas), per widget size, normal + Halloween.
Widths are @3x pixels for small (~140 pt), medium (~290 pt), large (~290 pt, taller), lock-screen (~100 pt, mono)."""
import os, sys
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, '..', 'glyphs'))
import bubble_text as bt
from PIL import Image

SIZES = {'small': 400, 'medium': 760, 'large': 880}
THEMES = {'normal': dict(top='#7c3aed', bottom='#ec4899', rim=None),
          'halloween': dict(top='#3a2a4a', bottom='#0c0812', rim='#f97316'),            # black body, orange rim (light/orange widget backs)
          'halloween-orange': dict(top='#fb923c', bottom='#c2410c', rim=None)}       # orange body, gold rim (dark widget backs)
for name, w in SIZES.items():
    for tn, t in THEMES.items():
        im = bt.render('WORDOCIOUS', t['top'], t['bottom'], rim=t['rim'])
        k = w / im.width
        im = im.resize((w, max(1, round(im.height * k))), Image.LANCZOS)
        im.save(f'{H}/out/wordmark-{name}-{tn}.png')
        print(name, tn, im.size)
# two-line version for the large widget header (WORD / OCIOUS would split a word, so use the tagline pair)
for tn, t in THEMES.items():
    im = bt.render("TODAY'S DAILIES", t['top'], t['bottom'], rim=t['rim'])
    k = 520 / im.width
    im.resize((520, round(im.height * k)), Image.LANCZOS).save(f'{H}/out/headline-todays-dailies-{tn}.png')
