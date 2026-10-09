#!/usr/bin/env python3
"""Demo: a Codebreaker chip tray: fixed-size chips (code letter + count badge + answer slot), selected glow, solved slot."""
import os
from PIL import Image, ImageDraw, ImageFont
H = os.path.dirname(os.path.abspath(__file__))
NUNITO = os.path.normpath(os.path.join(H, '../../../../../apps/ios/Wordocious/Resources/Nunito.ttf'))
def font(s):
    f = ImageFont.truetype(NUNITO, s); f.set_variation_by_name('Black'); return f
def load(n, h):
    g = Image.open(f'{H}/out/{n}.png').convert('RGBA'); k = h / g.height
    return g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
CH = 190
chips = [('G', 6, None, 'chip'), ('O', 4, 'T', 'chip-solved'), ('R', 3, None, 'chip-selected'), ('Q', 0, None, 'chip-used'), ('S', 5, 'E', 'chip-solved'), ('A', 7, None, 'chip')]
W = 40 + len(chips) * (int(CH * 0.83) + 14)
im = Image.new('RGB', (W + 20, 330), (238, 230, 255))
tray = load('tray', 150)
tray = tray.resize((W - 10, 150), Image.LANCZOS)
im.paste(tray, (5, 80), tray)
d = ImageDraw.Draw(im)
x = 28
for letter, count, ans, kind in chips:
    c = load(kind, CH if kind != 'chip-selected' else int(CH * 1.12))
    cy = 40 if kind != 'chip-selected' else 28
    im.paste(c, (x - (c.width - int(CH * 0.83)) // 2, cy), c)
    cx = x - (c.width - int(CH * 0.83)) // 2 + c.width // 2
    top = cy + c.height * 0.24
    d.text((cx, top), letter, font=font(64), fill=(91, 33, 182) if kind != 'chip-used' else (120, 116, 140), anchor='mm')
    if count:
        b = load('badge-purple', 44)
        im.paste(b, (cx + c.width // 2 - 40, cy + 2), b)
        d.text((cx + c.width // 2 - 18, cy + 24), str(count), font=font(24), fill=(255, 255, 255), anchor='mm')
    if ans:
        d.text((cx, cy + c.height * 0.755), ans, font=font(34), fill=(120, 53, 15), anchor='mm')
    x += int(CH * 0.83) + 14
im.save(f'{H}/chips-demo.png')
