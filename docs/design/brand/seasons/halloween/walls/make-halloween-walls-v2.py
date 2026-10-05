#!/usr/bin/env python3
"""Halloween wallpapers v2: three directions that read as spooky season within one second.

Founder feedback (10-05) on v1: "doesn't look halloweeny at all"; the light-mode lavender reads as no change.
Every direction is CODE-DRAWN at full resolution (PIL + numpy, never an upscale) and keeps the middle of the
screen calm. Cards, boards and keyboards are opaque, so the walls are bold in the top band, the bottom band,
the side margins and the gaps between cards.

  1 midnight  night sky in BOTH modes: big harvest moon, bats up top, a near-black skyline (hill, crooked
              trees, haunted house, graveyard fence) on an orange glow, low mist.        wallTone: dark
  2 dusk      pumpkin dusk: a clearly orange sky, black bats up top, a black pumpkin-patch / fence / tree
              band along the bottom with glowing carved faces, a pale moon.             wallTone: light
  3 candy     candy-corn gift wrap: soft orange ground, a sparse muted tile of bats, pumpkins, candy corn
              and stars, a darker vignette.                                               wallTone: light

  python3 make-halloween-walls-v2.py [outdir] [direction ...]
  -> <outdir>/<direction>/wall-<page>[-light][-wide].webp  (1290 x 2796 portrait, 2400 x 1500 wide)
Default outdir: ./v2. SHIPPED (10-05, founder pick): midnight -> ../walls/wall-<page>[-wide].webp, no -light twins:
  python3 make-halloween-walls-v2.py /tmp/v2 midnight && cp /tmp/v2/midnight/*.webp . Same naming as v1, so a direction can drop straight into the art pipeline.
"""
import hashlib, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PROPS = os.path.join(HERE, '..', 'props')
PORTRAIT = (1290, 2796)
WIDE = (2400, 1500)
PAGES = ['home', 'games', 'stats', 'friends', 'leaderboard']
SS = 2  # silhouettes are drawn at 2x and downsampled (clean edges at full resolution)

# per page: accent glow + the hero silhouette that sits on the skyline / in the pattern mix
ACCENT = {
    'home':        (255, 128, 30),
    'games':       (255, 104, 20),
    'stats':       (255, 150, 50),
    'friends':     (255, 112, 70),
    'leaderboard': (255, 172, 40),
}
HERO = {'home': 'house', 'games': 'pumpkins', 'stats': 'owl', 'friends': 'ghost', 'leaderboard': 'graves'}


# ---------- helpers ----------
def seed_of(*parts):
    return int(hashlib.md5('-'.join(map(str, parts)).encode()).hexdigest()[:8], 16)


def prop_alpha(name):
    im = Image.open(os.path.join(PROPS, name + '.png')).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    return im


def vgrad(h, w, stops):
    """stops: [(t, (r,g,b)), ...] top->bottom"""
    t = np.linspace(0, 1, h, dtype=np.float32)
    ts = np.array([s[0] for s in stops], np.float32)
    cols = np.array([s[1] for s in stops], np.float32)
    rows = np.stack([np.interp(t, ts, cols[:, c]) for c in range(3)], 1)
    return np.repeat(rows[:, None, :], w, axis=1)


def glow(base, cx, cy, rx, ry, color, strength, power=1.6):
    h, w = base.shape[:2]
    yy, xx = np.ogrid[0:h, 0:w]
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    a = (np.exp(-d * power) * strength).astype(np.float32)[..., None]
    return base * (1 - a) + np.array(color, np.float32) * a


def over(base, rgb, alpha):
    a = alpha[..., None] if alpha.ndim == 2 else alpha
    return base * (1 - a) + np.asarray(rgb, np.float32) * a


def finish(base, seed):
    base = base + np.random.default_rng(seed).uniform(-1.2, 1.2, base.shape[:2])[..., None]  # anti-banding
    return Image.fromarray(base.clip(0, 255).round().astype(np.uint8), 'RGB')


def mask_layer(w, h):
    m = Image.new('L', (w * SS, h * SS), 0)
    return m, ImageDraw.Draw(m)


def down(m, w, h):
    return np.asarray(m.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255


def stamp(mask, im, cx, cy, width, rot=0.0, flip=False, alpha=1.0):
    """paste a prop's alpha as silhouette into an SS-scale L mask"""
    a = im.getchannel('A')
    k = width * SS / a.width
    a = a.resize((max(1, round(a.width * k)), max(1, round(a.height * k))), Image.LANCZOS)
    if flip:
        a = a.transpose(Image.FLIP_LEFT_RIGHT)
    if rot:
        a = a.rotate(rot, Image.BICUBIC, expand=True)
    if alpha < 1:
        a = a.point(lambda v: int(v * alpha))
    x, y = round(cx * SS - a.width / 2), round(cy * SS - a.height / 2)
    mask.paste(255, (x, y), a) if alpha >= 1 else mask.paste(Image.new('L', a.size, int(255 * alpha)), (x, y), a)


# ---------- silhouettes ----------
def tree(d, x, y, height, rnd, lean=0.0):
    """crooked bare tree, drawn at SS scale into an L draw"""
    def branch(x0, y0, ang, length, width, depth):
        x1 = x0 + math.cos(ang) * length
        y1 = y0 - math.sin(ang) * length
        mx = (x0 + x1) / 2 + rnd.uniform(-0.12, 0.12) * length
        my = (y0 + y1) / 2 + rnd.uniform(-0.08, 0.08) * length
        for (ax, ay, bx, by) in ((x0, y0, mx, my), (mx, my, x1, y1)):
            d.line([(ax * SS, ay * SS), (bx * SS, by * SS)], fill=255, width=max(1, round(width * SS)))
            r = width * SS / 2
            d.ellipse([bx * SS - r, by * SS - r, bx * SS + r, by * SS + r], fill=255)
        if depth == 0 or length < 10:
            return
        n = rnd.choice([2, 2, 3])
        for i in range(n):
            spread = rnd.uniform(0.35, 0.75)
            a2 = ang + (i - (n - 1) / 2) * spread + rnd.uniform(-0.25, 0.25)
            branch(x1, y1, a2, length * rnd.uniform(0.58, 0.78), width * 0.62, depth - 1)
    # trunk with a flared base
    tw = height * 0.075
    d.polygon([((x - tw * 1.6) * SS, y * SS), ((x + tw * 1.6) * SS, y * SS),
               ((x + tw * 0.5) * SS, (y - height * 0.12) * SS), ((x - tw * 0.5) * SS, (y - height * 0.12) * SS)], fill=255)
    branch(x, y - height * 0.02, math.pi / 2 + lean, height * 0.42, tw, 5)


def house(d, glowd, x, y, s, rnd):
    """little haunted house (base centered at x, ground y). Windows lit into glowd."""
    S = lambda px, py: (px * SS, py * SS)
    bw, bh = 150 * s, 100 * s
    L, R, T = x - bw / 2, x + bw / 2, y - bh
    d.rectangle([*S(L, T), *S(R, y)], fill=255)
    d.polygon([S(L - 14 * s, T), S(R + 14 * s, T), S(x + 8 * s, T - 70 * s)], fill=255)          # crooked gable
    tx = L + 18 * s                                                                               # tower
    d.rectangle([*S(tx - 22 * s, T - 70 * s), *S(tx + 22 * s, y)], fill=255)
    d.polygon([S(tx - 32 * s, T - 70 * s), S(tx + 32 * s, T - 70 * s), S(tx + 6 * s, T - 150 * s)], fill=255)
    d.rectangle([*S(R - 34 * s, T - 62 * s), *S(R - 20 * s, T - 20 * s)], fill=255)              # chimney
    d.line([S(tx + 6 * s, T - 150 * s), S(tx + 10 * s, T - 172 * s)], fill=255, width=round(3 * s * SS))
    wins = [(tx, T - 40 * s, 9, 13), (x - 10 * s, T + 30 * s, 13, 15), (x + 40 * s, T + 30 * s, 13, 15),
            (x + 15 * s, T - 25 * s, 9, 9), (x + 40 * s, y - 28 * s, 10, 28)]
    for (wx, wy, ww, wh) in wins:
        if rnd.random() < 0.85:
            glowd.rectangle([*S(wx - ww * s / 2, wy - wh * s / 2), *S(wx + ww * s / 2, wy + wh * s / 2)], fill=255)


def fence(d, x0, x1, y, s, spike=True):
    p = 22 * s
    hgt = 46 * s
    d.rectangle([x0 * SS, (y - hgt * 0.75) * SS, x1 * SS, (y - hgt * 0.68) * SS], fill=255)
    d.rectangle([x0 * SS, (y - hgt * 0.3) * SS, x1 * SS, (y - hgt * 0.23) * SS], fill=255)
    xx = x0
    while xx < x1:
        w2 = 3.2 * s
        d.rectangle([(xx - w2) * SS, (y - hgt) * SS, (xx + w2) * SS, y * SS], fill=255)
        if spike:
            d.polygon([((xx - 7 * s) * SS, (y - hgt) * SS), ((xx + 7 * s) * SS, (y - hgt) * SS), (xx * SS, (y - hgt - 14 * s) * SS)], fill=255)
        xx += p


def grave(d, x, y, s, kind):
    S = lambda px, py: (px * SS, py * SS)
    if kind == 0:
        d.rounded_rectangle([*S(x - 22 * s, y - 56 * s), *S(x + 22 * s, y + 4)], radius=round(20 * s * SS), fill=255)
    elif kind == 1:
        d.rectangle([*S(x - 5 * s, y - 64 * s), *S(x + 5 * s, y)], fill=255)
        d.rectangle([*S(x - 19 * s, y - 50 * s), *S(x + 19 * s, y - 40 * s)], fill=255)
    else:
        d.polygon([S(x - 18 * s, y), S(x - 16 * s, y - 40 * s), S(x, y - 52 * s), S(x + 16 * s, y - 40 * s), S(x + 18 * s, y)], fill=255)


def pumpkin(d, glowd, x, y, r, rnd, face=True):
    """black pumpkin silhouette resting on ground y; carved face into glowd"""
    S = lambda px, py: (px * SS, py * SS)
    cy = y - r * 0.82
    for dx, rx in ((-0.42, 0.62), (0.42, 0.62), (0, 0.66)):
        d.ellipse([*S(x + dx * r - rx * r, cy - 0.82 * r), *S(x + dx * r + rx * r, cy + 0.82 * r)], fill=255)
    d.polygon([S(x - 0.08 * r, cy - 0.7 * r), S(x + 0.1 * r, cy - 0.7 * r), S(x + 0.2 * r, cy - 1.05 * r), S(x + 0.06 * r, cy - 1.08 * r)], fill=255)
    if face:
        e = 0.2 * r
        for sx in (-1, 1):
            ex = x + sx * 0.32 * r
            glowd.polygon([S(ex - e, cy - 0.05 * r), S(ex + e, cy - 0.05 * r), S(ex, cy - 0.38 * r)], fill=255)
        mouth = [S(x - 0.5 * r, cy + 0.18 * r)]
        n = 5
        for i in range(n + 1):
            mx = x - 0.5 * r + i * (r / n)
            mouth.append(S(mx, cy + (0.18 if i % 2 == 0 else 0.3) * r))
        mouth += [S(x + 0.5 * r, cy + 0.18 * r), S(x + 0.32 * r, cy + 0.48 * r), S(x - 0.32 * r, cy + 0.48 * r)]
        glowd.polygon(mouth, fill=255)


def hill_y(w, h, base, amp, seed, phase=0.0):
    rnd = random.Random(seed)
    xs = np.arange(w, dtype=np.float32)
    y = np.full(w, base, np.float32)
    for k, a in ((1.0, 1.0), (2.3, 0.45), (5.1, 0.18)):
        y -= amp * a * np.sin(xs / w * math.pi * k + rnd.uniform(0, 6.28) + phase)
    return y


def fill_below(d, ys):
    w = len(ys)
    pts = [(0, ys[0] * SS)] + [(x * SS, ys[x] * SS) for x in range(0, w, 4)] + [((w - 1) * SS, ys[-1] * SS)]
    d.polygon(pts + [((w - 1) * SS, 99999), (0, 99999)], fill=255)


def bats(mask, w, h, rnd, portrait, n, band, scale, avoid=None):
    """drifting bats in a top band; avoid = list of (x0,y0,x1,y1) boxes (fractions)"""
    flyers = [prop_alpha('bat-flying'), prop_alpha('bat')]
    placed = 0
    tries = 0
    while placed < n and tries < 400:
        tries += 1
        fx, fy = rnd.uniform(0.04, 0.96), rnd.uniform(*band)
        if avoid and any(a[0] < fx < a[2] and a[1] < fy < a[3] for a in avoid):
            continue
        size = scale * rnd.uniform(0.45, 1.0)
        stamp(mask, flyers[placed % 2], fx * w, fy * h, size, rot=rnd.uniform(-18, 18), flip=rnd.random() < 0.5)
        placed += 1


def moon_disc(base, cx, cy, r, col, shade, rnd):
    """a lit moon with soft craters"""
    h, w = base.shape[:2]
    yy, xx = np.ogrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(r + 0.8 - dist, 0, 1).astype(np.float32)
    # limb darkening toward the lower left
    lim = np.clip(((xx - cx) * -0.5 + (yy - cy) * 0.7) / r, 0, 1).astype(np.float32)
    disc = np.array(col, np.float32) * (1 - 0.18 * lim[..., None]) + np.zeros_like(base)
    for _ in range(7):
        ang, rr = rnd.uniform(0, 6.28), rnd.uniform(0.1, 0.7) * r
        ccx, ccy, cr = cx + math.cos(ang) * rr, cy + math.sin(ang) * rr, rnd.uniform(0.07, 0.18) * r
        cd = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
        ca = (np.clip(1 - cd / cr, 0, 1) ** 0.6 * 0.22).astype(np.float32)[..., None]
        disc = disc * (1 - ca) + np.array(shade, np.float32) * ca
    return over(base, disc, a)


# ---------- direction 1: midnight everywhere ----------
def midnight(size, page, dark=True):
    w, h = size
    seed = seed_of('midnight', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290 * (1.0 if portrait else 1.25)
    acc = ACCENT[page]
    base = vgrad(h, w, [(0, (12, 7, 28)), (0.45, (30, 13, 50)), (0.75, (52, 20, 52)), (1, (70, 26, 40))])
    horizon = h * (0.815 if portrait else 0.80)
    base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), acc, 0.85)
    base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), (255, 196, 110), 0.55)
    # stars, top half only
    st = Image.new('L', (w, h), 0)
    sd = ImageDraw.Draw(st)
    for _ in range(int(w * h / 9000)):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.62) ** 1.5
        r = rnd.choice([1.3, 1.6, 2.0, 2.6])
        sd.ellipse([x - r, y - r, x + r, y + r], fill=int(rnd.uniform(60, 210) * (1 - y / (h * 0.66))))
    base = over(base, (255, 244, 225), np.asarray(st.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255)
    # big harvest moon, top right, with a wide warm halo
    mx, my, mr = (w * 0.74, h * 0.072, 118 * s) if portrait else (w * 0.85, h * 0.17, 120 * s)
    base = glow(base, mx, my, mr * 4.2, mr * 4.2, (255, 150, 60), 0.42, 1.2)
    base = glow(base, mx, my, mr * 1.9, mr * 1.9, (255, 205, 130), 0.55, 1.4)
    base = moon_disc(base, mx, my, mr, (255, 214, 140), (226, 150, 80), rnd)
    # skyline silhouette
    m, d = mask_layer(w, h)
    g, gd = mask_layer(w, h)
    ys = hill_y(w, h, horizon + 40 * s, 34 * s, seed)
    fill_below(d, ys)
    ys2 = hill_y(w, h, horizon + 110 * s, 22 * s, seed + 1, 1.3)
    fill_below(d, ys2)
    gy = lambda fx: float(ys[min(w - 1, max(0, int(fx * w)))])
    # crooked trees at the outer edges (they reach up the side margins), mirrored for symmetry
    tree(d, w * 0.06, gy(0.06) + 10 * s, 600 * s, rnd, lean=0.18)
    tree(d, w * 0.94, gy(0.94) + 10 * s, 560 * s, rnd, lean=-0.18)
    if not portrait:
        tree(d, w * 0.20, gy(0.20) + 10 * s, 300 * s, rnd, lean=0.1)
        tree(d, w * 0.80, gy(0.80) + 10 * s, 320 * s, rnd, lean=-0.1)
    hero = HERO[page]
    hx = 0.62 if portrait else 0.64
    if hero == 'house':
        house(d, gd, w * hx, gy(hx) + 6 * s, s * 1.15, rnd)
    elif hero == 'pumpkins':
        for fx, r in ((0.55, 42), (0.63, 30), (0.70, 36), (0.40, 26)):
            pumpkin(d, gd, w * fx, gy(fx) + 8 * s, r * s, rnd)
    elif hero == 'owl':
        stamp(m, prop_alpha('owl'), w * 0.90, gy(0.94) - 330 * s, 120 * s)
        house(d, gd, w * hx, gy(hx) + 6 * s, s * 0.9, rnd)
    elif hero == 'ghost':
        house(d, gd, w * hx, gy(hx) + 6 * s, s * 0.9, rnd)
    else:
        for i, fx in enumerate((0.48, 0.56, 0.64, 0.72)):
            grave(d, w * fx, gy(fx) + 8 * s, s * 1.1, i % 3)
    # graveyard fence along the near hill
    fence(d, w * 0.18, w * (0.46 if hero != 'graves' else 0.40), gy(0.32) + 14 * s, s)
    if not portrait:
        fence(d, w * 0.72, w * 0.84, gy(0.78) + 14 * s, s)
        for i, fx in enumerate((0.30, 0.34, 0.38)):
            grave(d, w * fx, gy(fx) + 10 * s, s * 0.9, i % 3)
    sil = down(m, w, h)
    lit = down(g, w, h)
    # bats in the top band (kept off the stats row and the cast header lettering center)
    bm, _ = mask_layer(w, h)
    band = (0.035, 0.125) if portrait else (0.05, 0.30)
    bats(bm, w, h, rnd, portrait, 7 if portrait else 9, band, 120 * s,
         avoid=[(0.0, 0.08, 0.30, 0.125), (0.78, 0.08, 1.0, 0.125), (0.30, 0.0, 0.70, 0.045)] if portrait else None)
    batm = down(bm, w, h)
    # mist: soft horizontal band hugging the hills (behind the near silhouette)
    mist = np.zeros((h, w), np.float32)
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    for k in range(3):
        cy0 = horizon + (k * 36 - 20) * s
        wav = np.sin(xx / w * math.pi * (2 + k) + k) * 14 * s
        mist += np.exp(-((yy - cy0 - wav) / (26 * s)) ** 2) * (0.20 - k * 0.04)
    base = over(base, (210, 170, 220), np.clip(mist, 0, 0.4))
    ink = (13, 6, 20)
    base = over(base, ink, sil)
    base = over(base, ink, batm * 0.92)
    # lit windows / carved faces glow
    halo = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10 * s))).astype(np.float32) / 255
    base = over(base, (255, 150, 40), np.clip(halo * 1.4, 0, 0.6) * sil)
    base = over(base, (255, 196, 90), lit)
    # front mist over the hill foot
    mist2 = np.exp(-((yy - (horizon + 40 * s)) / (40 * s)) ** 2) * 0.10
    base = over(base, (190, 150, 210), mist2 * np.ones((1, w), np.float32))
    xx1 = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - 0.16 * xx1 ** 4
    return finish(base, seed)


# ---------- direction 2: pumpkin dusk ----------
def dusk(size, page, dark=False):
    w, h = size
    seed = seed_of('dusk', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290 * (1.0 if portrait else 1.25)
    acc = ACCENT[page]
    if not dark:
        stops = [(0, (255, 196, 128)), (0.30, (255, 178, 104)), (0.62, (250, 146, 86)), (0.82, (214, 98, 92)), (1, (122, 44, 86))]
    else:
        stops = [(0, (38, 16, 40)), (0.35, (62, 22, 48)), (0.65, (110, 40, 46)), (0.85, (168, 70, 40)), (1, (92, 30, 52))]
    base = vgrad(h, w, stops)
    horizon = h * (0.815 if portrait else 0.80)
    base = glow(base, w * 0.5, horizon, w * 0.8, h * (0.10 if portrait else 0.2), (255, 200, 120) if not dark else acc, 0.55)
    # pale moon, top right, smaller than midnight's
    mx, my, mr = (w * 0.73, h * 0.07, 84 * s) if portrait else (w * 0.86, h * 0.17, 90 * s)
    base = glow(base, mx, my, mr * 2.6, mr * 2.6, (255, 236, 200), 0.5 if not dark else 0.35, 1.3)
    base = moon_disc(base, mx, my, mr, (255, 244, 220) if not dark else (255, 222, 160), (240, 206, 170) if not dark else (220, 160, 100), rnd)
    # bats across the top band
    bm, _ = mask_layer(w, h)
    band = (0.035, 0.125) if portrait else (0.04, 0.30)
    bats(bm, w, h, rnd, portrait, 9 if portrait else 11, band, 110 * s,
         avoid=[(0.0, 0.08, 0.30, 0.125), (0.78, 0.08, 1.0, 0.125), (0.0, 0.0, 0.30, 0.045), (0.70, 0.0, 1.0, 0.045)] if portrait else None)
    batm = down(bm, w, h)
    # bottom band: black pumpkin patch, fence, a bare tree each side
    m, d = mask_layer(w, h)
    g, gd = mask_layer(w, h)
    ys = hill_y(w, h, horizon + 30 * s, 16 * s, seed)
    fill_below(d, ys)
    gy = lambda fx: float(ys[min(w - 1, max(0, int(fx * w)))])
    tree(d, w * 0.05, gy(0.05) + 10 * s, 460 * s, rnd, lean=0.2)
    tree(d, w * 0.95, gy(0.95) + 10 * s, 440 * s, rnd, lean=-0.2)
    fence(d, w * 0.10, w * 0.90, gy(0.5) + 4 * s, s * 0.95, spike=False)
    patch = [(0.18, 40), (0.29, 30), (0.42, 46), (0.55, 34), (0.68, 44), (0.80, 30)]
    if not portrait:
        patch = [(fx, r) for fx, r in patch] + [(0.33, 26), (0.62, 26)]
    for fx, r in patch:
        pumpkin(d, gd, w * fx, gy(fx) + 22 * s, r * s * (1.1 if HERO[page] == 'pumpkins' else 1.0), rnd, face=rnd.random() < 0.7)
    if HERO[page] == 'owl':
        stamp(m, prop_alpha('owl'), w * 0.93, gy(0.95) - 300 * s, 100 * s)
    elif HERO[page] == 'graves':
        for i, fx in enumerate((0.36, 0.48, 0.61)):
            grave(d, w * fx, gy(fx) - 26 * s, s * 0.9, i % 3)
    elif HERO[page] == 'ghost':
        stamp(m, prop_alpha('ghost'), w * 0.5, gy(0.5) - 100 * s, 90 * s, alpha=1.0)
    elif HERO[page] == 'house':
        stamp(m, prop_alpha('black-cat'), w * 0.5, gy(0.5) - 70 * s, 70 * s)
    sil = down(m, w, h)
    lit = down(g, w, h)
    ink = (22, 8, 18)
    base = over(base, ink, batm * 0.95)
    base = over(base, ink, sil)
    halo = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8 * s))).astype(np.float32) / 255
    base = over(base, (255, 140, 30), np.clip(halo * 1.5, 0, 0.7) * sil)
    base = over(base, (255, 190, 70), lit)
    xx1 = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - 0.10 * xx1 ** 4
    return finish(base, seed)


# ---------- direction 3: candy-corn gift wrap ----------
def candy_corn(d, x, y, sz, rot, tones):
    """three-band candy corn (SS scale) into three separate draws (one per tone)"""
    pts = [(-0.5, 0.45), (0.5, 0.45), (0.0, -0.6)]
    def tf(px, py):
        c, s_ = math.cos(rot), math.sin(rot)
        return ((x + (px * c - py * s_) * sz) * SS, (y + (px * s_ + py * c) * sz) * SS)
    # bands: base (bottom third), middle, tip
    d[0].polygon([tf(-0.5, 0.45), tf(0.5, 0.45), tf(0.38, 0.12), tf(-0.38, 0.12)], fill=255)
    d[1].polygon([tf(-0.38, 0.12), tf(0.38, 0.12), tf(0.2, -0.28), tf(-0.2, -0.28)], fill=255)
    d[2].polygon([tf(-0.2, -0.28), tf(0.2, -0.28), tf(0.0, -0.6)], fill=255)


def star_poly(d, x, y, r, rot):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.45
        a = rot + i * math.pi / 5 - math.pi / 2
        pts.append(((x + math.cos(a) * rr) * SS, (y + math.sin(a) * rr) * SS))
    d.polygon(pts, fill=255)


def candy(size, page, dark=False):
    w, h = size
    seed = seed_of('candy', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290
    hue = {'home': 0, 'games': -8, 'stats': 8, 'friends': -14, 'leaderboard': 14}[page]
    if not dark:
        ground = np.array((252, 178 + hue * 0.6, 110 + hue), np.float32)
        center = np.array((255, 206 + hue * 0.4, 150 + hue), np.float32)
        edge = (176, 74, 58)
    else:
        ground = np.array((52, 24, 36), np.float32)
        center = np.array((70, 32, 44), np.float32)
        edge = (14, 6, 12)
    base = np.zeros((h, w, 3), np.float32) + ground
    base = glow(base, w * 0.5, h * 0.45, w * 0.8, h * 0.5, center, 0.8, 1.2)
    # tile pattern: offset grid, one motif per cell, jittered
    cell = 190 * s if portrait else 210 * s
    m_dark, dd = mask_layer(w, h)
    m_c = [mask_layer(w, h) for _ in range(3)]
    motifs_by_page = {
        'home': ['bat', 'pumpkin', 'corn', 'star'], 'games': ['corn', 'pumpkin', 'bat', 'corn'],
        'stats': ['star', 'bat', 'corn', 'moon'], 'friends': ['ghost', 'corn', 'bat', 'star'],
        'leaderboard': ['star', 'corn', 'pumpkin', 'bat']}
    mix = motifs_by_page[page]
    batp, pump, ghost, moon = prop_alpha('bat-flying'), prop_alpha('pumpkin'), prop_alpha('ghost'), prop_alpha('moon-crescent')
    rows = int(h / cell) + 2
    cols = int(w / cell) + 2
    k = 0
    for r in range(rows):
        for c in range(cols):
            cx = (c + (0.5 if r % 2 else 0)) * cell + rnd.uniform(-0.12, 0.12) * cell
            cy = r * cell * 0.92 + rnd.uniform(-0.12, 0.12) * cell
            kind = mix[(r * 3 + c) % len(mix)]
            rot = rnd.uniform(-22, 22)
            sz = cell * 0.36
            if kind == 'corn':
                candy_corn([m[1] for m in m_c], cx, cy, sz * 0.95, math.radians(rot), None)
            elif kind == 'star':
                star_poly(dd, cx, cy, sz * 0.36, math.radians(rot))
            elif kind == 'bat':
                stamp(m_dark, batp, cx, cy, sz * 1.25, rot=rot, flip=rnd.random() < 0.5)
            elif kind == 'pumpkin':
                stamp(m_dark, pump, cx, cy, sz * 0.9, rot=rot * 0.4)
            elif kind == 'ghost':
                stamp(m_dark, ghost, cx, cy, sz * 0.95, rot=rot * 0.4)
            else:
                stamp(m_dark, moon, cx, cy, sz * 0.8, rot=rot)
            k += 1
    md = down(m_dark, w, h)
    mc = [down(m[0], w, h) for m in m_c]
    if not dark:
        tone = ground * 0.80                         # tone-on-tone motifs, muted
        base = over(base, tone, md * 0.42)
        base = over(base, (255, 246, 226), mc[0] * 0.55)  # candy corn: cream base band
        base = over(base, (236, 120, 56), mc[1] * 0.45)   # orange middle
        base = over(base, (255, 222, 140), mc[2] * 0.55)  # yellow tip
    else:
        base = over(base, (255, 140, 60), md * 0.16)
        base = over(base, (255, 240, 220), mc[0] * 0.22)
        base = over(base, (240, 120, 50), mc[1] * 0.28)
        base = over(base, (255, 210, 120), mc[2] * 0.24)
    # darker vignette at the edges (stronger at the corners and the bottom)
    yy = np.linspace(-1, 1, h, dtype=np.float32)[:, None]
    xx = np.linspace(-1, 1, w, dtype=np.float32)[None, :]
    r2 = (xx ** 2) * 0.9 + (yy ** 2) * (1.0 if portrait else 0.8)
    v = np.clip((r2 - 0.45) / 1.0, 0, 1) ** 1.4 * (0.62 if not dark else 0.7)
    base = over(base, edge, v)
    return finish(base, seed)


DIRECTIONS = {'midnight': midnight, 'dusk': dusk, 'candy': candy}


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'v2')
    which = sys.argv[2:] or list(DIRECTIONS)
    for name in which:
        fn = DIRECTIONS[name]
        os.makedirs(os.path.join(out, name), exist_ok=True)
        for page in PAGES:
            for size, suf in ((PORTRAIT, ''), (WIDE, '-wide')):
                # light-mode wall (wall-<page>-light) and dark-mode wall (wall-<page>). Midnight is the same
                # night sky in both modes, so it writes no -light twin: iOS / Android / web fall back to the
                # base wall in light mode (SeasonKit.wall / seasonalWall), which keeps the bundles lean.
                if name != 'midnight':
                    fn(size, page, dark=False).save(
                        os.path.join(out, name, f'wall-{page}-light{suf}.webp'), 'WEBP', quality=92, method=6)
                fn(size, page, dark=True).save(os.path.join(out, name, f'wall-{page}{suf}.webp'), 'WEBP', quality=92, method=6)
                print(name, page, suf or 'portrait')
