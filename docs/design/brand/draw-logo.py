# Logo concept I (founder-approved 2026-10-02), drawn in code so it is free and
# razor sharp at any size: a purple-to-pink gradient (#a855f7 → #ec4899), a
# chunky rounded white W in Nunito at its heaviest weight, a thin bright top
# highlight and a soft depth shadow under the W. Outputs:
#   logo/app-icon-1024.png  full-bleed, opaque (the stores round the corners)
#   logo/mark.png           rounded tile on transparent, for in-app use
#   logo/mark-<n>.png       small sizes
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
FONT = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Nunito.ttf')
OUT = os.path.join(HERE, 'logo')
os.makedirs(OUT, exist_ok=True)

A = (0xa8, 0x55, 0xf7)
B = (0xec, 0x48, 0x99)


def gradient(size):
    """Diagonal gradient, top-left A to bottom-right B."""
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(A[i] + (B[i] - A[i]) * t) for i in range(3))
    return g


def w_layer(size, scale=0.60):
    """The white W (thickened with a same-color stroke for chunky rounded ends) and its shadow."""
    font = ImageFont.truetype(FONT, int(size * scale))
    font.set_variation_by_axes([1000])
    stroke = max(1, int(size * 0.012))
    probe = Image.new('L', (size, size))
    d = ImageDraw.Draw(probe)
    bbox = d.textbbox((0, 0), 'W', font=font, stroke_width=stroke)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1] + size * 0.01
    mask = Image.new('L', (size, size))
    ImageDraw.Draw(mask).text((x, y), 'W', font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    shadow = mask.filter(ImageFilter.GaussianBlur(size * 0.018))
    return mask, shadow


def compose(size):
    base = gradient(size).convert('RGBA')
    # Thin bright highlight along the top edge, fading down.
    hl = Image.new('L', (size, size))
    hd = ImageDraw.Draw(hl)
    band = int(size * 0.16)
    for i in range(band):
        hd.line([(0, i), (size, i)], fill=int(70 * (1 - i / band) ** 2))
    base.alpha_composite(Image.merge('RGBA', (Image.new('L', (size, size), 255),) * 3 + (hl,)))
    mask, shadow = w_layer(size)
    sh = Image.new('RGBA', (size, size), (76, 29, 149, 0))
    sh.putalpha(shadow.point(lambda v: int(v * 0.30)))
    base.alpha_composite(sh, (0, int(size * 0.014)))
    white = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    white.putalpha(mask)
    base.alpha_composite(white)
    return base


def rounded(img, radius_frac=0.225, margin_frac=0.06, with_shadow=True):
    size = img.width
    inner = int(size * (1 - 2 * margin_frac))
    tile = img.resize((inner, inner), Image.LANCZOS)
    m = Image.new('L', (inner, inner))
    ImageDraw.Draw(m).rounded_rectangle([0, 0, inner - 1, inner - 1], radius=int(inner * radius_frac), fill=255)
    tile.putalpha(m)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    off = (size - inner) // 2
    if with_shadow:
        s = Image.new('L', (size, size))
        s.paste(m, (off, off + int(size * 0.02)))
        s = s.filter(ImageFilter.GaussianBlur(size * 0.025))
        sh = Image.new('RGBA', (size, size), (76, 29, 149, 0))
        sh.putalpha(s.point(lambda v: int(v * 0.28)))
        out.alpha_composite(sh)
    out.alpha_composite(tile, (off, off))
    return out


icon = compose(1024)
icon.convert('RGB').save(os.path.join(OUT, 'app-icon-1024.png'))
mark = rounded(compose(1024))
mark.save(os.path.join(OUT, 'mark.png'))
for n in (512, 256, 128, 64, 48):
    mark.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f'mark-{n}.png'))
print('ok')
