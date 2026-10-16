#!/usr/bin/env python3
"""Time-of-day grades of a season's Home stage card (founder 10-16: four stage images that match each time's wall,
spotlights in the exact same places). A pure per-pixel color grade of the one source image, so geometry (pools,
curtains, floor) is pixel-identical at every time; night = the source unchanged.

usage: grade-stage.py <source.png> <out-dir> <name-stem>
"""
import sys
import numpy as np
from PIL import Image

# Per time: a 3-stop gradient map (shadow, mid, highlight) blended over the source at `amount`, then a gentle
# saturation scale and an exposure `lift` (daylight is brighter; a screen-style lift keeps the pools from clipping). Stops come from the time-of-day surfaces palette (NOTES.md v2) so the card and stage agree.
GRADES = {
    'morning': dict(stops=['#3A2440', '#C08090', '#FFEDE0'], amount=0.36, sat=0.95, lift=0.10),
    'day':     dict(stops=['#2A3560', '#8C9CD4', '#F8FAFF'], amount=0.38, sat=0.94, lift=0.16),
    'evening': dict(stops=['#3A1A2C', '#C46A40', '#FFE2B4'], amount=0.22, sat=0.98, lift=0.0),
}

def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32) / 255.0

def grade(src, stops, amount, sat, lift):
    a = np.asarray(src.convert('RGB'), dtype=np.float32) / 255.0
    lum = (0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2])[..., None]
    s, m, h = (hex_rgb(c) for c in stops)
    lo = np.clip(lum / 0.5, 0, 1)
    hi = np.clip((lum - 0.5) / 0.5, 0, 1)
    gmap = np.where(lum < 0.5, s + (m - s) * lo, m + (h - m) * hi)
    out = a + (gmap - a) * amount
    gray = (0.2126 * out[..., 0] + 0.7152 * out[..., 1] + 0.0722 * out[..., 2])[..., None]
    out = gray + (out - gray) * sat
    out = 1 - (1 - out) * (1 - lift)
    return Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB')

if __name__ == '__main__':
    src_path, out_dir, stem = sys.argv[1:4]
    src = Image.open(src_path)
    src.convert('RGB').save(f'{out_dir}/{stem}-night.png')
    for tod, g in GRADES.items():
        grade(src, **g).save(f'{out_dir}/{stem}-{tod}.png')
        print('wrote', f'{out_dir}/{stem}-{tod}.png')
