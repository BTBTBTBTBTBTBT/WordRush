# art-scene-banner-halloween (FINISH_SPEC X, night art 10-03; rebuilt 10-05 season preview): three of the
# ON-MODEL layered Halloween figures (seasons/halloween/header/: O1 pumpkin, W vampire, R ghost — the same
# pixels the cast header ships as art-halloween-<id>) with the glossy props (pumpkin, bat, candy, ghost) —
# same framing as banner-sweep / banner-flawless (wide, transparent). Code compositing only, no redraw.
import os
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
HW = os.path.join(HERE, '..', 'cast', 'halloween')          # props (the shipped art-halloween-prop-*)
FIG = os.path.join(HERE, '..', 'seasons', 'halloween', 'header')   # on-model layered figures
W, H = 980, 600


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def load(path, h):
    im = trim(Image.open(path).convert('RGBA'))
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


out = Image.new('RGBA', (W, H), (0, 0, 0, 0))


def put(im, x, y, shadow=True):
    if shadow:
        sh = Image.new('RGBA', im.size, (40, 20, 60, 0))
        sh.putalpha(im.getchannel('A').point(lambda v: int(v * 0.22)).filter(ImageFilter.GaussianBlur(8)))
        out.alpha_composite(sh, (x + 5, y + 7))
    out.alpha_composite(im, (x, y))


# props behind / around
put(load(os.path.join(HW, 'props', 'bat.png'), 110), 70, 30, False)
put(load(os.path.join(HW, 'props', 'bat.png'), 80).transpose(Image.FLIP_LEFT_RIGHT), 800, 70, False)
put(load(os.path.join(HW, 'props', 'ghost.png'), 120), 690, 40, False)
o1 = load(os.path.join(FIG, 'o1.png'), 400)
w = load(os.path.join(FIG, 'w.png'), 440)
r = load(os.path.join(FIG, 'r.png'), 380)
put(o1, 40, H - o1.height - 20)
put(r, W - r.width - 40, H - r.height - 24)
put(w, (W - w.width) // 2, H - w.height - 6)
put(load(os.path.join(HW, 'props', 'pumpkin.png'), 150), 250, H - 150)
put(load(os.path.join(HW, 'props', 'candy.png'), 70), 610, H - 92)
out = trim(out)
out.save(os.path.join(HERE, 'banner-halloween.png'))
print(out.size)
