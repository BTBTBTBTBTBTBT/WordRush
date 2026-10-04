# FINISH_SPEC BJ17: the GO PRO sign cast. The API art (scenes/raw/gopro-<id>-1.png, images edit with each
# character's hero + refs + the gopro title art) keeps the character; where the model misspelled or
# cropped the lettering, the canonical titles/cast-colors/gopro.png is laid over the sign (covering the
# model's lettering box), on a canvas padded so nothing touches the edge. Output: gopro-sign/<id>.png.
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.abspath(os.path.join(HERE, '..', '..'))
SIGN = Image.open(os.path.join(BRAND, 'titles', 'cast-colors', 'gopro.png')).convert('RGBA')
KEEP = {'w': 'gopro-hold-1', 'o1': 'gopro-o1-1', 'i': 'gopro-i-1', 'u': 'gopro-u-1'}
# id → (raw, lettering row band)
FIX = {'s': (0, 224), 'd': (0, 240), 'c': (0, 250), 'o3': (0, 210), 'o2': (0, 290), 'r': (528, 800)}
PAD = 160
FADE = {'c', 'o3', 'o2'}

for i, raw in KEEP.items():
    Image.open(os.path.join(BRAND, 'scenes', 'raw', raw + '.png')).save(os.path.join(HERE, i + '.png'))
for i, (y0, y1) in FIX.items():
    im = Image.open(os.path.join(BRAND, 'scenes', 'raw', f'gopro-{i}-1.png')).convert('RGBA')
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3] > 40
    gold = al & (r > 190) & (g > 130) & (b < 110) & (r - b > 120)
    band = np.zeros_like(gold); band[y0:y1] = True
    ys, xs = np.where(gold & band)
    x0, x1, t, bt = xs.min(), xs.max(), ys.min(), ys.max()
    w = int((x1 - x0) * 1.05) + 8
    h = int(w * SIGN.height / SIGN.width)
    if h < (bt - t) + 12:
        h = (bt - t) + 12; w = int(h * SIGN.width / SIGN.height)
    cx = (x0 + x1) // 2
    top = bt + 6 - h
    canvas = Image.new('RGBA', (im.width + 2 * PAD, im.height + 2 * PAD), (0, 0, 0, 0))
    canvas.alpha_composite(im, (PAD, PAD))
    canvas.alpha_composite(SIGN.resize((w, h), Image.LANCZOS), (PAD + cx - w // 2, PAD + top))
    c = np.array(canvas)
    if i == 'r':   # the model's stray gold underline below the sign
        c[PAD + 800:, :, 3] = 0
    if i in FADE:  # feet cropped by the model's frame → a soft fade, never a hard cut
        n = 90; yb = PAD + im.height
        c[yb - n:yb, :, 3] = (c[yb - n:yb, :, 3] * np.linspace(1, 0, n)[:, None]).astype(np.uint8)
    Image.fromarray(c).save(os.path.join(HERE, i + '.png'))
    print(i, (x0, x1, t, bt), '→ sign', w, h)
