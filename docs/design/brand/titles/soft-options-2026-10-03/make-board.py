#!/usr/bin/env python3
"""Soft Home-title options board (2026-10-03): 4 ChatGPT lettering styles (A–D) + today's reference,
each shown plain and with its mirrored flanking flourish on a ~390 pt phone row.
  python3 make-board.py  (from this folder) → ../soft-options-2026-10-03.png + title cutouts"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
P = lambda *a: os.path.join(HERE, *a)
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', s)
INK = (70, 50, 110)
BG = (238, 228, 250)
WORDS = ['dailies', 'puzzles', 'wotd', 'vsbattle']
STYLES = [('a', 'A · Lavender → soft rose, cream rim'), ('b', 'B · A soft candy color each, white rim'),
          ('c', 'C · Deep plum, pastel inner glow'), ('d', 'D · Matte marshmallow')]


def key_flat(im):
    """Flat-background title render → RGBA (alpha by color distance from the corner color)."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    bg = np.median(np.concatenate([a[:8, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)]), 0)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    alpha = np.clip((d - 10) / 30, 0, 1)
    rgba = np.dstack([a, alpha * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def titles(style):
    im = key_flat(Image.open(P(f'style-{style}-raw.png')))
    al = np.asarray(im)[..., 3] > 60
    lab, n = ndimage.label(ndimage.binary_dilation(al.any(1), iterations=12))
    bands = sorted([s[0] for s in ndimage.find_objects(lab)], key=lambda s: s.start)
    bands = [b for b in bands if b.stop - b.start > 40][:4]
    out = []
    for w, b in zip(WORDS, bands):
        t = im.crop((0, b.start, im.width, b.stop))
        t = t.crop(t.getbbox())
        t.save(P(f'title-{style}-{w}.png'))
        out.append(t)
    return out


def phone_row(title, flourish, W=520, H=96, tw=0.6):
    """A ~390 pt phone row (scaled to W px): the title centered at tw of the width, the flourish
    on the left and its mirror on the right, filling the side space."""
    row = Image.new('RGBA', (W, H), BG + (255,))
    t = title.resize((int(W * tw), int(title.height * W * tw / title.width)), Image.LANCZOS)
    if t.height > H - 16:
        t = title.resize((int(title.width * (H - 16) / title.height), H - 16), Image.LANCZOS)
    row.alpha_composite(t, ((W - t.width) // 2, (H - t.height) // 2))
    if flourish is not None:
        side = (W - t.width) // 2 - 10
        fh = int(min(H * 0.62, flourish.height * (side * 0.92) / flourish.width))
        f = flourish.resize((int(flourish.width * fh / flourish.height), fh), Image.LANCZOS)
        y = (H - f.height) // 2
        row.alpha_composite(f, (max(4, (W - t.width) // 2 - f.width - 6), y))
        row.alpha_composite(f.transpose(Image.FLIP_LEFT_RIGHT), (min(W - f.width - 4, (W + t.width) // 2 + 6), y))
    return row


def main():
    colW, gap = 520, 30
    cols = []
    for s, label in STYLES:
        ts = titles(s)
        fl = Image.open(P(f'flourish-{s}.png')).convert('RGBA')
        blocks = [('plain', [phone_row(t, None) for t in ts]), ('with flourish', [phone_row(t, fl) for t in ts])]
        cols.append((label, blocks))
    # reference column: today's DAILIES + the coordinator's recolor tests (middle + bottom rows)
    ref = Image.open(P('reference-title-soft-compare.png')).convert('RGBA')
    h3 = ref.height // 3
    refs = [ref.crop((0, i * h3, ref.width, (i + 1) * h3)) for i in range(3)]
    ref_rows = []
    for r in refs:
        k = key_flat(r)
        k = k.crop(k.getbbox() or (0, 0, k.width, k.height))
        ref_rows.append(phone_row(k, None))
    cols.append(('Today · DAILIES + recolor tests', [('top: today · middle/bottom: quick recolors', ref_rows)]))
    rowH = 96
    H = 150 + 2 * (44 + 4 * (rowH + 8)) + 40
    W = len(cols) * (colW + gap) + gap
    board = Image.new('RGB', (W, H), (250, 247, 255))
    d = ImageDraw.Draw(board)
    d.text((gap, 24), 'Soft Home section titles — 4 options + today (2026-10-03). Each row is a ~390 pt phone width.', font=F(30), fill=INK)
    d.text((gap, 66), 'Flourish = a separate small cutout placed left (mirrored right) of the title in code.', font=F(20), fill=(110, 90, 150))
    for ci, (label, blocks) in enumerate(cols):
        x = gap + ci * (colW + gap)
        d.text((x, 108), label, font=F(22), fill=INK)
        y = 150
        for bl, rows in blocks:
            d.text((x, y + 8), bl, font=F(18), fill=(120, 100, 160))
            y += 44
            for r in rows:
                board.paste(r.convert('RGB'), (x, y)); y += rowH + 8
    out = os.path.join(HERE, '..', 'soft-options-2026-10-03.png')
    board.save(out, optimize=True)
    print('wrote', os.path.normpath(out), board.size)


if __name__ == '__main__':
    main()
