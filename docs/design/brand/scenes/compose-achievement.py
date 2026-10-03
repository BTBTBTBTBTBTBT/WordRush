# art-scene-achievement (FINISH_SPEC BF2, night art 10-03): C and O1 presenting an empty glowing pedestal —
# the app composites the unlocked badge over the bottom-center. Characters + pedestal are full-size ChatGPT
# drawings (src/), keyed; they are mirrored so the letters read right (C drawn facing left came out reversed).
import os
import numpy as np
from PIL import Image, ImageOps, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1700, 1000


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def fit_w(im, w):
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
# soft gold glow behind the badge spot
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - W * 0.5) / (W * 0.30)) ** 2 + ((yy - H * 0.56) / (H * 0.46)) ** 2)
a = np.clip(1 - d, 0, 1) ** 1.6 * 200
glow = np.zeros((H, W, 4), np.uint8)
glow[..., 0], glow[..., 1], glow[..., 2], glow[..., 3] = 255, 214, 102, a.astype(np.uint8)
out.alpha_composite(Image.fromarray(glow, 'RGBA'))
ped = trim(Image.open(os.path.join(HERE, 'src', 'ach-pedestal.png')).convert('RGBA'))
pw = int(W * 0.42)
ped = ped.resize((pw, round(ped.height * pw / ped.width)), Image.LANCZOS)
out.alpha_composite(ped, ((W - pw) // 2, H - ped.height))
# the badge covers the middle ~45%: the presenters stand at the edges, their arms reaching in behind it
c = fit_w(ImageOps.mirror(trim(Image.open(os.path.join(HERE, 'src', 'ach-c.png')).convert('RGBA'))), int(W * 0.31))
o = fit_w(ImageOps.mirror(trim(Image.open(os.path.join(HERE, 'src', 'ach-o1.png')).convert('RGBA'))), int(W * 0.33))
for im, x in ((c, int(W * 0.005)), (o, W - o.width - int(W * 0.005))):
    sh = Image.new('RGBA', im.size, (40, 20, 60, 0))
    sh.putalpha(im.getchannel('A').point(lambda v: int(v * 0.25)).filter(ImageFilter.GaussianBlur(8)))
    out.alpha_composite(sh, (x + 6, H - im.height - 2))
    out.alpha_composite(im, (x, H - im.height - 8))
out.save(os.path.join(HERE, 'achievement.png'))
print(out.size)
