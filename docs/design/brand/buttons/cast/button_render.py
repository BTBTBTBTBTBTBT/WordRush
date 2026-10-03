#!/usr/bin/env python3
"""Reference renderer for a finished cast-color button (skin + label), following labels.json — the
wiring spec every platform matches (README.md). Used by the previews + the title/button board.
  python3 button_render.py   → preview-1x.png, preview-3x.png"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
FONT = os.path.join(REPO, 'apps', 'web', 'app', 'fonts', 'Nunito-Black.woff')   # the Brand font (Nunito Black)
SPEC = json.load(open(os.path.join(HERE, 'labels.json')))


def _hex(h, a=255):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (a,)


def label_layout(label, height_pt, width_pt=None):
    """(font pt, button width pt): the font shrinks from the default to fit the flat middle (inset
    ≥ capInset × height from each end, ≥ minPadPt), never below minFontPt; if it still doesn't fit,
    the button grows wider."""
    r = SPEC['rules']
    inset = max(r['capInsetOfHeight'] * height_pt, r['minPadPt'] * height_pt / 44)
    fpt = r['fontOfHeight'] * height_pt
    measure = lambda pt: ImageFont.truetype(FONT, 200).getlength(label) * pt / 200
    if width_pt is None:
        width_pt = measure(fpt) + 2 * inset
    while fpt > r['minFontPt'] and measure(fpt) > width_pt - 2 * inset:
        fpt -= 0.25
    width_pt = max(width_pt, measure(fpt) + 2 * inset)
    return fpt, width_pt


def button(color, label, height_pt=44, width_pt=None, scale=3, state='', dark=False):
    """The finished button as an RGBA image at `scale` px per pt."""
    fpt, width_pt = label_layout(label, height_pt, width_pt)
    h, w = round(height_pt * scale), round(width_pt * scale)
    size = 's' if height_pt <= 34 else 'm' if height_pt <= 48 else 'l'
    sk = Image.open(os.path.join(HERE, 'out', f'{color}-{size}{state}{"-dark" if dark else ""}.png')).convert('RGBA')
    sk = sk.resize((max(h, round(sk.width * h / sk.height)), h), Image.LANCZOS)
    cap = h // 2
    out = Image.new('RGBA', (w, h))
    out.alpha_composite(sk.crop((0, 0, cap, h)), (0, 0))
    out.alpha_composite(sk.crop((sk.width // 2, 0, sk.width // 2 + 1, h)).resize((w - 2 * cap, h)), (cap, 0))
    out.alpha_composite(sk.crop((sk.width - cap, 0, sk.width, h)), (w - cap, 0))
    lab = SPEC['labels'][color]
    r = SPEC['rules']
    ss = 4                                              # supersample the text for fractional strokes
    big = Image.new('RGBA', (w * ss, h * ss))
    f = ImageFont.truetype(FONT, round(fpt * scale * ss))
    cx, cy = w * ss / 2, (h * r['labelCenterOfHeight'] + (r['pressedDropPt'] * scale if state else 0)) * ss
    sh = Image.new('RGBA', big.size)
    ImageDraw.Draw(sh).text((cx, cy + r['shadowYPt'] * scale * ss), label, font=f, anchor='mm',
                            fill=_hex(lab['shadow'], round(255 * r['shadowAlpha'])))
    big.alpha_composite(sh.filter(ImageFilter.GaussianBlur(r['shadowBlurPt'] * scale * ss / 2)))
    ImageDraw.Draw(big).text((cx, cy), label, font=f, anchor='mm', fill=lab['fill'],
                             stroke_width=round(r['strokePt'] * scale * ss), stroke_fill=_hex(lab['stroke']))
    out.alpha_composite(big.resize((w, h), Image.LANCZOS))
    return out


BTNS = [('purple', 'PLAY AGAIN'), ('teal', 'STARTS WITH'), ('green', 'SIGN UP'), ('blue', 'INVITE'),
        ('gold', 'GO PRO'), ('slate', 'UNDO'), ('orange', 'ERASE'), ('pink', 'SHARE')]


def preview(scale, out):
    cellw = 150                                         # pt per cell (a typical in-app button width)
    rows = []
    for dark in (False, True):
        for state in ('', '-pressed'):
            rows.append((dark, state))
    W = round((8 * (cellw + 12) + 24) * scale)
    H = round((len(rows) * (44 + 16) + 24) * scale)
    img = Image.new('RGBA', (W, H), (246, 242, 255, 255))
    y = 12 * scale
    for dark, state in rows:
        if dark:
            img.alpha_composite(Image.new('RGBA', (W, round(60 * scale)), (30, 22, 50, 255)), (0, round(y - 8 * scale)))
        x = 12 * scale
        for c, label in BTNS:
            b = button(c, label, 44, cellw, scale, state, dark)
            img.alpha_composite(b, (round(x), round(y)))
            x += (cellw + 12) * scale
        y += 60 * scale
    img.convert('RGB').save(out, optimize=True)
    return out


if __name__ == '__main__':
    print(preview(1, os.path.join(HERE, 'preview-1x.png')))
    print(preview(3, os.path.join(HERE, 'preview-3x.png')))
