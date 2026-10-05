#!/usr/bin/env python3
"""Halloween wallpapers, CODE-DRAWN at full resolution (never a ChatGPT upscale) from the night-1 props.
Founder rule: backgrounds never distract. So: a rich midnight-purple gradient, a low orange horizon glow, a faint
moon glow, a sparse star field, and a few SMALL faint props, only in the margins (top band and the outer edges).
Nothing sits in the content column (x 14 %..86 %, y 16 %..90 %) where boards and cards go.

  python3 docs/design/brand/seasons/halloween/walls/make-halloween-walls.py
  -> walls/wall-<page>.webp (1290 x 2796 portrait: iOS, Android, web phones)
     walls/wall-<page>-wide.webp (2400 x 1500 landscape: web desktop)
Same structure as wallpapers/make-wallpapers.py: one seed and one accent per page.
"""
import hashlib, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PROPS = os.path.join(HERE, '..', 'props')
SKY = ((18, 10, 38), (38, 16, 58), (52, 20, 40))   # indigo top, plum middle, warm dark horizon
TINT = (28, 12, 46)                                # props are dimmed toward this night color
PORTRAIT = (1290, 2796)
WIDE = (2400, 1500)

# page -> (accent glow color, props for the margins)
PAGES = {
    'home':        ((255, 138, 40),  ['moon-crescent', 'bat-flying', 'bat', 'jack-o-lantern', 'pumpkin', 'stars-cluster']),
    'games':       ((255, 122, 26),  ['moon-full', 'bat-flying', 'candy-corn', 'pumpkin-stack', 'star']),
    'stats':       ((255, 150, 60),  ['moon-crescent', 'owl', 'stars-cluster', 'candle', 'star']),
    'friends':     ((255, 120, 90),  ['moon-full', 'ghost', 'bat-flying', 'candy-wrapped', 'lollipop']),
    'leaderboard': ((255, 176, 40),  ['moon-crescent', 'bat', 'star', 'jack-o-lantern', 'stars-cluster']),
}


def prop(name, props_dir=PROPS):
    # 'season/name' reaches into another season's props (e.g. the harvest moon)
    if '/' in name:
        props_dir, name = os.path.join(HERE, '..', '..', name.split('/')[0], 'props'), name.split('/')[1]
    im = Image.open(os.path.join(props_dir, name + '.png')).convert('RGBA')
    return im.crop(im.getchannel('A').getbbox())


def place(canvas, im, cx, cy, width, alpha, blur=0.0, rot=0.0, tint=TINT):
    k = width / im.width
    p = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    if rot:
        p = p.rotate(rot, Image.BICUBIC, expand=True)
    if blur:
        p = p.convert('RGBa').filter(ImageFilter.GaussianBlur(blur)).convert('RGBA')
    # dim toward the night sky (props read as silhouettes lit by the glow, not stickers)
    a = np.asarray(p).astype(np.float32)
    a[..., :3] = a[..., :3] * 0.78 + np.array(tint) * 0.22
    a[..., 3] *= alpha
    p = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
    canvas.alpha_composite(p, (round(cx - p.width / 2), round(cy - p.height / 2)))


def radial(w, h, cx, cy, rx, ry, color, strength):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    a = np.exp(-d * 1.6) * strength
    return np.dstack([np.broadcast_to(np.array(color, np.float32), (h, w, 3)), a[..., None]])


def wallpaper(size, page, pages=None, props_dir=PROPS, sky=SKY, tint=TINT, tag='halloween', star_density=1.0, moon_glow=(150, 110, 255)):
    w, h = size
    accent, names = (pages or PAGES)[page]
    seed = int(hashlib.md5(f'{tag}-{page}-{w}'.encode()).hexdigest()[:8], 16)
    rnd = random.Random(seed)
    portrait = h > w
    # midnight gradient: deep indigo top -> plum middle -> warm dark at the horizon
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    top, mid, bot = (np.array(c) for c in sky)
    rows = np.where(t < 0.55, top + (mid - top) * (t / 0.55), mid + (bot - mid) * ((t - 0.55) / 0.45))
    base = np.repeat(rows[:, None, :], w, axis=1).astype(np.float32)
    # orange horizon glow (low, wide, soft) + a faint violet moon glow up top
    for g in [radial(w, h, w * 0.5, h * 1.02, w * 0.95, h * (0.22 if portrait else 0.35), accent, 0.42),
              radial(w, h, w * 0.5, h * 1.0, w * 0.45, h * (0.10 if portrait else 0.18), (255, 190, 90), 0.20),
              radial(w, h, w * 0.78, h * (0.06 if portrait else 0.12), w * 0.35, w * 0.35, moon_glow, 0.18)]:
        base = base * (1 - g[..., 3:]) + g[..., :3] * g[..., 3:]
    # gentle vignette on the sides
    xx = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - 0.18 * xx ** 4
    # a whisper of dither so the dark gradient never bands on phones
    base += np.random.default_rng(seed).uniform(-1.2, 1.2, base.shape[:2])[..., None]
    im = Image.fromarray(base.clip(0, 255).round().astype(np.uint8), 'RGB').convert('RGBA')
    # sparse star field, top 45 % only, tiny and dim
    stars = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(stars)
    for _ in range(int(w * h / 26000 * star_density)):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.45) ** 1.3
        r = rnd.choice([1.2, 1.5, 1.8, 2.4])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 240, 220, int(rnd.uniform(40, 120) * (1 - y / (h * 0.5)))))
    im.alpha_composite(stars.filter(ImageFilter.GaussianBlur(0.6)))
    # props: margins only. unit = the short side
    u = min(w, h)
    if portrait:
        slots = [  # (cx, cy, width, alpha, blur)
            (w * 0.83, h * 0.065, u * 0.14, 0.58, 0),     # moon, top right
            (w * 0.14, h * 0.05, u * 0.11, 0.42, 0.8),    # top left flyer
            (w * 0.40, h * 0.035, u * 0.06, 0.30, 1.4),   # far tiny flyer
            (w * 0.08, h * 0.93, u * 0.12, 0.38, 0),      # bottom left corner, half off the edge
            (w * 0.93, h * 0.955, u * 0.10, 0.34, 0.6),   # bottom right corner
            (w * 0.62, h * 0.03, u * 0.07, 0.38, 0),      # top middle-right, small
        ]
    else:
        slots = [
            (w * 0.90, h * 0.12, u * 0.14, 0.58, 0),
            (w * 0.06, h * 0.12, u * 0.11, 0.42, 0.8),
            (w * 0.22, h * 0.06, u * 0.06, 0.30, 1.4),
            (w * 0.04, h * 0.88, u * 0.12, 0.38, 0),
            (w * 0.96, h * 0.90, u * 0.10, 0.34, 0.6),
            (w * 0.75, h * 0.05, u * 0.07, 0.38, 0),
        ]
    for name, (cx, cy, pw, a, bl) in zip(names, slots):
        place(im, prop(name, props_dir), cx, cy, pw, a, bl, rot=rnd.uniform(-8, 8) if 'moon' not in name else 0, tint=tint)
    return im.convert('RGB')


# Light-mode twins (season preview 10-05): the same layout at dusk — pale lavender top, blush middle, a peach
# horizon — so text that sits right on the wall stays dark-on-light. The apps draw wall-<page>-light in light
# mode and the night wall in dark mode (SeasonKit wall lookup: "<name>-light" first in light mode).
LIGHT_SKY = ((238, 230, 252), (248, 236, 246), (255, 226, 200))
LIGHT_TINT = (236, 224, 246)


if __name__ == '__main__':
    for page in PAGES:
        for size, suffix in ((PORTRAIT, ''), (WIDE, '-wide')):
            out = os.path.join(HERE, f'wall-{page}{suffix}.webp')
            wallpaper(size, page).save(out, 'WEBP', quality=92, method=6)
            print(out)
            out = os.path.join(HERE, f'wall-{page}-light{suffix}.webp')
            wallpaper(size, page, sky=LIGHT_SKY, tint=LIGHT_TINT, star_density=0.0,
                      moon_glow=(200, 170, 255)).save(out, 'WEBP', quality=92, method=6)
            print(out)
