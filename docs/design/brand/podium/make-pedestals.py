#!/usr/bin/env python3
"""Podium pedestals: split the ChatGPT sheets, then shorten each pedestal's body
so its aspect suits the app's step heights (74 / 54 / 40) at ~80 px wide, and
re-seat the numeral (+ gold's star) from the numbered sheet onto the shortened
plain body. Writes out/{1,2,3}.png, out/{1,2,3}-plain.png, out/floor.png.

  python3 make-pedestals.py     (run from docs/design/brand/podium)
"""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
import os

os.makedirs('out', exist_ok=True)
# place: (body band to cut starts at y0 in source rows, target height, glyph box (top, bottom) in the new image)
SPEC = {
    '1': dict(cut=(170, 293), h=440, glyph=(132, 398)),
    '2': dict(cut=(160, 250), h=340, glyph=(128, 298)),
    '3': dict(cut=(150, 236), h=270, glyph=(120, 244)),
}
BLEND = 14


def shorten(im, y0, y1):
    a = np.asarray(im).astype(np.float32)
    top, bot = a[:y0], a[y1:]
    # crossfade the seam: the last BLEND rows of `top` fade into the first BLEND rows of `bot`
    t = np.linspace(0, 1, BLEND)[:, None, None]
    seam = top[-BLEND:] * (1 - t) + bot[:BLEND] * t
    out = np.concatenate([top[:-BLEND], seam, bot[BLEND:]], axis=0)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), 'RGBA')


def glyph(num):
    a = np.asarray(num).astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    white = (np.minimum(np.minimum(r, g), b) > 205) & ((np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 45) & (al > 200)
    white[:112] = False  # the lid's highlights
    lab, n = ndimage.label(white)
    sizes = ndimage.sum(white, lab, range(1, n + 1))
    # the numeral (+ star): big cream blobs centered on the body, not the metal's edge highlights
    com = ndimage.center_of_mass(white, lab, range(1, n + 1))
    w = white.shape[1]
    keep = np.isin(lab, [i + 1 for i in range(n) if sizes[i] > 1500 and abs(com[i][1] - w / 2) < w * 0.18])
    keep = ndimage.binary_fill_holes(keep)
    # outline ring: the dark-gold contour hugging the cream fill
    m = ndimage.binary_dilation(keep, iterations=17)
    mask = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
    ys, xs = np.where(m)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    g_im = num.crop(box)
    g_im.putalpha(Image.fromarray(np.minimum(np.asarray(g_im)[..., 3], np.asarray(mask.crop(box)))))
    return g_im


for k, s in SPEC.items():
    plain = Image.open(f'{k}-plain.png').convert('RGBA')
    num = Image.open(f'{k}.png').convert('RGBA')
    y0 = s['cut'][0]
    y1 = y0 + (plain.height - s['h']) - BLEND  # the crossfade overlaps BLEND rows
    short = shorten(plain, y0, y1)
    assert short.height == s['h'], (k, short.height)
    short.save(f'out/{k}-plain.png')
    gl = glyph(num)
    gt, gb = s['glyph']
    sc = min(1.0, (gb - gt) / gl.height)
    gl = gl.resize((round(gl.width * sc), round(gl.height * sc)), Image.LANCZOS)
    cx = short.width // 2
    out = short.copy()
    out.alpha_composite(gl, (cx - gl.width // 2, gt + ((gb - gt) - gl.height) // 2))
    out.save(f'out/{k}.png')
    print(k, short.size, 'glyph scale %.2f' % sc)

f = Image.open('floor.png').convert('RGBA')
f.save('out/floor.png')
print('floor', f.size)
