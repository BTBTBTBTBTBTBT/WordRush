#!/usr/bin/env python3
"""Monochrome W status-bar silhouettes (Android small icon / web badge): white on transparent, alpha only.
Built from the canonical cast/hero/w.png outline (tile + cape + mittens + feet) with the letter cut out.
Halloween variant adds a witch-hat silhouette on the tile. Sizes: 24 dp @ mdpi..xxxhdpi (24/36/48/72/96) + 96 master."""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
H = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.normpath(os.path.join(H, '..', '..'))
w = Image.open(f'{BRAND}/cast/hero/w.png').convert('RGBA')
bb = w.getchannel('A').getbbox()
w = w.crop(bb)
side = max(w.size)
sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.alpha_composite(w, ((side - w.width) // 2, side - w.height))
a = np.asarray(sq).astype(np.float32)
alpha = a[..., 3] > 128
# the white W letter: near-white, low saturation pixels inside the body
mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
letter = alpha & (mn > 215) & ((mx - mn) < 40)
letter = ndimage.binary_opening(letter, iterations=2)
lab, n = ndimage.label(letter)
sizes = ndimage.sum(letter, lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s > 0.004 * alpha.sum()])   # the big W only, not eye shines
body = ndimage.binary_closing(alpha, iterations=3)
keep = ndimage.binary_dilation(keep, iterations=5)   # bolder cut-out so the W reads at 24 dp
body = body & ~keep
# thicken a hair so the silhouette survives 24 dp
sil = Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
def white(mask, size):
    m = mask.resize((size, size), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0)); out.putalpha(m); return out
os.makedirs(f'{H}/status', exist_ok=True)
white(sil, 192).save(f'{H}/status/status-w-master.png')
for name, s in [('mdpi', 24), ('hdpi', 36), ('xhdpi', 48), ('xxhdpi', 72), ('xxxhdpi', 96)]:
    white(sil, s).save(f'{H}/status/status-w-{name}.png')
# Halloween: witch hat drawn on top of the tile (same alpha-only rule)
S = 768
hat = Image.new('L', (S, S), 0)
sm = sil.resize((S, S), Image.LANCZOS)
hat.paste(sm)
ys, xs = np.nonzero(np.asarray(sm) > 128)
top = ys.min(); cx = int(np.median(xs[ys < top + 20]))
d = ImageDraw.Draw(hat)
# make room: the hat sits on the tile's top edge (shift the whole tile down 12%, then add the hat above)
hat = Image.new('L', (S, S), 0)
shift = int(S * 0.13)
hat.paste(sm.resize((S, S - shift), Image.LANCZOS), (0, shift))
d = ImageDraw.Draw(hat)
top = top * (S - shift) / S + shift
d.polygon([(cx - S * 0.17, top + S * 0.03), (cx + S * 0.17, top + S * 0.03), (cx + S * 0.12, top - S * 0.06),
           (cx + S * 0.20, top - S * 0.13), (cx + S * 0.05, top - S * 0.10), (cx - S * 0.06, top - S * 0.02)], fill=255)  # bent cone
d.ellipse([cx - S * 0.27, top - S * 0.005, cx + S * 0.27, top + S * 0.075], fill=255)                                      # brim
hat = hat.filter(ImageFilter.GaussianBlur(0.8))
white(hat, 192).save(f'{H}/status/status-w-halloween-master.png')
for name, s in [('mdpi', 24), ('hdpi', 36), ('xhdpi', 48), ('xxhdpi', 72), ('xxxhdpi', 96)]:
    white(hat, s).save(f'{H}/status/status-w-halloween-{name}.png')
# preview on a dark status bar
prev = Image.new('RGB', (4 * 200 + 20, 220), (40, 40, 46))
for k, f in enumerate(['status-w-master', 'status-w-halloween-master']):
    g = Image.open(f'{H}/status/{f}.png'); prev.paste(g, (10 + k * 200, 10), g)
for k, s in enumerate(['mdpi', 'xxxhdpi']):
    g = Image.open(f'{H}/status/status-w-{s}.png'); prev.paste(g, (420 + k * 100, 40), g)
    g = Image.open(f'{H}/status/status-w-halloween-{s}.png'); prev.paste(g, (420 + k * 100, 130), g)
prev.save(f'{H}/status-icons-preview.png')
