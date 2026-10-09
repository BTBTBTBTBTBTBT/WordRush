#!/usr/bin/env python3
"""Reference "bubble text" renderer: compose + tint any string from the glyph atlas (out/atlas.json).
This is the spec the iOS / Android / web renderers follow (baseline, spacing, tint rules).

Tint rule (identical on every platform): split each glyph pixel into
  body  = low saturation (white / grey shading)  -> multiplied by the tint, highlights (>0.88 luma) stay white
  line  = dark brown inner outline               -> deep version of the tint
  rim   = saturated yellow                       -> untouched (or the season rim color)
Two-tone words: a vertical gradient tint (top -> bottom) over the whole word, like the DAILIES art.
"""
import json, os
import numpy as np
from PIL import Image

H = os.path.dirname(os.path.abspath(__file__))
ATLAS = json.load(open(f'{H}/out/atlas.json'))
CAP = ATLAS['capHeight']
G = ATLAS['glyphs']
NAMES = {'★': 'star', '!': 'excl', '?': 'quest', ',': 'comma', "'": 'apos', '’': 'apos', '·': 'dot', '-': 'hyphen',
         '&': 'amp', '.': 'period', ':': 'colon', '+': 'plus', '%': 'percent'}
_cache = {}


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)


def glyph_name(ch):
    c = ch.upper()
    n = NAMES.get(c, c)
    return n if n in G else None


def tint_glyph(img, top, bottom, y0, y1, rim=None):
    """img: RGBA glyph; top/bottom: tint colors; y0..y1: this glyph's span within the word gradient (0..1)."""
    a = np.asarray(img).astype(np.float32)
    rgb, al = a[..., :3] / 255.0, a[..., 3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    luma = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    body = np.clip((0.30 - sat) / 0.16, 0, 1)                       # 1 = white/grey body
    line = np.clip((0.55 - luma) / 0.2, 0, 1) * (1 - body)           # dark brown inner outline
    rimw = np.clip(1 - body - line, 0, 1)
    ty = np.linspace(y0, y1, img.height, dtype=np.float32)[:, None, None]
    t = (np.array(top, np.float32) * (1 - ty) + np.array(bottom, np.float32) * ty) / 255.0   # per-row tint
    L = np.clip(luma / 0.90, 0, 1.3)[..., None]
    bodyc = np.clip(t * 1.06, 0, 1) * np.minimum(L, 1.0) ** 1.35
    bodyc = bodyc + (np.clip(L - 1.0, 0, 0.25) * 4.0) * (1 - bodyc) * 0.85   # highlights go white
    linec = t * 0.32
    out = bodyc * body[..., None] + linec * line[..., None] + rgb * rimw[..., None]
    if rim is not None:
        rc = hexrgb(rim) / 255.0
        out = out * (1 - rimw[..., None]) + rc * (luma[..., None] / max(luma[rimw > 0.5].mean(), 0.1) if (rimw > 0.5).any() else 1) * rimw[..., None]
    res = np.dstack([np.clip(out, 0, 1) * 255, al])
    return Image.fromarray(res.astype(np.uint8), 'RGBA')


def render(text, top, bottom=None, height=None, rim=None, gap=-0.045, space=0.38):
    """Compose text. height = cap height in px (default atlas cap). gap/space are fractions of cap height."""
    bottom = bottom or top
    top, bottom = hexrgb(top), hexrgb(bottom)
    k = (height or CAP) / CAP
    items, x = [], 0.0
    asc, desc = 0.0, 0.0
    for ch in text:
        if ch == ' ':
            x += space * CAP
            continue
        n = glyph_name(ch)
        if not n:
            continue
        g = G[n]
        # vertical placement relative to the baseline (y down)
        if g['align'] == 'baseline' or g['align'] == 'comma':
            top_y = -g['baseline']
        elif g['align'] == 'top':
            top_y = -CAP * 1.0 - (g['h'] - g['h'])  # hangs from cap line
            top_y = -CAP - 0.0
        else:  # mid
            top_y = -CAP / 2 - g['h'] / 2
        items.append((n, x, top_y, g))
        x += g['w'] + gap * CAP
        asc = max(asc, -top_y)
        desc = max(desc, top_y + g['h'])
    width = x - gap * CAP
    pad = 4
    canvas = Image.new('RGBA', (int(width + 2 * pad), int(asc + desc + 2 * pad)), (0, 0, 0, 0))
    total_h = asc + desc
    for n, gx, top_y, g in items:
        img = Image.open(f'{H}/out/{n}.png')
        y_in = asc + top_y
        tinted = tint_glyph(img, top, bottom, y_in / total_h, (y_in + g['h']) / total_h, rim)
        canvas.alpha_composite(tinted, (int(gx + pad), int(y_in + pad)))
    if k != 1:
        canvas = canvas.resize((max(1, round(canvas.width * k)), max(1, round(canvas.height * k))), Image.LANCZOS)
    return canvas
