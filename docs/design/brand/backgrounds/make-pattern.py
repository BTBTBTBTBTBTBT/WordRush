# v2 background pattern after the ChatGPT layout mockup (docs/design/brand/layouts):
# big glossy letter tiles, softly blurred for depth, opacity baked in. Seamless 720 px.
# Apps draw it at 100% (light) / 60% (dark) over the page tint gradient.
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
FONT = '../../../apps/ios/Wordocious/Resources/Nunito.ttf'
S = 720
rnd = random.Random(5)
cols = [(167, 139, 250), (244, 114, 182), (251, 191, 36), (96, 165, 250), (45, 212, 191), (52, 211, 153), (253, 186, 116), (196, 181, 253)]
letters = 'WORDOCIOUSABDEGHKLMNPRTY'


def tile(s, c, L):
    pad = 34
    t = Image.new('RGBA', (s + 2 * pad, s + 2 * pad), c + (0,))   # transparent but colored: no dark fringe when blurred
    d = ImageDraw.Draw(t)
    d.rounded_rectangle([pad, pad, pad + s, pad + s], radius=s * 0.28, fill=c + (255,))
    hl = Image.new('RGBA', t.size, (255, 255, 255, 0))
    ImageDraw.Draw(hl).rounded_rectangle([pad + s * 0.12, pad + s * 0.07, pad + s * 0.88, pad + s * 0.36], radius=s * 0.16, fill=(255, 255, 255, 90))
    t.alpha_composite(hl.filter(ImageFilter.GaussianBlur(s * 0.035)))
    f = ImageFont.truetype(FONT, int(s * 0.6)); f.set_variation_by_axes([1000])
    bb = d.textbbox((0, 0), L, font=f)
    d.text((pad + (s - (bb[2] - bb[0])) / 2 - bb[0], pad + (s - (bb[3] - bb[1])) / 2 - bb[1]), L, font=f, fill=(255, 255, 255, 240))
    return t


out = np.zeros((S, S, 4), dtype=np.float32)
placed = []
i = 0
while len(placed) < 9 and i < 800:
    i += 1
    s = rnd.randint(70, 118); x = rnd.randint(0, S); y = rnd.randint(0, S)
    if any(min(abs(x - px), S - abs(x - px)) ** 2 + min(abs(y - py), S - abs(y - py)) ** 2 < ((s + ps) * 0.95) ** 2 for px, py, ps in placed):
        continue
    k = len(placed); placed.append((x, y, s))
    c = cols[k % len(cols)]
    t = tile(s, c, letters[rnd.randrange(len(letters))])
    t = t.rotate(rnd.uniform(-22, 22), resample=Image.BICUBIC, expand=True, fillcolor=c + (0,))
    t = t.filter(ImageFilter.GaussianBlur(rnd.choice([2.5, 3.5, 5, 6.5])))
    op = rnd.choice([0.32, 0.38, 0.45])
    a = np.asarray(t).astype(np.float32)
    a[..., 3] *= op
    h, w = a.shape[:2]
    for dx in (-S, 0, S):
        for dy in (-S, 0, S):
            x0, y0 = x - w // 2 + dx, y - h // 2 + dy
            xs, ys = max(0, x0), max(0, y0); xe, ye = min(S, x0 + w), min(S, y0 + h)
            if xs >= xe or ys >= ye:
                continue
            src = a[ys - y0:ye - y0, xs - x0:xe - x0]
            dst = out[ys:ye, xs:xe]
            sa = src[..., 3:4] / 255; da = dst[..., 3:4] / 255
            oa = sa + da * (1 - sa)
            rgb = (src[..., :3] * sa + dst[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
            dst[..., :3] = rgb; dst[..., 3:4] = oa * 255
Image.fromarray(out.clip(0, 255).astype('uint8'), 'RGBA').save('backgrounds/tile-pattern.png')
print('pattern', S)
