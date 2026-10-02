# Cut a ChatGPT capture shot on a flat key color (magenta or green) out to a
# transparent PNG (founder prefers free ChatGPT art over the paid API).
#   python3 key-capture.py <capture.jpg> <x0,y0,x1,y1> <magenta|green> <out.png>
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


px = im.load()
alpha = Image.new('L', im.size)
ap = alpha.load()
rgba = Image.new('RGBA', im.size)
rp = rgba.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b = px[x, y]
        d = dist((r, g, b))
        a = 0 if d <= LO else 255 if d >= HI else int(255 * (d - LO) / (HI - LO))
        # Despill: pull the key's dominant channels back toward the others.
        if key == 'magenta':
            cap = max(g, 0) + 40
            r, b = min(r, cap if a < 255 else r), min(b, cap if a < 255 else b)
        else:
            g = min(g, max(r, b) + 30) if a < 255 else g
        ap[x, y] = a
        rp[x, y] = (r, g, b, a)
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
