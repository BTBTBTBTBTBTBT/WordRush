# Cut a ChatGPT capture shot on a flat key color (magenta, green or cyan) out to a
# transparent PNG (founder prefers free ChatGPT art over the paid API).
#   python3 key-capture.py <capture.jpg> <x0,y0,x1,y1> <magenta|green|cyan> <out.png>
# Soft alpha from the distance to the key color, then despill so no tint is
# left on the edges; upscaled to 1024 to sit next to the API-made cast.
import sys
from PIL import Image, ImageFilter

src, box, key, out = sys.argv[1], [int(v) for v in sys.argv[2].split(',')], sys.argv[3], sys.argv[4]
im = Image.open(src).convert('RGB').crop(box)
# Sample the key from the four corners (the capture's exact shade, not the ideal one).
corners = [im.getpixel((4, 4)), im.getpixel((im.width - 5, 4)), im.getpixel((4, im.height - 5)), im.getpixel((im.width - 5, im.height - 5))]
K = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
LO, HI = 60, 150  # distance below LO = fully key, above HI = fully kept


def dist(p):
    return ((p[0] - K[0]) ** 2 + (p[1] - K[1]) ** 2 + (p[2] - K[2]) ** 2) ** 0.5


import numpy as np
from scipy import ndimage
arr = np.asarray(im).astype(np.float32)
d = np.sqrt(((arr - np.array(K, np.float32)) ** 2).sum(axis=2))
# Background = pixels that match the key; only a thin band (3 px) next to it
# gets soft alpha + despill. Everything inside a character stays fully opaque,
# so colors near the key (blue D, white letters on cyan) aren't eaten.
bg = d <= LO
# Only key-colored regions connected to the image border are background. Enclosed key-colored
# pockets (a yawning mouth, a tear, a gap under an arm) stay unless they are big (real holes
# like the inside of a letter O are large; facial details are small).
lab, nlab = ndimage.label(bg)
border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sizes = ndimage.sum(np.ones_like(lab), lab, index=np.arange(1, nlab + 1))
keep_bg = np.zeros(nlab + 1, bool)
for i in range(1, nlab + 1):
    keep_bg[i] = (i in border) or sizes[i - 1] > bg.size * 0.004
bg = keep_bg[lab]
band = ndimage.binary_dilation(bg, iterations=3) & ~bg
alpha = np.full(d.shape, 255.0)
alpha[bg] = 0
soft = np.clip((d - LO) / (HI - LO), 0, 1) * 255
alpha[band] = np.minimum(255, soft[band])
r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
edge = band & (alpha < 255)
if key == 'magenta':
    cap = g + 40
    r[edge] = np.minimum(r[edge], cap[edge]); b[edge] = np.minimum(b[edge], cap[edge])
elif key == 'cyan':
    cap = r + 40
    g[edge] = np.minimum(g[edge], cap[edge]); b[edge] = np.minimum(b[edge], cap[edge])
else:
    g[edge] = np.minimum(g[edge], np.maximum(r, b)[edge] + 30)
rgba = Image.fromarray(np.dstack([r, g, b, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')
alpha = rgba.getchannel('A')
# Tighten the edge by one pixel to drop the JPEG halo, then soften slightly.
a2 = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
rgba.putalpha(a2)
bbox = a2.point(lambda v: 255 if v > 24 else 0).getbbox()
rgba = rgba.crop(bbox)
scale = 900 / max(rgba.size)
rgba = rgba.resize((round(rgba.width * scale), round(rgba.height * scale)), Image.LANCZOS)
canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
canvas.alpha_composite(rgba, ((1024 - rgba.width) // 2, (1024 - rgba.height) // 2))
canvas.save(out)
print('key', K, 'saved', out)
