# art-scene-banner-thanksgiving (Thanksgiving preview 10-16): three of the on-model costumed cast (seasons/thanksgiving/cast/:
# O1 turkey, W pilgrim, R blanket) with the glossy harvest props, same framing as banner-halloween (wide, transparent).
# Code compositing only, no redraw. The Home stage card needs this banner (the stage draws only with a season banner).
import os
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
TG = os.path.join(HERE, '..', 'seasons', 'thanksgiving')
W, H = 980, 600


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def load(path, h):
    im = trim(Image.open(path).convert('RGBA'))
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


out = Image.new('RGBA', (W, H), (0, 0, 0, 0))


def put(im, x, y, shadow=True):
    if shadow:
        sh = Image.new('RGBA', im.size, (40, 20, 20, 0))
        sh.putalpha(im.getchannel('A').point(lambda v: int(v * 0.22)).filter(ImageFilter.GaussianBlur(8)))
        out.alpha_composite(sh, (x + 5, y + 7))
    out.alpha_composite(im, (x, y))


put(load(os.path.join(TG, 'props', 'leaf-maple.png'), 110), 70, 30, False)
put(load(os.path.join(TG, 'props', 'acorn.png'), 80), 810, 70, False)
put(load(os.path.join(TG, 'props', 'leaf-maple.png'), 90).transpose(Image.FLIP_LEFT_RIGHT), 700, 40, False)
o1 = load(os.path.join(TG, 'cast', 'o1.png'), 400)
w = load(os.path.join(TG, 'cast', 'w.png'), 440)
r = load(os.path.join(TG, 'cast', 'r.png'), 380)
put(o1, 40, H - o1.height - 20)
put(r, W - r.width - 40, H - r.height - 24)
put(w, (W - w.width) // 2, H - w.height - 6)
put(load(os.path.join(TG, 'props', 'turkey-platter.png'), 130), 235, H - 130)
put(load(os.path.join(TG, 'props', 'pumpkin-pie.png'), 80), 620, H - 88)
out = trim(out)
out.save(os.path.join(HERE, 'banner-thanksgiving.png'))
print(out.size)
