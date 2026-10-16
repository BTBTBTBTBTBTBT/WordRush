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

  Time of day (10-16): midnight(size, page, tod='night'|'morning'|'day'|'evening'); night is the shipped wall, byte-identical.
  ../../time-of-day/render-walls.py halloween [page] [tod ...] renders the four.

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
def tree(d, x, y, height, rnd, lean=0.0, tips=None):
    """crooked bare tree, drawn at SS scale into an L draw. tips = optional list that collects (x, y, depth, length)
    of every branch end (the day walls hang orange leaf clumps there); it never touches the random stream."""
    def branch(x0, y0, ang, length, width, depth):
        x1 = x0 + math.cos(ang) * length
        y1 = y0 - math.sin(ang) * length
        mx = (x0 + x1) / 2 + rnd.uniform(-0.12, 0.12) * length
        my = (y0 + y1) / 2 + rnd.uniform(-0.08, 0.08) * length
        for (ax, ay, bx, by) in ((x0, y0, mx, my), (mx, my, x1, y1)):
            d.line([(ax * SS, ay * SS), (bx * SS, by * SS)], fill=255, width=max(1, round(width * SS)))
            r = width * SS / 2
            d.ellipse([bx * SS - r, by * SS - r, bx * SS + r, by * SS + r], fill=255)
        if tips is not None:
            tips.append((x1, y1, depth, length))
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


# ---------- time of day (founder 10-16: "more distinction ... matching to the wallpapers coordinating with the time of day") ----------
# 'night' is the shipped midnight wall and stays BYTE-IDENTICAL (bats painted in, as shipped). The other three keep the
# SAME scene (same random stream: trees, house, fence, graves never move) and swap sky, sun, light, haze, silhouette ink,
# hill colors, windows and a little seasonal dressing, exactly like ../../thanksgiving/walls/make-thanksgiving-walls-v2.py.
# The time walls paint NO bats (the flyers are an ambient layer in the app); the orange leaf clumps (day) and the small
# pumpkin patch (all three) come from their own random streams, after everything else.
#   MORNING  misty lavender-peach dawn: low pale sun at the left, a faded ghost-moon still up, thick fog through the
#            graveyard and hills, dusty-plum silhouettes, every window dark.
#   DAY      crisp autumn blue sky, bright sun, cumulus, VIVID ORANGE leaf clumps on the crooked trees, straw + lime hills,
#            bright orange pumpkins. No stars, no moon, no glow.
#   EVENING  a huge sun sinking behind the haunted house, indigo -> magenta -> hot orange sky, near-black silhouettes,
#            windows lit, jack-o'-lanterns just lit, a few early stars.
TOD = {
    'morning': dict(
        sky=[(0, (118, 108, 176)), (0.30, (158, 138, 196)), (0.55, (210, 174, 206)), (0.74, (246, 200, 192)), (0.88, (252, 216, 172)), (1, (244, 206, 164))],
        horizon=((255, 214, 176), 0.78), horizon2=((255, 240, 208), 0.5),
        sun=dict(pos_p=(0.27, 0.768), pos_w=(0.22, 0.75), r=92, col=(255, 236, 184), core=(255, 250, 224),
                 halo1=((255, 190, 120), 0.62, 4.6), halo2=((255, 224, 170), 0.72, 2.0), haze=0.6),
        ghost_moon=((238, 228, 244), 0.42),
        clouds='wisps', stars=0,
        ink=(86, 62, 100), hill_far=(184, 156, 188), hill_near=(128, 100, 136),
        windows=0.0, mist=((236, 224, 240), 1.9), mist2=((238, 226, 238), 0.30), fog_front=((238, 228, 242), 0.55),
        veil=None, vignette=0.10, patch='morning'),
    'day': dict(
        sky=[(0, (36, 108, 212)), (0.45, (100, 170, 238)), (0.75, (176, 214, 246)), (1, (214, 232, 246))],
        horizon=((236, 240, 226), 0.5), horizon2=((255, 250, 232), 0.35),
        sun=dict(pos_p=(0.74, 0.072), pos_w=(0.85, 0.17), r=88, col=(255, 252, 236), core=None,
                 halo1=((255, 246, 200), 0.5, 4.0), halo2=((255, 255, 240), 0.7, 1.8), haze=0.0),
        ghost_moon=None,
        clouds='cumulus', stars=0,
        ink=(64, 36, 70), hill_far=(212, 168, 70), hill_near=(116, 162, 54),
        windows=0.0, mist=((240, 238, 224), 0.35), mist2=((240, 234, 214), 0.06), fog_front=None,
        veil=None, vignette=0.08, patch='day'),
    'evening': dict(
        sky=[(0, (34, 20, 84)), (0.28, (88, 34, 122)), (0.50, (176, 44, 120)), (0.68, (238, 84, 86)), (0.82, (255, 140, 50)), (1, (255, 192, 86))],
        horizon=((255, 160, 40), 0.9), horizon2=((255, 224, 130), 0.65),
        sun=dict(pos_p=(0.60, 0.788), pos_w=(0.64, 0.79), r=132, col=(255, 214, 122), core=(255, 242, 176),
                 halo1=((255, 104, 52), 0.62, 4.6), halo2=((255, 180, 90), 0.72, 2.0), haze=0.0),
        ghost_moon=None,
        clouds='streaks', stars=0.5,
        ink=(22, 8, 30), hill_far=(96, 28, 72), hill_near=(44, 16, 48),
        windows=1.0, mist=((255, 168, 128), 0.9), mist2=((255, 150, 110), 0.14), fog_front=((255, 150, 110), 0.16),
        veil=((255, 140, 60), 0.30), vignette=0.18, patch='evening'),
}


def S2(px, py):
    return (px * SS, py * SS)


def sun_disc(base, cx, cy, r, col, core=None):
    """a plain sun disc with a soft limb; 'core' = brighter center so a low hazy sun reads as a solid ball"""
    h, w = base.shape[:2]
    yy, xx = np.ogrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip((r + 1.5 - dist) / 3, 0, 1).astype(np.float32)
    if core is None:
        return over(base, col, a)
    t = np.clip(dist / r, 0, 1).astype(np.float32)[..., None] ** 1.6
    disc = np.array(core, np.float32) * (1 - t) + np.array(col, np.float32) * t
    return base * (1 - a[..., None]) + disc * a[..., None]


def clouds(base, w, h, s, kind, rnd, portrait):
    """soft clouds in the top ~55%: 'cumulus' (puffy, white), 'wisps' (thin, pink-lit), 'streaks' (sunset-lit)"""
    lay = Image.new('L', (w, h), 0)
    ld = ImageDraw.Draw(lay)
    shade = Image.new('L', (w, h), 0)
    sd = ImageDraw.Draw(shade)
    if kind == 'cumulus':
        spots = [(0.18, 0.15, 1.0), (0.82, 0.24, 0.8), (0.40, 0.33, 0.7), (0.70, 0.47, 0.6), (0.12, 0.52, 0.5)] if portrait else \
                [(0.14, 0.16, 1.0), (0.44, 0.10, 0.8), (0.30, 0.40, 0.6), (0.72, 0.46, 0.6)]
        for fx, fy, k in spots:
            cx, cy, cw = fx * w, fy * h, 260 * s * k
            for i in range(7):
                ox = rnd.uniform(-0.55, 0.55) * cw
                rx = cw * rnd.uniform(0.22, 0.36)
                ry = rx * rnd.uniform(0.55, 0.8)
                oy = -ry * rnd.uniform(0.1, 0.6) + abs(ox) * 0.2
                ld.ellipse([cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry * 0.9], fill=255)
                sd.ellipse([cx + ox - rx, cy + oy + ry * 0.2, cx + ox + rx, cy + oy + ry * 1.05], fill=255)
        soft = np.asarray(lay.filter(ImageFilter.GaussianBlur(5 * s))).astype(np.float32) / 255
        under = np.asarray(shade.filter(ImageFilter.GaussianBlur(12 * s))).astype(np.float32) / 255
        base = over(base, (200, 214, 236), np.clip(under, 0, 1) * 0.55)
        base = over(base, (255, 255, 255), soft * 0.94)
    elif kind == 'wisps':
        for fx, fy, ln in ((0.22, 0.30, 0.9), (0.62, 0.40, 0.7), (0.38, 0.52, 0.6), (0.78, 0.58, 0.5)):
            cx, cy, cw = fx * w, fy * h, 520 * s * ln
            for i in range(5):
                ox = (i - 2) * cw * 0.22 + rnd.uniform(-20, 20) * s
                rx, ry = cw * rnd.uniform(0.18, 0.3), (10 + 6 * rnd.random()) * s
                ld.ellipse([cx + ox - rx, cy - ry + i * 2 * s, cx + ox + rx, cy + ry + i * 2 * s], fill=255)
        soft = np.asarray(lay.filter(ImageFilter.GaussianBlur(14 * s))).astype(np.float32) / 255
        base = over(base, (255, 226, 222), np.clip(soft * 1.3, 0, 1) * 0.7)
    else:  # streaks: long sunset bars, dark underside, hot-pink + amber lit tops
        for fx, fy, ln in ((0.30, 0.40, 1.0), (0.70, 0.50, 0.85), (0.22, 0.60, 0.7), (0.62, 0.66, 0.6)):
            cx, cy, cw = fx * w, fy * h, 640 * s * ln
            for i in range(4):
                ox = (i - 1.5) * cw * 0.24
                rx, ry = cw * rnd.uniform(0.2, 0.32), (9 + 7 * rnd.random()) * s
                ld.ellipse([cx + ox - rx, cy - ry, cx + ox + rx, cy + ry], fill=255)
                sd.ellipse([cx + ox - rx * 0.9, cy + ry * 0.3, cx + ox + rx * 0.9, cy + ry * 1.3], fill=255)
        soft = np.asarray(lay.filter(ImageFilter.GaussianBlur(10 * s))).astype(np.float32) / 255
        under = np.asarray(shade.filter(ImageFilter.GaussianBlur(14 * s))).astype(np.float32) / 255
        base = over(base, (80, 24, 76), np.clip(under, 0, 1) * 0.45)
        base = over(base, (255, 168, 128), np.clip(soft * 1.2, 0, 1) * 0.78)
    return base


def pumpkin_parts(masks, x, y, r):
    """round pumpkin resting on ground y into 5 SS masks: left lobe, right lobe, center lobe, stem, carved face"""
    dl, dr, dc, ds, df = masks
    S2 = lambda px, py: (px * SS, py * SS)
    cy = y - r * 0.82
    for d, dx, rx in ((dl, -0.42, 0.62), (dr, 0.42, 0.62), (dc, 0, 0.66)):
        d.ellipse([*S2(x + dx * r - rx * r, cy - 0.82 * r), *S2(x + dx * r + rx * r, cy + 0.82 * r)], fill=255)
    ds.polygon([S2(x - 0.08 * r, cy - 0.7 * r), S2(x + 0.1 * r, cy - 0.7 * r), S2(x + 0.2 * r, cy - 1.05 * r), S2(x + 0.06 * r, cy - 1.08 * r)], fill=255)
    e = 0.2 * r
    for sx in (-1, 1):
        ex = x + sx * 0.32 * r
        df.polygon([S2(ex - e, cy - 0.05 * r), S2(ex + e, cy - 0.05 * r), S2(ex, cy - 0.38 * r)], fill=255)
    mouth = [S2(x - 0.5 * r, cy + 0.18 * r)]
    for i in range(6):
        mouth.append(S2(x - 0.5 * r + i * (r / 5), cy + (0.18 if i % 2 == 0 else 0.3) * r))
    mouth += [S2(x + 0.5 * r, cy + 0.18 * r), S2(x + 0.32 * r, cy + 0.48 * r), S2(x - 0.32 * r, cy + 0.48 * r)]
    df.polygon(mouth, fill=255)


# the small coloured pumpkin patch the time walls add beside the house (home page positions; other pages get the same
# row under their hero). (fraction of width, radius in 1290-px units)
PATCH = [(0.44, 40), (0.50, 28), (0.745, 46), (0.80, 32), (0.70, 22), (0.34, 24)]
PATCH_COL = {   # lobe L / lobe R / lobe C / stem / face(unlit) / face(lit) per time
    'morning': ((176, 128, 140), (190, 140, 148), (208, 158, 160), (110, 96, 100), (96, 70, 96), None),
    'day':     ((236, 104, 14), (244, 118, 24), (255, 146, 40), (86, 130, 40), (74, 36, 66), None),
    'evening': ((150, 56, 30), (170, 64, 30), (196, 78, 34), (60, 36, 34), None, (255, 196, 90)),
}


# ---------- direction 1: midnight everywhere ----------
def midnight(size, page, dark=True, tod='night'):
    """tod: 'night' = the shipped wall (byte-identical); 'morning' | 'day' | 'evening' = same scene, that time's light."""
    w, h = size
    seed = seed_of('midnight', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290 * (1.0 if portrait else 1.25)
    acc = ACCENT[page]
    T = TOD.get(tod)      # None = night (the shipped look)
    horizon = h * (0.815 if portrait else 0.80)
    if T is None:
        base = vgrad(h, w, [(0, (12, 7, 28)), (0.45, (30, 13, 50)), (0.75, (52, 20, 52)), (1, (70, 26, 40))])
        base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), acc, 0.85)
        base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), (255, 196, 110), 0.55)
    else:
        base = vgrad(h, w, T['sky'])
        base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), *T['horizon'])
        base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), *T['horizon2'])
    # stars, top half only (night: as shipped; evening: a few faint ones up top; morning / day: none). The random
    # stream is consumed identically either way so the scene below never moves.
    star_k = 1.0 if T is None else T['stars']
    st = Image.new('L', (w, h), 0)
    sd = ImageDraw.Draw(st)
    for _ in range(int(w * h / 9000)):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.62) ** 1.5
        r = rnd.choice([1.3, 1.6, 2.0, 2.6])
        f = rnd.uniform(60, 210)
        if T is None:
            sd.ellipse([x - r, y - r, x + r, y + r], fill=int(f * (1 - y / (h * 0.66))))
        else:
            sd.ellipse([x - r, y - r, x + r, y + r], fill=int(f * (1 - y / (h * 0.66)) * star_k * max(0, 1 - y / (h * 0.30))))
    if star_k:
        base = over(base, (255, 244, 225), np.asarray(st.filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 255)
    if T is None:
        # big harvest moon, top right, with a wide warm halo
        mx, my, mr = (w * 0.74, h * 0.072, 118 * s) if portrait else (w * 0.85, h * 0.17, 120 * s)
        base = glow(base, mx, my, mr * 4.2, mr * 4.2, (255, 150, 60), 0.42, 1.2)
        base = glow(base, mx, my, mr * 1.9, mr * 1.9, (255, 205, 130), 0.55, 1.4)
        base = moon_disc(base, mx, my, mr, (255, 214, 140), (226, 150, 80), rnd)
    else:
        sun = T['sun']
        fx, fy = sun['pos_p'] if portrait else sun['pos_w']
        sx, sy, sr = w * fx, h * fy, sun['r'] * s
        # the moon's random draws (21) are spent either way: the morning keeps a faded ghost-moon at the night moon's spot
        mxx, myy, mrr = (w * 0.74, h * 0.072, 118 * s) if portrait else (w * 0.85, h * 0.17, 120 * s)
        gm = T['ghost_moon']
        moon_layer = moon_disc(base, mxx, myy, mrr, (255, 214, 140) if gm is None else gm[0], (226, 150, 80) if gm is None else (210, 196, 226), rnd)
        if gm is not None:
            base = base * (1 - gm[1]) + moon_layer * gm[1]
        c1, k1, p1 = sun['halo1']
        c2, k2, p2 = sun['halo2']
        if sun['haze']:   # a low sun: a milky haze band across the horizon, laid down BEFORE the disc
            base = glow(base, w * 0.5, horizon - h * 0.015, w * 0.9, h * 0.05, (250, 236, 236), sun['haze'], 1.0)
        base = glow(base, sx, sy, sr * p1, sr * p1, c1, k1, 1.2)
        base = glow(base, sx, sy, sr * p2, sr * p2, c2, k2, 1.4)
        base = sun_disc(base, sx, sy, sr, sun['col'], sun['core'])
        base = clouds(base, w, h, s, T['clouds'], random.Random(seed + 7), portrait)
    # skyline silhouette (night: one ink mask; the time walls: far hill, objects, near hill as three layers)
    m, d = mask_layer(w, h)
    g, gd = mask_layer(w, h)
    ys = hill_y(w, h, horizon + 40 * s, 34 * s, seed)
    ys2 = hill_y(w, h, horizon + 110 * s, 22 * s, seed + 1, 1.3)
    if T is None:
        fill_below(d, ys)
        fill_below(d, ys2)
    else:
        far_m, fd = mask_layer(w, h)
        fill_below(fd, ys)
        near_m, nd = mask_layer(w, h)
        fill_below(nd, ys2)
    gy = lambda fx: float(ys[min(w - 1, max(0, int(fx * w)))])
    # crooked trees at the outer edges (they reach up the side margins), mirrored for symmetry
    tips = [] if tod == 'day' else None
    tree(d, w * 0.06, gy(0.06) + 10 * s, 600 * s, rnd, lean=0.18, tips=tips)
    tree(d, w * 0.94, gy(0.94) + 10 * s, 560 * s, rnd, lean=-0.18, tips=tips)
    if not portrait:
        tree(d, w * 0.20, gy(0.20) + 10 * s, 300 * s, rnd, lean=0.1, tips=tips)
        tree(d, w * 0.80, gy(0.80) + 10 * s, 320 * s, rnd, lean=-0.1, tips=tips)
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
    # bats in the top band (kept off the stats row and the cast header lettering center). NIGHT ONLY: it is the shipped
    # wall; the time walls leave the sky to the app's ambient flyers.
    batm = None
    if T is None:
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
    if T is None:
        base = over(base, (210, 170, 220), np.clip(mist, 0, 0.4))
        ink = (13, 6, 20)
        base = over(base, ink, sil)
        base = over(base, ink, batm * 0.92)
        obj = sil
    else:
        mc, mk = T['mist']
        base = over(base, mc, np.clip(mist * mk, 0, 0.6))
        ink = T['ink']
        base = over(base, T['hill_far'], down(far_m, w, h))
        base = over(base, ink, sil)
        # day: vivid orange leaf clumps on the crooked trees (own random stream; ink trunks stay underneath)
        if tips:
            lrnd = random.Random(seed + 11)
            lm = [mask_layer(w, h) for _ in range(3)]
            for (tx, ty, dep, ln) in tips:
                if dep > 3:
                    continue
                for _ in range(2):
                    rr = (24 + 15 * (3 - dep) + lrnd.uniform(0, 10)) * s
                    ox, oy = lrnd.uniform(-0.6, 0.6) * rr, lrnd.uniform(-0.5, 0.5) * rr
                    lm[0][1].ellipse([*S2(tx + ox - rr, ty + oy - rr * 0.82), *S2(tx + ox + rr, ty + oy + rr * 0.82)], fill=255)
                    lm[1][1].ellipse([*S2(tx + ox - rr * 0.85, ty + oy - rr * 0.82), *S2(tx + ox + rr * 0.6, ty + oy + rr * 0.5)], fill=255)
                    lm[2][1].ellipse([*S2(tx + ox - rr * 0.55, ty + oy - rr * 0.7), *S2(tx + ox + rr * 0.1, ty + oy - rr * 0.1)], fill=255)
            for (lmask, _), col in zip(lm, ((214, 78, 10), (250, 120, 18), (255, 172, 40))):
                base = over(base, col, down(lmask, w, h))
        # the small pumpkin patch beside the house (coloured; day bright, evening just lit, morning dusty)
        pm = [mask_layer(w, h) for _ in range(5)]
        for fxp, rp in PATCH:
            pumpkin_parts([p[1] for p in pm], w * fxp, gy(fxp) + 8 * s, rp * s)
        cl, cr_, cc, cs, cf_un, cf_lit = PATCH_COL[T['patch']]
        pl, pr_, pc, ps, pf = (down(p[0], w, h) for p in pm)
        base = over(base, cl, pl)
        base = over(base, cr_, pr_ * (1 - pl * 0))
        base = over(base, cc, pc)
        base = over(base, cs, ps)
        if cf_lit is None:
            base = over(base, cf_un, pf * pc.clip(0, 1))
        else:
            halo2 = np.asarray(Image.fromarray((pf * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9 * s))).astype(np.float32) / 255
            base = over(base, (255, 140, 40), np.clip(halo2 * 1.3, 0, 0.55))
            base = over(base, cf_lit, pf)
        base = over(base, T['hill_near'], down(near_m, w, h))   # the near rise sits in front of the scene
        obj = sil * (1 - down(near_m, w, h))
    # lit windows / carved faces glow (night: as shipped; morning / day dark; evening lit)
    wk = 1.0 if T is None else T['windows']
    if wk:
        halo = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10 * s))).astype(np.float32) / 255
        base = over(base, (255, 150, 40), np.clip(halo * 1.4, 0, 0.6) * obj * wk)
        base = over(base, (255, 196, 90), lit * wk)
    # front mist over the hill foot
    m2c, m2k = ((190, 150, 210), 0.10) if T is None else T['mist2']
    mist2 = np.exp(-((yy - (horizon + 40 * s)) / (40 * s)) ** 2) * m2k
    base = over(base, m2c, mist2 * np.ones((1, w), np.float32))
    if T is not None and T['fog_front']:
        # morning's thick ground fog (evening: a thin amber haze) drifting IN FRONT of the graveyard, the house and the
        # trees' feet, so the silhouettes dissolve into it
        fc, fk = T['fog_front']
        fwav = np.sin(xx / w * math.pi * 3.0 + 0.6) * 22 * s
        fog = np.exp(-((yy - (horizon + 6 * s) - fwav) / (92 * s)) ** 2) * fk
        fog += np.exp(-((yy - (horizon - 96 * s) - fwav * 0.6) / (46 * s)) ** 2) * fk * 0.55
        base = over(base, fc, np.clip(fog, 0, 0.8) * np.ones((1, w), np.float32))
    if T is not None and T['veil']:
        vc, vk = T['veil']   # the low sun's light spilling across the scene around it
        base = glow(base, sx, horizon + 10 * s, w * 0.55, h * 0.05, vc, vk, 1.3)
    xx1 = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - (0.16 if T is None else T['vignette']) * xx1 ** 4
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
