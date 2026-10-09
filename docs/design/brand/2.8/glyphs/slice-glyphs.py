#!/usr/bin/env python3
"""Slice the ChatGPT bubble-glyph sheets (raw/*.png, magenta key) into one keyed, trimmed PNG per glyph.

    /opt/homebrew/bin/python3 slice-glyphs.py

Sheets are 4 columns x 3 rows, read left-to-right / top-to-bottom (see SHEETS). Components are assigned to
grid cells by centroid, so a "!" or ":" with several blobs still lands on one glyph. Output:
  out/<name>.png      transparent, trimmed, every sheet scaled to ONE common cap height
  out/atlas.json      per glyph: w, h, baseline (px from glyph top), align (baseline|mid|top|comma), capHeight
The body is a NEUTRAL light grey/white shaded bubble with a yellow rim, so code tints the body by luminance
(rim stays gold) the way the button family tints its light map.
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

# (file, glyph names row-major, names used to measure this sheet's cap height)
SHEETS = [
    ('sheet1-ABCDEFGHIJKL.png', list('ABCDEFGHIJKL'), list('EFHIKL')),
    ('sheet2-MNOPQRSTUVWX.png', list('MNOPQRSTUVWX'), list('MNTX')),
    ('sheet3-YZ0123456789.png', list('YZ0123456789'), list('YZ17')),
    ('sheet4-symbols.png', ['star', 'excl', 'quest', 'comma', 'apos', 'dot', 'hyphen', 'amp', 'period', 'colon', 'plus', 'percent'], ['excl', 'quest', 'amp']),
]
COLS, ROWS = 4, 3
ALIGN = {
    'star': 'mid', 'excl': 'baseline', 'quest': 'baseline', 'comma': 'comma', 'apos': 'top', 'dot': 'mid',
    'hyphen': 'mid', 'amp': 'baseline', 'period': 'baseline', 'colon': 'baseline', 'plus': 'mid', 'percent': 'baseline',
}
LO, HI = 60, 150


def key_sheet(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    corners = [im.getpixel((4, 4)), im.getpixel((w - 5, 4)), im.getpixel((4, h - 5)), im.getpixel((w - 5, h - 5))]
    K = np.array([sum(c[i] for c in corners) / 4 for i in range(3)], np.float32)
    arr = np.asarray(im).astype(np.float32)
    d = np.sqrt(((arr - K) ** 2).sum(axis=2))
    bg = d <= LO
    bg[:6, :] = True; bg[-6:, :] = True; bg[:, :6] = True; bg[:, -6:] = True  # capture edge rows are never glyph
    lab, n = ndimage.label(bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    for i in range(1, n + 1):
        keep[i] = (i in border) or sizes[i - 1] > bg.size * 0.004
    bg = keep[lab]
    band = ndimage.binary_dilation(bg, iterations=3) & ~bg
    alpha = np.full(d.shape, 255.0)
    alpha[bg] = 0
    soft = np.clip((d - LO) / (HI - LO), 0, 1) * 255
    alpha[band] = np.minimum(255, soft[band])
    r, g, b = arr[..., 0].copy(), arr[..., 1].copy(), arr[..., 2].copy()
    edge = band & (alpha < 255)
    cap = g + 40
    r[edge] = np.minimum(r[edge], cap[edge])
    b[edge] = np.minimum(b[edge], cap[edge])
    rgba = Image.fromarray(np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')
    a2 = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(a2)
    return rgba


def split(rgba, names):
    """Assign every foreground pixel to one glyph: eroded cores per grid cell are markers, then a
    nearest-core (Voronoi) partition, so glyphs whose rims touch still come apart cleanly."""
    a = np.asarray(rgba.getchannel('A')) > 24
    h, w = a.shape
    marker = np.zeros(a.shape, np.int32)
    for idx, name in enumerate(names):
        row, col = divmod(idx, COLS)
        x0, x1 = int(col * w / COLS), int((col + 1) * w / COLS)
        y0, y1 = int(row * h / ROWS), int((row + 1) * h / ROWS)
        found = None
        for it in (18, 9, 4, 0):
            m = ndimage.binary_erosion(a, iterations=it) if it else a
            lab, n = ndimage.label(m)
            keep = []
            for i in range(1, n + 1):
                ys, xs = np.nonzero(lab == i)
                if len(xs) < 40:
                    continue
                if x0 <= xs.mean() < x1 and y0 <= ys.mean() < y1:
                    keep.append(i)
            if keep:
                found = np.isin(lab, keep)
                break
        if found is None:
            print('MISSING', name)
            continue
        marker[found & (marker == 0)] = idx + 1
    dist, (iy, ix) = ndimage.distance_transform_edt(marker == 0, return_indices=True)
    owner = marker[iy, ix] * a
    out = {}
    for idx, name in enumerate(names):
        ys, xs = np.nonzero(owner == idx + 1)
        if len(xs) == 0:
            continue
        out[name] = (idx // COLS, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), owner == idx + 1)
    return out


def main():
    sheets = []
    for fname, names, capnames in SHEETS:
        p = os.path.join(RAW, fname)
        if not os.path.exists(p):
            print('skip (not captured yet):', fname)
            continue
        rgba = key_sheet(p)
        boxes = split(rgba, names)
        cap = float(np.median([boxes[n][1][3] - boxes[n][1][1] for n in capnames if n in boxes]))
        sheets.append((rgba, boxes, cap, names))
    target = min(s[2] for s in sheets)
    atlas = {'capHeight': round(target), 'glyphs': {}}
    for rgba, boxes, cap, names in sheets:
        k = target / cap
        row_bottoms = {}
        for n, (row, bb, _m) in boxes.items():
            if ALIGN.get(n, 'baseline') == 'baseline':
                row_bottoms.setdefault(row, []).append(bb[3])
        for n, (row, bb, mk) in boxes.items():
            part = rgba.copy()
            part.putalpha(Image.fromarray((np.asarray(rgba.getchannel('A')) * mk).astype(np.uint8)))
            crop = part.crop(bb)
            w, h = crop.size
            nw, nh = max(1, round(w * k)), max(1, round(h * k))
            crop.resize((nw, nh), Image.LANCZOS).save(os.path.join(OUT, f'{n}.png'))
            align = ALIGN.get(n, 'baseline')
            base = np.median(row_bottoms.get(row, [bb[3]]))
            baseline = (base - bb[1]) * k
            if align == 'comma':
                baseline = nh * 0.62
            if n in ('excl', 'quest', 'amp', 'percent', 'period', 'colon'):
                baseline = nh * 0.985   # the symbol sheet is not baseline-aligned: sit each on its own bottom
            atlas['glyphs'][n] = {'w': nw, 'h': nh, 'baseline': round(float(baseline), 1), 'align': align}
    json.dump(atlas, open(os.path.join(OUT, 'atlas.json'), 'w'), indent=1)
    print('glyphs', len(atlas['glyphs']), 'cap', atlas['capHeight'])


if __name__ == '__main__':
    main()
