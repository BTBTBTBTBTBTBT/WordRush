#!/usr/bin/env python3
"""PUZZLES title art from the bubble glyph atlas (replaces the baked "More Games" art: Android TitleArt.MOREGAMES / iOS MenuScaffold .moregames).
Puzzles teal = cast C teal (#0891b2) body lightened at the top; normal + Halloween (black body, orange rim). Sizes: @1x 300, @2x 600, @3x 900 px wide
(same aspect as the shipped lettering ~ 4.9:1)."""
import os, sys
H = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(H, '..', 'glyphs'))
import bubble_text as bt
from PIL import Image
def lighten(h, k):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(round(v + (255 - v) * k) for v in c)
TEAL = '#0891b2'
for name, (top, bot, rim) in {'puzzles': (lighten(TEAL, .28), TEAL, None), 'puzzles-halloween': ('#3a2a4a', '#0c0812', '#f97316')}.items():
    im = bt.render('PUZZLES', top, bot, rim=rim)
    for s, w in (('', 300), ('@2x', 600), ('@3x', 900)):
        k = w / im.width
        im.resize((w, round(im.height * k)), Image.LANCZOS).save(f'{H}/{name}{s}.png')
ref = Image.open(f'{H}/../../titles/puzzles-lettering-keyed.png').convert('RGBA')
mine = Image.open(f'{H}/puzzles@3x.png'); hal = Image.open(f'{H}/puzzles-halloween@3x.png')
W = Image.new('RGB', (1000, 3 * 190), (246, 242, 255)); W.paste(Image.new('RGB', (1000, 190), (30, 22, 40)), (0, 380))
for i, g in enumerate([ref.resize((900, round(ref.height * 900 / ref.width))), mine, hal]):
    W.paste(g, (50, i * 190 + 30), g)
W.save(f'{H}/compare-old-vs-new.png')
