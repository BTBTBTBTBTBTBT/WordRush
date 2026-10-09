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


def key_sheet(path, edge_px=6, all_pockets=False):
    im = Image.open(path).convert('RGB')
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
    rgba = Image.fromarray(np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')
    a2 = rgba.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
    rgba.putalpha(a2)
    return rgba


def split_cells(rgba, names, cols, rows, margin=0.0):
    """Plain grid windows (no Voronoi): for sheets whose pieces have wide gaps but thin parts (rings, glows)."""
    a = np.asarray(rgba.getchannel('A')) > 24
    h, w = a.shape
    out = {}
    for idx, name in enumerate(names):
        row, col = divmod(idx, cols)
        x0, x1 = int(col * w / cols), int((col + 1) * w / cols)
        y0, y1 = int(row * h / rows), int((row + 1) * h / rows)
        mk = np.zeros_like(a)
        mk[y0:y1, x0:x1] = a[y0:y1, x0:x1]
        ys, xs = np.nonzero(mk)
        if len(xs):
            out[name] = ((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), mk)
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
    rgba = key_sheet(sheet, all_pockets=opts.get('pockets') == 'all')
    alpha = np.asarray(rgba.getchannel('A'))
    parts = (split_cells if opts.get('mode') == 'cells' else split)(rgba, names, cols, rows)
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
