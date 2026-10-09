#!/usr/bin/env python3
"""Acceptance sheet (founder 10-07): DAILIES tinted purple + PUZZLES tinted teal composed from the glyph atlas,
next to today's ChatGPT title art, plus live-headline samples. Writes acceptance.png."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import bubble_text as b

H = os.path.dirname(os.path.abspath(__file__))
T = os.path.join(H, '..', '..', 'titles')
W = 2000
rows = []


def fit(img, w=None, h=None):
    k = (w / img.width) if w else (h / img.height)
    return img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)


def row(label, mine, ref=None, height=230):
    rows.append((label, mine, ref, height))


row('DAILIES  (glyph atlas, purple to pink)', b.render('DAILIES', '#7c3aed', '#ec4899'), Image.open(f'{T}/dailies-lettering-keyed.png').convert('RGBA'))
row('PUZZLES  (glyph atlas, teal)', b.render('PUZZLES', '#0f9fb0', '#0891b2'), Image.open(f'{T}/puzzles-lettering-keyed.png').convert('RGBA'))
row('live headline: gold', b.render('ON A ROLL ★ 7 OF 18', '#f5b301', '#ca8a04'))
row('live headline: game color + two-tone', b.render('GOOD MORNING, BMT!', '#2563eb', '#7c3aed'))
row('Halloween', b.render('HAPPY HALLOWEEN', '#f97316', '#c2410c'))
row('every symbol', b.render("0123456789 ★ ! ? , ' · - & . : + %", '#7c3aed', '#db2777'))

pad = 28
cellh = 300
sheet_h = sum(cellh + 40 for _ in rows) + pad
im = Image.new('RGB', (W, sheet_h), (244, 240, 252))
d = ImageDraw.Draw(im)
y = pad
for label, mine, ref, hh in rows:
    d.text((pad, y), label, fill=(80, 60, 130))
    y += 22
    m = fit(mine, h=hh) if mine.height > hh else mine
    if m.width > W // 2 - 2 * pad and ref is not None:
        m = fit(m, w=W // 2 - 2 * pad)
    elif m.width > W - 2 * pad:
        m = fit(m, w=W - 2 * pad)
    im.paste(m, (pad, y), m)
    if ref is not None:
        r = fit(ref, h=m.height) if abs(ref.height - m.height) > 4 else ref
        if r.width > W // 2 - 2 * pad:
            r = fit(r, w=W // 2 - 2 * pad)
        im.paste(r, (W // 2 + pad, y + (m.height - r.height) // 2), r)
    y += cellh + 18
im = im.crop((0, 0, W, y))
im.save(os.path.join(H, 'acceptance.png'))
print(im.size)
