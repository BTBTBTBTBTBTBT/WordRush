# Social creative kit: full-resolution backgrounds and letter tiles drawn in code (ChatGPT
# captures top out ~800 px wide, too soft for 2560 px banners). The tile recipe is ART_SPEC §20
# (the letter-tile avatars), so social art and in-app avatars are the same object.
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(BRAND, '..', '..', '..'))
NUNITO = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Nunito.ttf')
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
TILE_COLORS = ['#8B2CF5', '#FF9F1A', '#0A6CFF', '#FF2F91', '#00B4BE', '#4CC77A', '#9B3DF3', '#F5A623', '#F0782C']


def font(size, weight='Black'):
    f = ImageFont.truetype(NUNITO, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(rgb, k):
    """k > 0 lightens toward white, k < 0 darkens toward black."""
    if k >= 0:
        return tuple(round(c + (255 - c) * k) for c in rgb)
    return tuple(round(c * (1 + k)) for c in rgb)


def vgrad(w, h, stops):
    """Vertical gradient; stops = [(t, rgb), ...]."""
    t = np.linspace(0, 1, h)[:, None]
    out = np.zeros((h, 1, 3))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (t >= t0) & (t <= t1)
        f = np.where(m, (t - t0) / max(t1 - t0, 1e-6), 0)
        for k in range(3):
            out[..., k] = np.where(m, c0[k] + (c1[k] - c0[k]) * f, out[..., k])
    return Image.fromarray(np.repeat(out, w, axis=1).clip(0, 255).astype('uint8'), 'RGB')


def rr_mask(w, h, r, ss=4):
    m = Image.new('L', (w * ss, h * ss), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), r * ss, fill=255)
    return m.resize((w, h), Image.LANCZOS)


def letter_tile(text, size, color, shadow=True):
    """ART_SPEC §20 tile, RGBA, size×size (plus a soft drop shadow margin if shadow)."""
    base = hex2rgb(color) if isinstance(color, str) else color
    edge = shade(base, -0.22)
    r = round(size * 0.24)
    pad = round(size * 0.12) if shadow else 0
    img = Image.new('RGBA', (size + 2 * pad, size + 2 * pad), (0, 0, 0, 0))
    if shadow:   # soft contact shadow under the tile
        sh = Image.new('L', img.size, 0)
        ImageDraw.Draw(sh).rounded_rectangle((pad + size * 0.06, pad + size * 0.14, pad + size * 0.94, pad + size * 1.06), r, fill=90)
        sh = sh.filter(ImageFilter.GaussianBlur(size * 0.06))
        img.paste(Image.new('RGBA', img.size, (60, 20, 90, 255)), (0, 0), sh)
    body = Image.new('RGBA', (size, size), edge + (255,))
    tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tile.paste(body, (0, 0), rr_mask(size, size, r))
    fh = size - round(size * 0.07)
    face = vgrad(size, fh, [(0, shade(base, 0.18)), (0.7, base), (1, shade(base, -0.06))]).convert('RGBA')
    tile.paste(face, (0, 0), rr_mask(size, fh, r))
    # gloss
    gw, gh = round(size * 0.84), round(fh * 0.42)
    g = np.zeros((gh, gw, 4), np.uint8); g[..., :3] = 255
    g[..., 3] = (np.linspace(0.30, 0, gh)[:, None] * 255 * np.ones((1, gw))).astype('uint8')
    gl = Image.fromarray(g, 'RGBA')
    gm = rr_mask(gw, gh, round(size * 0.18))
    gl.putalpha(Image.fromarray((np.asarray(gl.split()[3]).astype(float) * np.asarray(gm) / 255).astype('uint8')))
    tile.alpha_composite(gl, (round(size * 0.08), round(size * 0.08)))
    # letters
    if text:
        fs = round(size * (0.56 if len(text) == 1 else 0.42))
        f = font(fs)
        lay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        bb = d.textbbox((0, 0), text, font=f, anchor='lt')
        x = (size - (bb[2] - bb[0])) / 2 - bb[0]
        y = (fh - (bb[3] - bb[1])) / 2 - bb[1]
        s = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(s).text((x, y + size * 0.03), text, font=f, fill=edge + (115,), anchor='lt')
        s = s.filter(ImageFilter.GaussianBlur(max(1, size * 0.02)))
        lay.alpha_composite(s)
        ImageDraw.Draw(lay).text((x, y), text, font=f, fill=(255, 255, 255, 255), anchor='lt')
        tile.alpha_composite(lay)
    img.alpha_composite(tile, (pad, pad))
    return img


def sky(w, h, top='#B9A6F7', mid='#E7B8F0', bottom='#FFD3E6', seed=1, bokeh=1.0, bokeh_size=1.0, cloud=1.0):
    """Dreamy lilac→pink sky with soft cloud puffs and bokeh, any resolution."""
    rnd = random.Random(seed)
    img = vgrad(w, h, [(0, hex2rgb(top)), (0.55, hex2rgb(mid)), (1, hex2rgb(bottom))]).convert('RGBA')
    s = max(w, h)
    # draw on alpha masks and blur those, so soft edges fade to the sky, not to black
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    for _ in range(int(14 + w * h / 90000)):
        cx = rnd.uniform(-0.1, 1.1) * w; cy = rnd.uniform(0.35, 1.15) * h
        for _ in range(4):
            rr = rnd.uniform(0.05, 0.13) * s
            ox = rnd.uniform(-1, 1) * rr; oy = rnd.uniform(-0.4, 0.4) * rr
            d.ellipse((cx + ox - rr, cy + oy - rr * 0.8, cx + ox + rr, cy + oy + rr * 0.8), fill=min(255, int(rnd.randint(50, 100) * cloud)))
    img.paste(Image.new('RGBA', (w, h), (255, 240, 250, 255)), (0, 0), m.filter(ImageFilter.GaussianBlur(s * 0.03)))
    for col in [(255, 250, 220), (255, 225, 245), (225, 232, 255)]:
        m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
        for _ in range(int((30 + w * h / 30000) / 3 * bokeh)):
            x = rnd.uniform(0, w); y = rnd.uniform(0, h); rr = rnd.uniform(0.004, 0.022) * s * bokeh_size
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=rnd.randint(70, 170))
        img.paste(Image.new('RGBA', (w, h), col + (255,)), (0, 0), m.filter(ImageFilter.GaussianBlur(s * 0.004 * bokeh_size)))
    return img


def scatter_tiles(img, letters, seed=2, keep_clear=None, min_size=0.05, max_size=0.16, count=None, avoid=None):
    """Float glossy letter tiles over img (tilted, some blurred far away). keep_clear =
    list of (x0, y0, x1, y1) fractions where no tile center may land."""
    rnd = random.Random(seed)
    w, h = img.size; s = min(w, h) if w / h < 2.2 else h * 1.6
    placed = []
    n = count or len(letters)
    tries = 0
    while len(placed) < n and tries < 4000:
        tries += 1
        fx, fy = rnd.uniform(-0.02, 1.02), rnd.uniform(-0.02, 1.02)
        if keep_clear and any(a <= fx <= c and b <= fy <= d for a, b, c, d in keep_clear):
            continue
        size = rnd.uniform(min_size, max_size) * s
        x, y = fx * w, fy * h
        if avoid is not None:   # avoid = bool array (content pixels); tile box must not touch them
            r = size * 0.62
            ys, ye = max(0, int(y - r)), min(h, int(y + r)); xs, xe = max(0, int(x - r)), min(w, int(x + r))
            if ye <= ys or xe <= xs or avoid[ys:ye, xs:xe].any():
                continue
        if any(math.hypot(x - px, y - py) < (size + ps) * 0.75 for px, py, ps, _ in placed):
            continue
        placed.append((x, y, size, len(placed)))
    placed.sort(key=lambda p: p[2])   # small (far) first
    for x, y, size, k in placed:
        t = letter_tile(letters[k % len(letters)], int(size), TILE_COLORS[(k * 4 + seed) % len(TILE_COLORS)])
        t = t.rotate(rnd.uniform(-22, 22), resample=Image.BICUBIC, expand=True)
        far = size < (min_size + (max_size - min_size) * 0.3) * s
        if far:
            t = t.filter(ImageFilter.GaussianBlur(size * 0.05))
            a = np.asarray(t).copy(); a[..., 3] = (a[..., 3] * 0.6).astype('uint8'); t = Image.fromarray(a)
        img.alpha_composite(t, (int(x - t.width / 2), int(y - t.height / 2)))
    return img


def place(canvas, im, cx, cy, height=None, width=None):
    if height:
        im = im.resize((round(im.width * height / im.height), round(height)), Image.LANCZOS)
    elif width:
        im = im.resize((round(width), round(im.height * width / im.width)), Image.LANCZOS)
    canvas.alpha_composite(im, (round(cx - im.width / 2), round(cy - im.height / 2)))
    return im.size


def text(canvas, s, cx, cy, size, fill=(255, 255, 255), stroke=None, sw=0, weight='Black', shadow=True):
    f = font(size, weight)
    d = ImageDraw.Draw(canvas)
    if shadow:
        sh = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((cx, cy + size * 0.06), s, font=f, fill=(70, 20, 110, 110), anchor='mm', stroke_width=sw)
        canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size * 0.05)))
    d.text((cx, cy), s, font=f, fill=fill, anchor='mm', stroke_width=sw, stroke_fill=stroke)
