#!/usr/bin/env python3
"""Cast cameo pick board (founder picked option (a) 10-03): each cameo cutout composed at one end of its
cast-color title, partly overlapping a letter, the other end clean. → ../cameos-2026-10-03.png
Placement per cameo: (title, side, cameo height as a multiple of the title height, x/y nudge as a
fraction of the cameo size)."""
import os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
TITLES = os.path.join(HERE, '..', 'cast-colors')
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', s)
CAMEOS = [  # cutout, title, side, height × title height, dx, dy (fractions of the cameo box)
    ('dailies-w', 'dailies', 'right', 1.45, -0.42, -0.72, 'W sits on the final S with a tiny calendar'),
    ('puzzles-c', 'puzzles', 'left', 1.45, 0.38, -0.28, 'C pushes a puzzle piece into the first P'),
    ('wotd-i', 'wotd', 'right', 1.6, -0.62, -0.84, 'I sits on DAY reading a book'),
    ('vsbattle-s', 'vsbattle', 'left', 1.5, 0.10, -0.18, 'S (sweatband) braces against the V like a wrestler'),
    ('leaderboard-o3', 'leaderboard', 'right', 1.5, -0.45, -0.72, 'O (amber cyclops) stands on the D with a trophy'),
    ('stats-d', 'stats', 'right', 1.45, -0.10, -0.30, 'D (glasses) with a clipboard chart beside STATS'),
    ('friends-o2i', 'friends', 'right', 1.5, -0.12, -0.32, 'O (pink) and I high-five at the end of FRIENDS'),
    ('settings-r', 'settings', 'left', 1.45, 0.08, -0.28, 'R (nightcap) tightens a bolt with a little wrench'),
]


def compose(cut, title, side, k, dx, dy, W=1200, H=420):
    row = Image.new('RGBA', (W, H), (238, 228, 250, 255))
    t = Image.open(os.path.join(TITLES, title + '.png')).convert('RGBA')
    s = min(W * 0.62 / t.width, 150 / t.height)
    t = t.resize((int(t.width * s), int(t.height * s)), Image.LANCZOS)
    tx, ty = (W - t.width) // 2, H - t.height - 40
    c = Image.open(os.path.join(HERE, cut + '.png')).convert('RGBA')
    c = c.crop(c.getbbox())
    ch = int(t.height * k)
    c = c.resize((int(c.width * ch / c.height), ch), Image.LANCZOS)
    if side == 'right':
        cx = tx + t.width + int(dx * c.width)
    else:
        cx = tx - c.width + int(dx * c.width)
    cy = ty + int(dy * c.height)
    sitting = cut != 'puzzles-c'             # in front of the lettering, except C's puzzle piece slots in BEHIND the P
    if not sitting:
        row.alpha_composite(c, (cx, cy))
    row.alpha_composite(t, (tx, ty))
    if sitting:
        row.alpha_composite(c, (cx, cy))
    return row


def main():
    rows = [compose(*c[:6]) for c in CAMEOS]
    W = rows[0].width + 80
    H = 110 + sum(r.height + 60 for r in rows)
    b = Image.new('RGB', (W, H), (250, 247, 255))
    d = ImageDraw.Draw(b)
    d.text((40, 24), 'Cast cameos on the cast-color titles (2026-10-03) — %d of 8 · one per title, at one end' % len(rows), font=F(28), fill=(60, 40, 95))
    y = 90
    for r, c in zip(rows, CAMEOS):
        d.text((40, y), c[6], font=F(22), fill=(90, 70, 130)); y += 34
        b.paste(r.convert('RGB'), (40, y)); y += r.height + 26
    out = os.path.join(HERE, '..', 'cameos-2026-10-03.png')
    b.save(out, optimize=True)
    print('wrote', os.path.normpath(out), b.size)


if __name__ == '__main__':
    main()
