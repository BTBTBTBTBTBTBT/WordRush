#!/usr/bin/env python3
"""Demo: the three toast frames with sample messages in the app typeface (text is live in the app; the frame is art)."""
import os
from PIL import Image, ImageDraw, ImageFont
H = os.path.dirname(os.path.abspath(__file__))
NUNITO = os.path.normpath(os.path.join(H, '../../../../../apps/ios/Wordocious/Resources/Nunito.ttf'))
f = ImageFont.truetype(NUNITO, 30); f.set_variation_by_name('ExtraBold')
msgs = [('toast-warning', 'S is already used', (146, 64, 14)),
        ('toast-info', 'Already found: PLAY', (30, 64, 175)),
        ('toast-nice', 'Nice! That one is solved', (21, 128, 61))]
W = 760
im = Image.new('RGB', (W, 3 * 190 + 40), (238, 230, 255))
d = ImageDraw.Draw(im)
for i, (n, t, col) in enumerate(msgs):
    g = Image.open(f'{H}/out/{n}.png').convert('RGBA')
    k = (W - 60) / g.width
    g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
    y = 30 + i * 190
    im.paste(g, (30, y), g)
    d.text((30 + g.height * 1.05, y + g.height / 2 - 20), t, font=f, fill=col)
im.save(f'{H}/toasts-demo.png')
