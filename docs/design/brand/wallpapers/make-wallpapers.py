# Wallpapers v3 (founder, 2026-10-02 late: the v2 ones were "very low res"). v1/v2 upscaled a
# 444-px ChatGPT capture (home-wallpaper-capture.png, wall2…6) 2.4× and phones stretched it
# again. v3 DRAWS the same look in code at full phone resolution: a dreamy pastel sky with
# clouds + bokeh and glossy pastel letter tiles (the ART_SPEC §20 tile recipe from
# social/kit.py) at three depths — big soft tiles hugging the edges, crisp mid tiles, small
# blurred far ones — keeping the middle calm for content. Every screen gets its own seed
# (different letters + placements) and its page's / game's color.
#   out/wall-<name>.png       1179×2556 portrait (iOS, Android, web phones)
#   out-wide/wall-<name>-wide.png  2400×1500 landscape (web desktop only)
import colorsys, hashlib, os, random, re, sys
import numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'social'))
import kit  # noqa: E402

REPO = kit.REPO
PORTRAIT = (1179, 2556)
WIDE = (2400, 1500)
LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWYZ'
SKY = dict(bokeh=0.3, bokeh_size=1.9, cloud=1.7)   # fewer, bigger, softer lights; puffier clouds


def hx(h, s, v):
    r, g, b = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))


def soft(im, radius):
    """Blur an RGBA image premultiplied, so edges fade out instead of going dark."""
    return im.convert('RGBa').filter(ImageFilter.GaussianBlur(radius)).convert('RGBA')


def fade(im, k):
    a = np.asarray(im).copy(); a[..., 3] = (a[..., 3] * k).astype('uint8')
    return Image.fromarray(a)


def wallpaper(size, hue, seed, home=False):
    w, h = size
    rnd = random.Random(seed)
    if home:   # the founder's favorite lilac → pink
        sky = kit.sky(w, h, top='#B9A6F7', mid='#E9BDF2', bottom='#FFD6E8', seed=seed, **SKY)
        palette = ['#C4A8FF', '#FFB3D9', '#A9C8FF', '#FFC9A8', '#A8E6CF', '#E0B0FF']
    else:
        sky = kit.sky(w, h, top=hx(hue, 0.34, 0.97), mid=hx(hue + 0.03, 0.22, 0.99),
                      bottom=hx(hue + 0.07, 0.14, 1.0), seed=seed, **SKY)
        palette = [hx(hue + d, s, 1.0) for d, s in
                   [(-0.08, 0.38), (-0.03, 0.45), (0, 0.42), (0.04, 0.36), (0.09, 0.32), (0.5, 0.18)]]
    s = min(w, h) if w < h else h * 0.9           # tile scale reference
    landscape = w > h
    placed = []

    def free(x, y, r):
        return all((x - px) ** 2 + (y - py) ** 2 > ((r + pr) * 0.9) ** 2 for px, py, pr in placed)

    def drop(n, lo, hi, where, blur, alpha):
        tiles = []
        for _ in range(n):
            for _try in range(400):
                size_ = rnd.uniform(lo, hi) * s
                x, y = where()
                if free(x, y, size_ * 0.6):
                    placed.append((x, y, size_ * 0.6)); tiles.append((x, y, size_)); break
        for x, y, size_ in tiles:
            t = kit.letter_tile(rnd.choice(LETTERS), int(size_), rnd.choice(palette))
            t = t.rotate(rnd.uniform(-24, 24), resample=Image.BICUBIC, expand=True)
            if blur:
                t = soft(t, blur * size_ / 100)
            if alpha < 1:
                t = fade(t, alpha)
            sky.alpha_composite(t, (int(x - t.width / 2), int(y - t.height / 2)))

    TOP = (0.28 if landscape else 0.36)   # founder 10-02: clean sky behind the header / cast row

    def edge():       # big near tiles hug the edges / corners, partly off-screen
        if landscape:
            return (rnd.choice([rnd.uniform(-0.04, 0.16), rnd.uniform(0.84, 1.04)]) * w, rnd.uniform(TOP + 0.04, 1.05) * h)
        side = rnd.random()
        if side < 0.7:
            return (rnd.choice([rnd.uniform(-0.08, 0.1), rnd.uniform(0.9, 1.08)]) * w, rnd.uniform(TOP + 0.04, 0.98) * h)
        return (rnd.uniform(0.1, 0.9) * w, rnd.uniform(0.94, 1.03) * h)

    def outer():      # mid tiles: anywhere except the calm middle
        while True:
            x, y = rnd.uniform(0.02, 0.98), rnd.uniform(TOP, 0.98)
            if not (0.28 < x < 0.72 and 0.22 < y < 0.78):
                return x * w, y * h

    def anywhere():
        return rnd.uniform(0.04, 0.96) * w, rnd.uniform(TOP, 0.97) * h

    # far first (drawn behind), then mid, then near
    drop(7 if not landscape else 10, 0.06, 0.1, anywhere, blur=5, alpha=0.55)
    drop(4 if not landscape else 6, 0.13, 0.19, outer, blur=0, alpha=0.95)
    drop(3 if not landscape else 4, 0.27, 0.36, edge, blur=0, alpha=1.0)
    # a last whisper of bokeh over the tiles for depth
    return kit.sky_glow(sky, seed) if hasattr(kit, 'sky_glow') else sky


def hue_of(hex_):
    r, g, b = kit.hex2rgb(hex_)
    return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[0]


def seed_of(name):
    return int(hashlib.md5(name.encode()).hexdigest()[:8], 16)


def screens():
    yield 'home', None
    for n, c in {'leaderboard': '#f59e0b', 'stats': '#3b82f6', 'friends': '#ec4899', 'vs': '#14b8a6'}.items():
        yield n, c
    s = open(os.path.join(REPO, 'apps', 'web', 'lib', 'modes.generated.ts')).read()
    for blk in re.findall(r'\{\s*"id":.*?\n  \}', s, re.S):
        mid = re.search(r'"id":\s*"([^"]+)"', blk).group(1)
        acc = re.search(r'"accentHex":\s*"([^"]+)"', blk).group(1)
        if mid not in ('vs', 'more'):
            yield f'game-{mid}', acc


if __name__ == '__main__':
    only = sys.argv[1:]
    OUT = os.path.join(HERE, 'out'); OUTW = os.path.join(HERE, 'out-wide')
    os.makedirs(OUT, exist_ok=True); os.makedirs(OUTW, exist_ok=True)
    n = 0
    for name, col in screens():
        if only and name not in only:
            continue
        hue = hue_of(col) if col else 0
        wallpaper(PORTRAIT, hue, seed_of(name), home=col is None).convert('RGB').save(os.path.join(OUT, f'wall-{name}.png'))
        wallpaper(WIDE, hue, seed_of(name + '-wide'), home=col is None).convert('RGB').save(os.path.join(OUTW, f'wall-{name}-wide.png'))
        n += 1
    print('wallpapers', n, PORTRAIT, WIDE)
