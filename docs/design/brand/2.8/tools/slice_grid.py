#!/usr/bin/env python3
"""Generic keyed-sheet slicer used by the 2.8 art sets.

  /opt/homebrew/bin/python3 slice_grid.py <sheet.png> <cols> <rows> <outdir> name1 name2 ... [--size=N]

Keys the flat background (sampled from the four corners; magenta/cyan/green), splits the sheet into a
cols x rows grid by centroid, partitions touching glyphs with a nearest-core (Voronoi) cut, trims each
piece and writes <outdir>/<name>.png (transparent). --size=N scales every piece so its LONGEST side <= N.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

LO, HI = 60, 150


def autocrop_to_key(im):
    """The capture may include viewer margins around a non-square image: crop to the bbox of the dominant (key) color."""
    a = np.asarray(im)
    q = (a // 32).reshape(-1, 3)
    keys, counts = np.unique(q, axis=0, return_counts=True)
    k = keys[np.argmax(counts)] * 32 + 16
    d = np.sqrt(((a.astype(np.float32) - k) ** 2).sum(axis=2))
    ys, xs = np.nonzero(d < 70)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def key_sheet(path, edge_px=6, all_pockets=False, decyan=False, crop=False):
    im = Image.open(path).convert('RGB')
    if crop:
        im = autocrop_to_key(im)
    w, h = im.size
    corners = [im.getpixel((4, 4)), im.getpixel((w - 5, 4)), im.getpixel((4, h - 5)), im.getpixel((w - 5, h - 5))]
    K = np.array([sum(c[i] for c in corners) / 4 for i in range(3)], np.float32)
    arr = np.asarray(im).astype(np.float32)
    d = np.sqrt(((arr - K) ** 2).sum(axis=2))
    bg = d <= LO
    bg[:edge_px, :] = True; bg[-edge_px:, :] = True; bg[:, :edge_px] = True; bg[:, -edge_px:] = True
    lab, n = ndimage.label(bg)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    for i in range(1, n + 1):
        keep[i] = all_pockets or (i in border) or sizes[i - 1] > bg.size * 0.004
    bg = keep[lab]
    band = ndimage.binary_dilation(bg, iterations=3) & ~bg
    alpha = np.full(d.shape, 255.0)
    alpha[bg] = 0
    soft = np.clip((d - LO) / (HI - LO), 0, 1) * 255
    alpha[band] = np.minimum(255, soft[band])
    r, g, b = arr[..., 0].copy(), arr[..., 1].copy(), arr[..., 2].copy()
    edge = band & (alpha < 255)
    # despill: pull the key color's dominant channels down to the other channels
    if K[0] > 200 and K[2] > 200 and K[1] < 100:      # magenta
        cap = g + 40; r[edge] = np.minimum(r[edge], cap[edge]); b[edge] = np.minimum(b[edge], cap[edge])
    elif K[1] > 200 and K[2] > 200 and K[0] < 100:    # cyan
        cap = r + 40; g[edge] = np.minimum(g[edge], cap[edge]); b[edge] = np.minimum(b[edge], cap[edge])
    else:                                              # green
        g[edge] = np.minimum(g[edge], np.maximum(r, b)[edge] + 30)
    if decyan:   # glow/aura spill that is itself cyan-ish: make it transparent before any piece selection
        cy = np.clip((np.minimum(g, b) - r - 6) / 45, 0, 1)
        alpha = alpha * (1 - cy)
    rgba = Image.fromarray(np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')
    a2 = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(a2)
    return rgba


def split_cells(rgba, names, cols, rows, margin=0.0, join=0):
    """Whole-component assignment: label the sheet's connected pieces, pick each cell's MAIN piece (the biggest one whose
    centroid is in the cell), then give every other piece (sparkles, crowns) to the nearest main. A piece that spans two
    cells (a big aura) stays whole. Falls back to nothing for a cell with no piece."""
    a = np.asarray(rgba.getchannel('A')) > 24
    h, w = a.shape
    lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=2))
    lab = lab * a
    cent = {}
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) >= 60:
            cent[i] = (xs.mean(), ys.mean(), len(xs))
    mains = {}
    for idx, name in enumerate(names):
        row, col = divmod(idx, cols)
        best = max((i for i, (cx, cy, sz) in cent.items() if col * w / cols <= cx < (col + 1) * w / cols and row * h / rows <= cy < (row + 1) * h / rows), key=lambda i: cent[i][2], default=0)
        if best:
            mains[name] = best
    mk = np.zeros(a.shape, np.int32)
    for k, (name, i) in enumerate(mains.items(), 1):
        mk[lab == i] = k
    dist, (iy, ix) = ndimage.distance_transform_edt(mk == 0, return_indices=True)
    owner = mk[iy, ix] * (lab > 0)
    out = {}
    for k, name in enumerate(mains, 1):
        m = owner == k
        ys, xs = np.nonzero(m)
        out[name] = ((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), m)
    return out


def split(rgba, names, cols, rows):
    a = np.asarray(rgba.getchannel('A')) > 24
    h, w = a.shape
    marker = np.zeros(a.shape, np.int32)
    for idx, name in enumerate(names):
        row, col = divmod(idx, cols)
        x0, x1 = int(col * w / cols), int((col + 1) * w / cols)
        y0, y1 = int(row * h / rows), int((row + 1) * h / rows)
        found = None
        for it in (18, 9, 4, 0):
            m = ndimage.binary_erosion(a, iterations=it) if it else a
            lab, n = ndimage.label(m)
            keep = []
            for i in range(1, n + 1):
                ys, xs = np.nonzero(lab == i)
                if len(xs) >= 40 and x0 <= xs.mean() < x1 and y0 <= ys.mean() < y1:
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
        if len(xs):
            out[name] = ((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), owner == idx + 1)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=') for a in sys.argv[1:] if a.startswith('--') and '=' in a)
    sheet, cols, rows, outdir, names = args[0], int(args[1]), int(args[2]), args[3], args[4:]
    os.makedirs(outdir, exist_ok=True)
    rgba = key_sheet(sheet, all_pockets=opts.get('pockets') == 'all', decyan=opts.get('decyan') == '1', crop=opts.get('autocrop') == '1')
    alpha = np.asarray(rgba.getchannel('A'))
    parts = split_cells(rgba, names, cols, rows, float(opts.get('margin', 0))) if opts.get('mode') == 'cells' else split(rgba, names, cols, rows)
    for name, (bb, mk) in parts.items():
        part = rgba.copy()
        part.putalpha(Image.fromarray((alpha * mk).astype(np.uint8)))
        crop = part.crop(bb)
        if 'size' in opts and max(crop.size) > int(opts['size']):
            k = int(opts['size']) / max(crop.size)
            crop = crop.resize((round(crop.width * k), round(crop.height * k)), Image.LANCZOS)
        crop.save(os.path.join(outdir, name + '.png'))
        print(name, crop.size)


if __name__ == '__main__':
    main()
