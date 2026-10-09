#!/usr/bin/env python3
"""Code-drawn stat pieces (crisp at any size; the Stats tab tints them): win-rate ring, two-color record bar, pager. Reference renders
at 1x = 600 px; the apps draw the same geometry natively (stroke widths as fractions of the diameter)."""
import os
from PIL import Image, ImageDraw, ImageFilter
H = os.path.dirname(os.path.abspath(__file__))
S = 4  # supersample
def ring(pct, size=600, w=0.17, col=(124, 58, 237), track=(233, 226, 250)):
    n = size * S; im = Image.new('RGBA', (n, n), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pad = int(n * 0.04); box = [pad, pad, n - pad, n - pad]; t = int(n * w)
    d.arc(box, 0, 360, fill=track + (255,), width=t)
    if pct > 0:
        d.arc(box, -90, -90 + 360 * pct, fill=col + (255,), width=t)
        for a in (-90, -90 + 360 * pct):   # round caps
            import math
            r = (n - 2 * pad) / 2 - t / 2; cx = cy = n / 2
            x = cx + r * math.cos(math.radians(a)); y = cy + r * math.sin(math.radians(a))
            d.ellipse([x - t / 2, y - t / 2, x + t / 2, y + t / 2], fill=col + (255,))
    # glossy highlight along the top-left of the track (same gloss language as the tiles)
    gl = Image.new('RGBA', (n, n), (0, 0, 0, 0)); g = ImageDraw.Draw(gl)
    g.arc([pad + t * 0.18, pad + t * 0.18, n - pad - t * 0.18, n - pad - t * 0.18], 200, 290, fill=(255, 255, 255, 120), width=int(t * 0.22))
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(S)))
    return im.resize((size, size), Image.LANCZOS)
def record_bar(w_pct, size=(900, 120), win=(124, 58, 237), loss=(236, 72, 153)):
    W, Hh = size[0] * S, size[1] * S
    im = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    r = Hh // 2; split = int(W * w_pct)
    d.rounded_rectangle([0, 0, W - 1, Hh - 1], r, fill=loss + (255,))
    mask = Image.new('L', (W, Hh), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, W - 1, Hh - 1], r, fill=255)
    wl = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); ImageDraw.Draw(wl).rounded_rectangle([0, 0, max(split, 2 * r), Hh - 1], r, fill=win + (255,))
    im.alpha_composite(wl)
    gl = Image.new('RGBA', (W, Hh), (0, 0, 0, 0)); ImageDraw.Draw(gl).rounded_rectangle([Hh * 0.18, Hh * 0.12, W - Hh * 0.18, Hh * 0.42], int(Hh * 0.15), fill=(255, 255, 255, 90))
    gl.putalpha(Image.composite(gl.getchannel('A'), Image.new('L', (W, Hh), 0), mask)); im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(S * 1.5)))
    return im.resize(size, Image.LANCZOS)
os.makedirs(f'{H}/stats', exist_ok=True)
ring(0.62).save(f'{H}/stats/win-rate-ring-62.png'); ring(0.0).save(f'{H}/stats/win-rate-ring-track.png')
ring(0.62, col=(249, 115, 22), track=(60, 40, 70)).save(f'{H}/stats/win-rate-ring-62-halloween.png')
record_bar(0.7).save(f'{H}/stats/record-bar-70.png')
record_bar(0.7, win=(249, 115, 22), loss=(60, 40, 70)).save(f'{H}/stats/record-bar-70-halloween.png')
