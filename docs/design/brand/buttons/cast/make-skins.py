#!/usr/bin/env python3
"""Cast-color button skins (founder 10-03: buttons in the cast-color title language — the cast's body
colors, a deeper same-color rim, footer-level soft gloss; W purple is the primary, pink stays rare).
Keys the ChatGPT pill sheets (raw/), then writes three-slice skins per colorway:
  out/<color>-<s|m|l>[-pressed][-dark].png
heights 32 / 44 / 56 pt at @3x (96 / 132 / 168 px). THREE-SLICE: the end caps are height/2 wide
(the semicircle ends + rim); only the middle column stretches. Dark = the same skin a touch deeper for dark backgrounds.
  python3 make-skins.py"""
import os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
KEY = os.path.join(HERE, '..', '..', 'key-capture.py')
SHEETS = {'cb-warm': ('cyan', ['purple', 'gold', 'slate', 'orange', 'pink']), 'cb-cool': ('magenta', ['teal', 'green', 'blue'])}
SIZES = {'s': 96, 'm': 132, 'l': 168}
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)


def pills(sheet, key):
    keyed = os.path.join(HERE, 'raw', sheet + '-keyed.png')
    subprocess.run(['/opt/homebrew/bin/python3', KEY, os.path.join(HERE, 'raw', sheet + '.png'), 'full', key, keyed, 'native-all'], check=True, capture_output=True)
    im = Image.open(keyed).convert('RGBA')
    a = np.asarray(im)[..., 3] > 60
    lab, n = ndimage.label(a)
    objs = [o for i, o in enumerate(ndimage.find_objects(lab)) if (lab[o] == i + 1).sum() > 4000]
    objs.sort(key=lambda o: (round(o[0].start / 120), o[1].start))   # rows, then columns
    return [im.crop((o[1].start, o[0].start, o[1].stop, o[0].stop)) for o in objs]


def symmetric(p):
    """Average the pill with its mirror so both caps match exactly (three-slice needs twin caps)."""
    a = np.asarray(p).astype(np.float32)
    return Image.fromarray(((a + a[:, ::-1]) / 2).astype(np.uint8), 'RGBA')


# Fills stay the bright cast colors (they match the titles); legibility comes from the LABEL, like the
# titles: white text + a deeper same-color stroke + a soft same-color shadow (labels.json, written below).
# Only slate is deepened a touch (white on the original slate was the weakest neutral).
DEEPEN = {'slate': 0.22}

TINT = {'gold': (1.0, 0.78, 0.45)}


def rel_lum(c):
    c = np.asarray(c, np.float64) / 255
    c = np.where(c <= 0.03928, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return float(c @ [0.2126, 0.7152, 0.0722])


def deepen(p, target, tint=None):
    """Scale the skin's color (in linear light) until the label area reads at `target` luminance."""
    a = np.asarray(p).astype(np.float64)
    h, w = a.shape[:2]
    mid = a[int(h * 0.35):int(h * 0.65), int(w * 0.3):int(w * 0.7), :3].reshape(-1, 3)
    lum = rel_lum(np.median(mid, 0))
    if lum <= target:
        return p
    lin = np.where(a[..., :3] / 255 <= 0.03928, a[..., :3] / 255 / 12.92, ((a[..., :3] / 255 + 0.055) / 1.055) ** 2.4)
    if tint is not None:            # deepen toward a warmer hue (gold → amber, not olive)
        lin = lin * np.asarray(tint)
        lum = rel_lum(np.where(np.median(mid, 0) / 255 <= 0.03928, 0, 0) + 0) or lum
        mid_lin = np.median(lin[int(h * 0.35):int(h * 0.65), int(w * 0.3):int(w * 0.7)].reshape(-1, 3), 0)
        lum = float(mid_lin @ [0.2126, 0.7152, 0.0722])
    lin *= target / lum
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055) * 255
    return Image.fromarray(np.dstack([np.clip(srgb, 0, 255), a[..., 3:]]).astype(np.uint8), 'RGBA')


def dark(p):
    """Dark-mode skin: a touch deeper and the top highlight eased, so it doesn't glare on a dark page."""
    a = np.asarray(p).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3:]
    lum = rgb.mean(2, keepdims=True)
    rgb = rgb * 0.86 - np.clip(lum - 200, 0, None) * 0.35
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8), 'RGBA')


def main():
    n = 0
    for sheet, (key, colors) in SHEETS.items():
        ps = pills(sheet, key)
        assert len(ps) == 2 * len(colors), (sheet, len(ps))
        for row, state in enumerate(['', '-pressed']):
            for i, c in enumerate(colors):
                p = symmetric(ps[row * len(colors) + i])
                if c in DEEPEN:
                    p = deepen(p, DEEPEN[c], TINT.get(c))
                for sz, h in SIZES.items():
                    w = round(p.width * h / p.height)
                    s = p.resize((w, h), Image.LANCZOS)
                    s.save(os.path.join(OUT, f'{c}-{sz}{state}.png'))
                    dark(s).save(os.path.join(OUT, f'{c}-{sz}{state}-dark.png'))
                    n += 2
    write_labels()
    print('skins', n)



def write_labels():
    """labels.json: per colorway, the label's fill / stroke / shadow (the stroke + shadow are the skin's
    rim color, i.e. a deeper shade of the button), sampled from the normal large light skin."""
    import json
    out = {}
    for c in [c for _, (_, cs) in SHEETS.items() for c in cs]:
        a = np.asarray(Image.open(os.path.join(OUT, f'{c}-l.png')).convert('RGBA')).astype(float)
        h, w = a.shape[:2]
        rim = a[int(h * 0.45):int(h * 0.55), 2:int(h * 0.12)]           # the left rim band
        rim = rim[rim[..., 3] > 200][:, :3]
        deep = np.median(rim, 0) * 0.85 if len(rim) else np.array([60, 40, 90.0])
        hx = '#%02x%02x%02x' % tuple(int(v) for v in deep)
        out[c] = {'fill': '#ffffff', 'stroke': hx, 'strokePt': 1.75, 'shadow': hx, 'shadowAlpha': 0.45,
                  'shadowYPt': 1.5, 'shadowBlurPt': 1.5}
    json.dump({'note': 'Button label colors (cast skins): white text, stroke + soft shadow in a deeper shade of the '
                       'button color. The label always fits INSIDE the caps (cap = height / 2): shrink the font to fit.',
               'labels': out}, open(os.path.join(HERE, 'labels.json'), 'w'), indent=2)


if __name__ == '__main__':
    main()
