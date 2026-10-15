# Cut the ChatGPT lettering captures (flat #00FF00 sheets, zoom-captured from the free ChatGPT
# chat at 2x) into transparent title PNGs, one per title block.
#   python3 docs/design/brand/social/jp45/extract-lettering.py
# Keys on "greenness" (g - max(r, b)) so ChatGPT's darkened bottom gradient still keys, kills the
# Edit/share overlay pills in the bottom corners, and splits blocks by empty rows.
import os
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'lettering', 'raw')
OUT = os.path.join(HERE, 'lettering')

# capture -> (min empty-row gap that splits blocks, [names top to bottom])
SHEETS = {
    'sheet1-launch-capture.png': (30, ['tomorrow', 'daily-games', 'one-score', 'bring-your-family']),
    'sheet2-halloween-dressed-capture.png': (400, ['app-got-dressed']),
    'sheet3-monday-wotd-capture.png': (40, ['monday-masters', 'word-of-the-day-quiz']),
    'sheet3-sweep-muddle-capture.png': (40, ['sweep-sunday', 'muddle-wednesday']),
    'sheet4-newweek-crown-caption-capture.png': (40, ['new-week-zero-points', 'the-crown-is-open', 'caption-this']),
    'sheet4-7letters-muddleworks-capture.png': (40, ['7-letters-one-word', 'how-muddle-works']),
    'sheet6-wotd-capture.png': (40, ['word-of-the-day', 'how-to-play']),
    'sheet5-meet-cast-capture.png': (40, ['meet-the-cast', 'bring-your-family-b']),
}


def key(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gn = g - np.maximum(r, b)
    alpha = 1 - np.clip((gn - 25) / 110, 0, 1)
    # despill: where the pixel is partly background, pull green down to the red/blue level
    spill = (alpha < 1) & (gn > 0)
    g2 = np.where(spill, np.minimum(g, np.maximum(r, b) + 4), g)
    out = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def clean(rgba):
    al = np.asarray(rgba.getchannel('A'))
    solid = al > 128
    lab, n = ndimage.label(solid)
    h, w = al.shape
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        area = len(ys)
        # the Edit / share pills sit in the bottom corners and have a faint (not solid) body
        if area < 400 or (ys.min() > h - 120 and (xs.max() < 150 or xs.min() > w - 150)):
            rgba.putalpha(Image.fromarray(np.where(lab == i, 0, np.asarray(rgba.getchannel('A'))).astype(np.uint8)))
    al = np.array(rgba.getchannel('A'))
    al[:6, :] = 0; al[-6:, :] = 0; al[:, :6] = 0; al[:, -6:] = 0
    # drop any remaining faint haze (pill glow) that is not next to solid letters
    near = ndimage.binary_dilation(al > 200, iterations=6)
    al = np.where(near, al, 0).astype(np.uint8)
    rgba.putalpha(Image.fromarray(al))
    return rgba


def split(rgba, gap):
    al = np.asarray(rgba.getchannel('A')) > 60
    rows = al.sum(axis=1) > 6
    blocks, start, empty = [], None, 0
    for y, v in enumerate(rows):
        if v:
            if start is None:
                start = y
            empty = 0
            end = y
        elif start is not None:
            empty += 1
            if empty >= gap:
                blocks.append((start, end)); start = None
    if start is not None:
        blocks.append((start, end))
    out = []
    for y0, y1 in blocks:
        part = rgba.crop((0, max(0, y0 - 4), rgba.width, min(rgba.height, y1 + 5)))
        bb = part.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox()
        out.append(part.crop(bb))
    return out


if __name__ == '__main__':
    for fn, (gap, names) in SHEETS.items():
        p = os.path.join(RAW, fn)
        if not os.path.exists(p):
            continue
        blocks = split(clean(key(Image.open(p))), gap)
        if len(blocks) != len(names):
            print('!!', fn, 'found', len(blocks), 'blocks, expected', len(names))
        for nm, im in zip(names, blocks):
            im.save(os.path.join(OUT, nm + '.png'))
            print(nm, im.size)
