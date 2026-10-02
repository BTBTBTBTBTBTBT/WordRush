# Home header options (founder 2026-10-02: "the wordocious at the top needs to be more
# prominent and ideally cover all of the area end to end").
#   A: the ten cast heroes, bigger, edge to edge (slight overlap, wave).
#   B: the chunky WORDOCIOUS wordmark with each character sitting on its own letter.
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(BRAND, 'social'))
import kit
CAST = kit.CAST
W = 1179  # 393 pt @3x


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())


def option_a(h=250):
    heroes = [trim(Image.open(os.path.join(BRAND, 'cast', 'hero', f'{c}.png')).convert('RGBA')) for c in CAST]
    ov = 0.14
    r = [im.width / im.height for im in heroes]
    ch = (W - 24) / (sum(r) * (1 - ov) + r[-1] * ov)
    ch = min(ch, h * 0.86)
    out = Image.new('RGBA', (W, h), (0, 0, 0, 0))
    ws = [x * ch for x in r]
    total = sum(ws) * (1 - ov) + ws[-1] * ov
    x = (W - total) / 2
    for k, (im, w) in enumerate(zip(heroes, ws)):
        im = im.resize((round(w), round(ch)), Image.LANCZOS)
        lift = ch * 0.1 * (k % 2)
        out.alpha_composite(im, (round(x), round(h - ch - lift - 4)))
        x += w * (1 - ov)
    return trim(out)


def option_b():
    wm = trim(Image.open(os.path.join(BRAND, 'social', 'wordmark-keyed.png')).convert('RGBA'))
    scale = (W - 20) / wm.width
    wm = wm.resize((W - 20, round(wm.height * scale)), Image.LANCZOS)
    # letter centers from the alpha columns (ten letters)
    a = np.asarray(wm.getchannel('A')) > 60
    cols = a.any(axis=0)
    runs, inrun = [], False
    for x, v in enumerate(cols):
        if v and not inrun: s = x; inrun = True
        if not v and inrun: runs.append((s, x)); inrun = False
    if inrun: runs.append((s, len(cols)))
    if len(runs) != 10:   # letters touch: fall back to even spacing
        runs = [(i * wm.width / 10, (i + 1) * wm.width / 10) for i in range(10)]
    poses = ['w-sit', 'o1-sit', 'r-sit', 'd-sit', 'o2-sit', 'c-sit', 'i-sit', 'o3-sit', 'u-meditate', 's-sit']
    ph = round(wm.height * 1.05)
    top = ph - round(wm.height * 0.22)    # characters' bottoms sink into the letter tops
    out = Image.new('RGBA', (W, top + wm.height + 6), (0, 0, 0, 0))
    out.alpha_composite(wm, (10, top))
    for (x0, x1), p in zip(runs, poses):
        im = trim(Image.open(os.path.join(BRAND, 'poses', f'{p}.png')).convert('RGBA'))
        h = ph
        w = im.width * h / im.height
        maxw = (x1 - x0) * 1.35
        if w > maxw: w = maxw; h = im.height * w / im.width
        im = im.resize((round(w), round(h)), Image.LANCZOS)
        cx = 10 + (x0 + x1) / 2
        out.alpha_composite(im, (round(cx - w / 2), round(top + wm.height * 0.22 - h)))
    return trim(out)


if __name__ == '__main__':
    a = option_a(); a.save(os.path.join(HERE, 'home-header-A.png'))
    b = option_b(); b.save(os.path.join(HERE, 'home-header-B.png'))
    print(a.size, b.size)
