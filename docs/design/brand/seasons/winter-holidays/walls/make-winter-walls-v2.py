#!/usr/bin/env python3
"""Winter holidays wallpapers v2: WINTER NIGHT, the same family as the shipped Halloween "midnight" walls and the
Thanksgiving "harvest dusk" walls.

Art review 10-16 (review-1016/REDO.md): v1 (make-winter-walls.py) was a navy-to-pale-blue gradient with a few scattered
icons; no scene, the navy title rim vanished on the navy top band, and the pale bottom third failed the night-UI gate.
This mirrors ../../thanksgiving/walls/make-thanksgiving-walls-v2.py beat for beat, so the seasons swap without the UI
noticing:

  sky        deep navy -> midnight indigo, soft stars in the top half, gently falling snow (static flakes, sparse in
             the content column)
  title band a moon-lit steel-blue band at the page-title line (top ~18-28%) so the navy-rimmed winter lettering keeps
             its edge (Thanksgiving: dusk-amber band, Halloween: lit purple band)
  moon       a big cold white-blue moon, top right, with a wide silver halo (the two other seasons: amber)
  skyline    two snowy rolling hills: a moon-lit snow crest fading into deep shadow, so the bottom stays as dark as
             Halloween's; pine silhouettes at the outer edges (Halloween: bare trees, Thanksgiving: corn), a snow-capped
             split-rail fence, low cold mist
  hero       home: a cozy cabin, lit windows, a wreath on the door    games: a snowman + presents
             leaderboard: a pine tree with a star                    stats: a hanukkiah glowing in a cottage window
             friends: a kinara on a window sill beside a small evergreen

Inclusive (seasons/README.md "Winter holidays are inclusive"): objects and light only, no religious garments, no
caricature. Accuracy: hanukkiah = 9 branches, the shamash raised in the center, candles for ONE night (shamash + the
rightmost candle); kinara = 7 candles, 3 red left, 1 black center, 3 green right.

Everything is CODE-DRAWN at full resolution (PIL + numpy, silhouettes at 2x then downsampled; never an upscale).
The center and bottom stay as calm and dark as Halloween's (wallTone: dark, no -light twins).

  python3 make-winter-walls-v2.py [outdir]
  -> <outdir>/wall-<page>[-wide].webp  (1290 x 2796 portrait, 2400 x 1500 wide)   default outdir: this folder
"""
import hashlib, math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PORTRAIT = (1290, 2796)
WIDE = (2400, 1500)
PAGES = ['home', 'games', 'stats', 'friends', 'leaderboard']
SS = 2  # silhouettes are drawn at 2x and downsampled (clean edges at full resolution)

# per page: horizon glow accent (cool, per page a slightly different blue) + the hero silhouette on the skyline
ACCENT = {
    'home':        (96, 140, 210),
    'games':       (84, 132, 212),
    'stats':       (104, 150, 214),
    'friends':     (118, 140, 216),
    'leaderboard': (96, 156, 220),
}
HERO = {'home': 'cabin', 'games': 'snowman', 'stats': 'menorah', 'friends': 'kinara', 'leaderboard': 'startree'}

INK = (9, 12, 30)            # silhouette ink (night navy-black)
SNOW = (168, 190, 232)       # moon-lit snow
WARM = (255, 204, 110)       # lit windows
FLAME = (255, 226, 150)


# ---------- helpers (same engine as the Halloween / Thanksgiving v2 scripts) ----------
def seed_of(*parts):
    return int(hashlib.md5('-'.join(map(str, parts)).encode()).hexdigest()[:8], 16)


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


def blur(mask, r):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def S(px, py):
    return (px * SS, py * SS)


def box(d, x0, y0, x1, y1, ellipse=False, fill=255):
    """rectangle / ellipse at SS scale with the corners sorted (mirrored shapes pass them reversed)"""
    xy = [*S(min(x0, x1), min(y0, y1)), *S(max(x0, x1), max(y0, y1))]
    (d.ellipse if ellipse else d.rectangle)(xy, fill=fill)


def line(d, p0, p1, wd):
    d.line([S(*p0), S(*p1)], fill=255, width=max(1, round(wd * SS)))


def moon_disc(base, cx, cy, r, col, shade, rnd):
    """a lit moon with soft craters (limb darkening toward the lower left)"""
    h, w = base.shape[:2]
    yy, xx = np.ogrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(r + 0.8 - dist, 0, 1).astype(np.float32)
    lim = np.clip(((xx - cx) * -0.5 + (yy - cy) * 0.7) / r, 0, 1).astype(np.float32)
    disc = np.array(col, np.float32) * (1 - 0.16 * lim[..., None]) + np.zeros_like(base)
    for _ in range(7):
        ang, rr = rnd.uniform(0, 6.28), rnd.uniform(0.1, 0.7) * r
        ccx, ccy, cr = cx + math.cos(ang) * rr, cy + math.sin(ang) * rr, rnd.uniform(0.07, 0.18) * r
        cd = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
        ca = (np.clip(1 - cd / cr, 0, 1) ** 0.6 * 0.20).astype(np.float32)[..., None]
        disc = disc * (1 - ca) + np.array(shade, np.float32) * ca
    return over(base, disc, a)


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


def star_poly(d, x, y, r, rot=-90):
    pts = []
    for i in range(10):
        rr = r if i % 2 == 0 else r * 0.42
        a = math.radians(rot + i * 36)
        pts.append(S(x + math.cos(a) * rr, y + math.sin(a) * rr))
    d.polygon(pts, fill=255)


# ---------- silhouettes ----------
def pine(d, sd, x, y, height, tiers=4, wobble=0.0, rnd=None, snow=True):
    """a pine: a trunk and stacked tiers narrowing to the tip; a thin snow line on the windward side of each tier"""
    tw = height * 0.045
    d.rectangle([*S(x - tw, y - height * 0.22), *S(x + tw, y)], fill=255)
    top = y - height
    for i in range(tiers):
        t0 = i / tiers
        t1 = (i + 1.25) / tiers
        yb = y - height * 0.12 - height * 0.88 * t0 * 0.92
        yt = top + height * (1 - t1) * 0.5 if i == tiers - 1 else y - height * 0.12 - height * 0.88 * min(1, t1) * 0.92
        yt = top if i == tiers - 1 else yt
        half = height * 0.30 * (1 - t0 * 0.78) + height * 0.02
        jx = (rnd.uniform(-1, 1) * wobble * height * 0.02) if rnd else 0
        d.polygon([S(x - half + jx, yb), S(x + half + jx, yb), S(x + jx * 0.5, yt)], fill=255)
        if snow and sd is not None and i < tiers:
            # snow catches on the upper left of each tier: a thin wedge along the left edge
            sd.polygon([S(x + jx * 0.5, yt), S(x + jx * 0.5 + half * 0.16, yt + (yb - yt) * 0.16),
                        S(x - half * 0.72 + jx, yb - (yb - yt) * 0.22), S(x - half * 0.86 + jx, yb - (yb - yt) * 0.16)], fill=255)


def rail_fence(d, sd, x0, x1, y, s):
    """split-rail fence: posts with two rails, snow on the top rail and the post caps"""
    p = 60 * s
    hgt = 40 * s
    for ry in (0.80, 0.42):
        d.rectangle([x0 * SS, (y - hgt * ry) * SS, x1 * SS, (y - hgt * ry + 4.5 * s) * SS], fill=255)
    sd.rectangle([x0 * SS, (y - hgt * 0.80 - 2.6 * s) * SS, x1 * SS, (y - hgt * 0.80 + 0.4 * s) * SS], fill=255)
    xx = x0
    while xx <= x1 + 1:
        d.rectangle([(xx - 3.4 * s) * SS, (y - hgt) * SS, (xx + 3.4 * s) * SS, y * SS], fill=255)
        sd.rectangle([(xx - 4.2 * s) * SS, (y - hgt - 3 * s) * SS, (xx + 4.2 * s) * SS, (y - hgt + 1 * s) * SS], fill=255)
        xx += p


def cottage(d, gd, sd, x, y, s, bw=150, bh=78, roof=50, chimney=True, chimney_side=1):
    """a small gabled house silhouette with a snow-laden roof; returns (L, R, T). Windows are the caller's."""
    L, R, T = x - bw * s / 2, x + bw * s / 2, y - bh * s
    d.rectangle([*S(L, T), *S(R, y)], fill=255)
    d.polygon([S(L - 14 * s, T + 2 * s), S(x, T - roof * s), S(R + 14 * s, T + 2 * s)], fill=255)
    # snow on the roof: a thick cap along both slopes with a soft drip past the eave
    sd.polygon([S(L - 16 * s, T + 1 * s), S(x, T - roof * s - 7 * s), S(R + 16 * s, T + 1 * s),
                S(R + 10 * s, T + 7 * s), S(x, T - roof * s + 6 * s), S(L - 10 * s, T + 7 * s)], fill=255)
    if chimney:
        cx = x + chimney_side * bw * s * 0.28
        d.rectangle([*S(cx - 8 * s, T - roof * s * 0.55), *S(cx + 8 * s, T + 4 * s)], fill=255)
        sd.rectangle([*S(cx - 9.5 * s, T - roof * s * 0.55 - 3 * s), *S(cx + 9.5 * s, T - roof * s * 0.55 + 1 * s)], fill=255)
    return L, R, T


def cabin(d, gd, sd, dd, x, y, s):
    """cozy log cabin: wide low body, a gabled roof, chimney, a lit door with a wreath, two lit windows, a porch step"""
    L, R, T = cottage(d, gd, sd, x, y, s, bw=180, bh=84, roof=54, chimney=True, chimney_side=1)
    # porch roof + posts
    d.rectangle([*S(L - 22 * s, T + 20 * s), *S(R + 22 * s, T + 26 * s)], fill=255)
    sd.rectangle([*S(L - 24 * s, T + 17 * s), *S(R + 24 * s, T + 21 * s)], fill=255)
    for px in (L - 18 * s, R + 18 * s):
        d.rectangle([*S(px - 3 * s, T + 26 * s), *S(px + 3 * s, y)], fill=255)
    # door (lit) with a wreath (dark ring + bow) hung on it
    gd.rectangle([*S(x - 15 * s, y - 52 * s), *S(x + 15 * s, y - 1 * s)], fill=255)
    wy = y - 36 * s
    dd.ellipse([*S(x - 10 * s, wy - 10 * s), *S(x + 10 * s, wy + 10 * s)], fill=255)
    dd.ellipse([*S(x - 6 * s, wy - 6 * s), *S(x + 6 * s, wy + 6 * s)], fill=0)
    dd.polygon([S(x, wy - 9 * s), S(x - 5 * s, wy - 14 * s), S(x - 4 * s, wy - 7 * s)], fill=255)   # bow
    dd.polygon([S(x, wy - 9 * s), S(x + 5 * s, wy - 14 * s), S(x + 4 * s, wy - 7 * s)], fill=255)
    # two lit windows with a cross of mullions
    for wx in (L + 40 * s, R - 40 * s):
        gd.rectangle([*S(wx - 13 * s, T + 36 * s), *S(wx + 13 * s, T + 60 * s)], fill=255)
        dd.rectangle([*S(wx - 1 * s, T + 36 * s), *S(wx + 1 * s, T + 60 * s)], fill=255)
        dd.rectangle([*S(wx - 13 * s, T + 47 * s), *S(wx + 13 * s, T + 49 * s)], fill=255)
        sd.rectangle([*S(wx - 15 * s, T + 60 * s), *S(wx + 15 * s, T + 63 * s)], fill=255)        # snow on the sill
    # a small gable window
    gd.rectangle([*S(x - 6 * s, T - 24 * s), *S(x + 6 * s, T - 10 * s)], fill=255)
    # chimney smoke: a few soft puffs into the snow layer (faint), drawn by the caller as mist


def snowman(d, gd, sd, dd, x, y, s):
    """three stacked balls, a top hat, stick arms, a carrot nose, a scarf, coal buttons (drawn as a snow silhouette)"""
    r = (34 * s, 27 * s, 20 * s)
    cy = [y - r[0], y - 2 * r[0] - r[1] * 0.85, y - 2 * r[0] - 2 * r[1] * 0.85 - r[2] * 0.85]
    for rr, yy in zip(r, cy):
        sd.ellipse([*S(x - rr, yy - rr), *S(x + rr, yy + rr)], fill=255)
        d.ellipse([*S(x - rr - 1.5 * s, yy - rr - 1.5 * s), *S(x + rr + 1.5 * s, yy + rr + 1.5 * s)], fill=255)
    hy = cy[2] - r[2]
    # top hat
    d.rectangle([*S(x - 24 * s, hy + 2 * s), *S(x + 24 * s, hy + 7 * s)], fill=255)
    d.rectangle([*S(x - 15 * s, hy - 30 * s), *S(x + 15 * s, hy + 6 * s)], fill=255)
    sd.rectangle([*S(x - 15 * s, hy - 31 * s), *S(x + 15 * s, hy - 28 * s)], fill=255)
    # eyes, buttons (dark on the snow), carrot nose (lit)
    for dx, dy in ((-7, -6), (7, -6)):
        dd.ellipse([*S(x + dx * s - 2.4 * s, cy[2] + dy * s - 2.4 * s), *S(x + dx * s + 2.4 * s, cy[2] + dy * s + 2.4 * s)], fill=255)
    gd.polygon([S(x + 2 * s, cy[2] + 1 * s), S(x + 2 * s, cy[2] + 5 * s), S(x + 16 * s, cy[2] + 4 * s)], fill=255)
    for k in range(3):
        by = cy[1] - 10 * s + k * 10 * s
        dd.ellipse([*S(x - 2.6 * s, by - 2.6 * s), *S(x + 2.6 * s, by + 2.6 * s)], fill=255)
    # scarf
    d.rectangle([*S(x - r[2] - 2 * s, cy[2] + r[2] - 6 * s), *S(x + r[2] + 2 * s, cy[2] + r[2] + 2 * s)], fill=255)
    d.polygon([S(x + 8 * s, cy[2] + r[2]), S(x + 20 * s, cy[2] + r[2]), S(x + 18 * s, cy[2] + r[2] + 24 * s), S(x + 9 * s, cy[2] + r[2] + 22 * s)], fill=255)
    # stick arms
    for side in (-1, 1):
        ax, ay = x + side * r[1] * 0.9, cy[1] - 4 * s
        line(d, (ax, ay), (ax + side * 40 * s, ay - 26 * s), 3.2 * s)
        line(d, (ax + side * 26 * s, ay - 17 * s), (ax + side * 32 * s, ay - 30 * s), 2.4 * s)


def present(d, sd, x, y, wd, ht, s, bow=True):
    """a wrapped box on the ground: silhouette, with the ribbon and bow picked out in snow-light"""
    d.rectangle([*S(x - wd / 2, y - ht), *S(x + wd / 2, y)], fill=255)
    d.rectangle([*S(x - wd / 2 - 2 * s, y - ht), *S(x + wd / 2 + 2 * s, y - ht + ht * 0.22)], fill=255)   # lid
    sd.rectangle([*S(x - wd * 0.06, y - ht), *S(x + wd * 0.06, y)], fill=255)                           # ribbon
    sd.rectangle([*S(x - wd / 2 - 2 * s, y - ht + ht * 0.22 - 1.5 * s), *S(x + wd / 2 + 2 * s, y - ht + ht * 0.22 + 1.5 * s)], fill=255)
    if bow:
        for side in (-1, 1):
            d.ellipse([*S(x + side * 3 * s - 7 * s, y - ht - 8 * s), *S(x + side * 3 * s + 7 * s, y - ht + 1 * s)], fill=255)
        sd.ellipse([*S(x - 2.5 * s, y - ht - 6 * s), *S(x + 2.5 * s, y - ht - 1 * s)], fill=255)


def star_tree(d, gd, sd, fd, x, y, height, rnd):
    """the leaderboard pine: taller, a lit star on top, a spiral string of tiny lights"""
    pine(d, sd, x, y, height, tiers=5, wobble=0.4, rnd=rnd)
    top = y - height
    star_poly(gd, x, top - height * 0.028, height * 0.045)
    star_poly(fd, x, top - height * 0.028, height * 0.045)
    # lights: a loose spiral, bulbs as small lit dots
    for i in range(22):
        t = 0.12 + 0.82 * i / 21
        half = height * 0.30 * (1 - (1 - t) * 0.78) * 0.86
        ang = i * 1.05
        lx = x + math.cos(ang) * half * 0.92
        if math.sin(ang) < -0.2:      # the back of the tree: hide
            continue
        ly = y - height * (1 - t) - height * 0.05
        r = height * 0.0075
        gd.ellipse([*S(lx - r, ly - r), *S(lx + r, ly + r)], fill=255)


def menorah_window(d, gd, sd, dd, fd, x, y, s):
    """a cottage whose big front window holds a hanukkiah silhouette: 9 branches, the shamash raised in the center,
    candles for the first night (the shamash + the rightmost candle), both lit, all of it inside the pane."""
    L, R, T = cottage(d, gd, sd, x, y, s, bw=150, bh=84, roof=50, chimney=True, chimney_side=-1)
    # the window (lit): one wide, tall pane so the hanukkiah silhouette stays unbroken
    wx0, wx1, wy0, wy1 = x - 44 * s, x + 44 * s, T + 12 * s, y - 16 * s
    gd.rectangle([*S(wx0, wy0), *S(wx1, wy1)], fill=255)
    sd.rectangle([*S(wx0 - 3 * s, wy1), *S(wx1 + 3 * s, wy1 + 3 * s)], fill=255)   # snow on the sill
    # hanukkiah silhouette inside the window (dark on the light)
    k = s * 0.78
    my = wy1 - 5 * s                                                                 # base line
    dd.rectangle([*S(x - 24 * k, my - 3 * k), *S(x + 24 * k, my)], fill=255)        # foot
    dd.rectangle([*S(x - 2.2 * k, my - 30 * k), *S(x + 2.2 * k, my)], fill=255)     # stem
    arm_y = my - 24 * k                                                              # branch bar
    bw2 = 36 * k
    dd.rectangle([*S(x - bw2, arm_y - 2 * k), *S(x + bw2, arm_y + 0.5 * k)], fill=255)
    cup_y = arm_y - 10 * k                                                           # the eight branch cups level
    xs = [x + (i - 4) * 9 * k for i in range(9) if i != 4]
    for bx in xs:
        dd.rectangle([*S(bx - 1.2 * k, cup_y), *S(bx + 1.2 * k, arm_y)], fill=255)   # short riser
        dd.rectangle([*S(bx - 2.8 * k, cup_y - 2.5 * k), *S(bx + 2.8 * k, cup_y)], fill=255)   # cup
    sh_y = cup_y - 7 * k                                                              # the shamash sits higher
    dd.rectangle([*S(x - 1.4 * k, sh_y), *S(x + 1.4 * k, arm_y)], fill=255)
    dd.rectangle([*S(x - 3.2 * k, sh_y - 2.5 * k), *S(x + 3.2 * k, sh_y)], fill=255)
    # candles: the shamash + night one (the rightmost branch); flames lit
    for cx_, cy_ in ((x, sh_y - 2.5 * k), (xs[-1], cup_y - 2.5 * k)):
        dd.rectangle([*S(cx_ - 1.5 * k, cy_ - 11 * k), *S(cx_ + 1.5 * k, cy_)], fill=255)
        fd.ellipse([*S(cx_ - 2.2 * k, cy_ - 17 * k), *S(cx_ + 2.2 * k, cy_ - 11 * k)], fill=255)


def kinara_window(d, gd, sd, dd, fd, cd, x, y, s):
    """a cottage whose wide window shows a kinara on the sill (7 candles: 3 red left, 1 black center, 3 green right,
    all lit) beside a small evergreen. The candle colors go into cd (an RGB image), the holder into dd."""
    L, R, T = cottage(d, gd, sd, x, y, s, bw=170, bh=82, roof=48, chimney=True, chimney_side=1)
    wx0, wx1, wy0, wy1 = x - 52 * s, x + 40 * s, T + 20 * s, y - 16 * s
    gd.rectangle([*S(wx0, wy0), *S(wx1, wy1)], fill=255)
    sd.rectangle([*S(wx0 - 3 * s, wy1), *S(wx1 + 3 * s, wy1 + 3 * s)], fill=255)
    # the kinara: a low holder on the sill, 7 candle holders in a row (center one a touch taller)
    kx = x - 10 * s
    ky = wy1 - 4 * s
    dd.rectangle([*S(kx - 30 * s, ky - 4 * s), *S(kx + 30 * s, ky)], fill=255)
    cols = [(196, 54, 46)] * 3 + [(22, 18, 26)] + [(44, 128, 70)] * 3
    for i, col in enumerate(cols):
        cx_ = kx + (i - 3) * 8.5 * s
        rise = 2 * s if i == 3 else 0
        dd.rectangle([*S(cx_ - 2.4 * s, ky - 7 * s - rise), *S(cx_ + 2.4 * s, ky - 4 * s)], fill=255)   # holder cup
        cd.rectangle([*S(cx_ - 1.7 * s, ky - 20 * s - rise), *S(cx_ + 1.7 * s, ky - 7 * s - rise)], fill=col)
        fd.ellipse([*S(cx_ - 2.0 * s, ky - 26 * s - rise), *S(cx_ + 2.0 * s, ky - 20 * s - rise)], fill=255)
    # the small evergreen on the sill, right of the kinara (a potted tree)
    tx = x + 28 * s
    dd.rectangle([*S(tx - 5 * s, ky - 5 * s), *S(tx + 5 * s, ky)], fill=255)
    pine(dd, None, tx, ky - 5 * s, 26 * s, tiers=3, snow=False)


# ---------- the wall ----------
def winter(size, page):
    w, h = size
    seed = seed_of('winter-night', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290 * (1.0 if portrait else 1.25)
    acc = ACCENT[page]
    # night sky: deep navy up top, midnight indigo in the middle, a cooler steel blue at the horizon
    base = vgrad(h, w, [(0, (6, 9, 30)), (0.45, (14, 20, 58)), (0.75, (26, 40, 92)), (1, (40, 62, 118))])
    horizon = h * (0.815 if portrait else 0.80)
    base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), acc, 0.70)
    base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), (170, 200, 240), 0.40)
    # title zone (top ~18-28%): a moon-lit steel-blue band so the navy-rimmed winter lettering keeps its edge
    # against the navy sky (art review 10-16). Wide, soft, no visible edge; the center stays calm.
    if portrait:
        base = glow(base, w * 0.5, h * 0.21, w * 0.80, h * 0.105, (92, 122, 176), 0.50, 1.3)
    else:
        base = glow(base, w * 0.5, h * 0.16, w * 0.85, h * 0.14, (92, 122, 176), 0.44, 1.3)
    # stars, top half only (a little denser than Thanksgiving: winter air is clear)
    st = Image.new('L', (w, h), 0)
    sd_ = ImageDraw.Draw(st)
    for _ in range(int(w * h / 11000)):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.62) ** 1.5
        r = rnd.choice([1.3, 1.6, 2.0, 2.4])
        sd_.ellipse([x - r, y - r, x + r, y + r], fill=int(rnd.uniform(60, 210) * (1 - y / (h * 0.66))))
    base = over(base, (230, 240, 255), np.asarray(st.filter(ImageFilter.GaussianBlur(0.8))).astype(np.float32) / 255)
    # big cold moon, top right, with a wide silver-blue halo
    mx, my, mr = (w * 0.74, h * 0.072, 122 * s) if portrait else (w * 0.85, h * 0.17, 124 * s)
    base = glow(base, mx, my, mr * 4.4, mr * 4.4, (120, 160, 230), 0.42, 1.2)
    base = glow(base, mx, my, mr * 1.9, mr * 1.9, (190, 214, 250), 0.55, 1.4)
    base = moon_disc(base, mx, my, mr, (236, 242, 252), (196, 208, 232), rnd)
    # skyline: two snowy hills (their own mask: the crest glows, the slope falls into shadow)
    hm, hd = mask_layer(w, h)
    ys = hill_y(w, h, horizon + 40 * s, 34 * s, seed)
    fill_below(hd, ys)
    ys2 = hill_y(w, h, horizon + 110 * s, 22 * s, seed + 1, 1.3)
    fill_below(hd, ys2)
    hill = down(hm, w, h)
    gy = lambda fx: float(ys[min(w - 1, max(0, int(fx * w)))])
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    crest = np.zeros((h, w), np.float32)
    for yline, strength in ((ys[None, :], 1.0), (ys2[None, :], 0.40)):
        dz = np.clip(yy - yline, 0, 400 * s)
        crest = np.maximum(crest, np.where(yy >= yline, np.exp(-dz / (12 * s)) * strength, 0))
    # objects (ink), lit openings, snow highlights, dark details on the lit panes, flames, candle colors
    m, d = mask_layer(w, h)
    g, gd = mask_layer(w, h)
    sn, sd = mask_layer(w, h)
    dk, dd = mask_layer(w, h)
    fl, fd = mask_layer(w, h)
    cimg = Image.new('RGB', (w * SS, h * SS), (0, 0, 0))
    cmask, _ = mask_layer(w, h)
    cd = cd_draw(cimg, cmask)
    # pines at the outer edges (they reach up the side margins)
    pine(d, sd, w * 0.06, gy(0.06) + 10 * s, 540 * s, tiers=6, wobble=0.5, rnd=rnd)
    pine(d, sd, w * 0.94, gy(0.94) + 10 * s, 500 * s, tiers=6, wobble=0.5, rnd=rnd)
    if portrait:
        pine(d, sd, w * 0.115, gy(0.115) + 12 * s, 330 * s, tiers=5, wobble=0.5, rnd=rnd)
        pine(d, sd, w * 0.89, gy(0.89) + 12 * s, 300 * s, tiers=5, wobble=0.5, rnd=rnd)
    else:
        pine(d, sd, w * 0.13, gy(0.13) + 10 * s, 330 * s, tiers=5, wobble=0.5, rnd=rnd)
        pine(d, sd, w * 0.21, gy(0.21) + 12 * s, 240 * s, tiers=4, wobble=0.5, rnd=rnd)
        pine(d, sd, w * 0.80, gy(0.80) + 10 * s, 300 * s, tiers=5, wobble=0.5, rnd=rnd)
        pine(d, sd, w * 0.87, gy(0.87) + 12 * s, 220 * s, tiers=4, wobble=0.5, rnd=rnd)
    # a few small distant pines on the far hill, left half
    for fx, hh in ((0.24, 70), (0.27, 95), (0.31, 60)):
        yy2 = float(ys2[min(w - 1, int(fx * w))]) + 4 * s
        pine(d, None, w * fx, yy2, hh * s, tiers=4, snow=False)
    hero = HERO[page]
    hx = 0.62 if portrait else 0.64
    if hero == 'cabin':
        cabin(d, gd, sd, dd, w * hx, gy(hx) + 6 * s, s * 1.5)
        # a little pine beside the cabin
        pine(d, sd, w * (hx + 0.17), gy(hx + 0.17) + 8 * s, 190 * s, tiers=4, wobble=0.4, rnd=rnd)
    elif hero == 'snowman':
        snowman(d, gd, sd, dd, w * 0.60, gy(0.60) + 8 * s, s * 1.45)
        present(d, sd, w * 0.47, gy(0.47) + 8 * s, 74 * s, 58 * s, s * 1.3)
        present(d, sd, w * 0.53, gy(0.53) + 9 * s, 52 * s, 40 * s, s * 1.3)
        present(d, sd, w * 0.705, gy(0.705) + 8 * s, 66 * s, 50 * s, s * 1.3)
        present(d, sd, w * 0.76, gy(0.76) + 9 * s, 44 * s, 62 * s, s * 1.3, bow=False)
    elif hero == 'startree':
        star_tree(d, gd, sd, fd, w * hx, gy(hx) + 8 * s, 470 * s, rnd)
        for fx, hh in ((0.53, 110), (0.72, 130)):
            pine(d, sd, w * fx, gy(fx) + 8 * s, hh * s, tiers=4, wobble=0.4, rnd=rnd)
    elif hero == 'menorah':
        menorah_window(d, gd, sd, dd, fd, w * hx, gy(hx) + 6 * s, s * 1.55)
        pine(d, sd, w * (hx + 0.16), gy(hx + 0.16) + 8 * s, 200 * s, tiers=4, wobble=0.4, rnd=rnd)
    else:  # kinara
        kinara_window(d, gd, sd, dd, fd, cd, w * hx, gy(hx) + 6 * s, s * 1.55)
        pine(d, sd, w * (hx - 0.16), gy(hx - 0.16) + 8 * s, 190 * s, tiers=4, wobble=0.4, rnd=rnd)
    # snow-capped split-rail fence along the near hill
    rail_fence(d, sd, w * 0.18, w * (0.46 if hero != 'snowman' else 0.42), gy(0.32) + 14 * s, s)
    if not portrait:
        rail_fence(d, sd, w * 0.72, w * 0.86, gy(0.78) + 14 * s, s)
    sil, lit, snow_hl, dark, flames = (down(x_, w, h) for x_ in (m, g, sn, dk, fl))
    cand = np.asarray(cimg.resize((w, h), Image.LANCZOS)).astype(np.float32)
    candm = down(cmask, w, h)
    # falling snow: static flakes everywhere, sparse in the content column, a few soft bokeh flakes up top
    fk = Image.new('L', (w, h), 0)
    fkd = ImageDraw.Draw(fk)
    bk = Image.new('L', (w, h), 0)
    bkd = ImageDraw.Draw(bk)
    for _ in range(int(w * h / 5200)):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        calm = (0.17 < x / w < 0.83) and (0.30 < y / h < 0.76) if portrait else (0.12 < x / w < 0.88) and (0.36 < y / h < 0.74)
        foot = y / h > (0.84 if portrait else 0.82)
        if (calm and rnd.random() < 0.80) or (foot and rnd.random() < 0.75):
            continue
        r = rnd.choice([1.4, 1.8, 2.2, 2.8, 3.4]) * s
        fkd.ellipse([x - r, y - r, x + r, y + r], fill=int(rnd.uniform(110, 230)))
    for _ in range(14 if portrait else 18):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.32)
        r = rnd.uniform(7, 14) * s
        bkd.ellipse([x - r, y - r, x + r, y + r], fill=int(rnd.uniform(40, 80)))
    flakes = np.asarray(fk.filter(ImageFilter.GaussianBlur(0.9 * s))).astype(np.float32) / 255
    bokeh = np.asarray(bk.filter(ImageFilter.GaussianBlur(9 * s))).astype(np.float32) / 255
    # mist: soft cold band hugging the hills (behind the near silhouette)
    mist = np.zeros((h, w), np.float32)
    for k in range(3):
        cy0 = horizon + (k * 36 - 20) * s
        wav = np.sin(xx / w * math.pi * (2 + k) + k) * 14 * s
        mist += np.exp(-((yy - cy0 - wav) / (26 * s)) ** 2) * (0.20 - k * 0.04)
    base = over(base, (170, 196, 240), np.clip(mist, 0, 0.4))
    # hills: shadowed slopes with a moon-lit crest
    base = over(base, (12, 17, 40), hill)
    base = over(base, SNOW, hill * np.clip(crest, 0, 1) * 0.62)
    base = over(base, (236, 244, 255), hill * np.clip(crest ** 4, 0, 1) * 0.35)      # the bright lip of the crest
    # objects
    base = over(base, INK, sil)
    base = over(base, SNOW, snow_hl * 0.95)
    # lit windows / the star / the lights: a warm halo, then the panes, then dark details on the panes, flames last
    halo = blur(lit, 10 * s)
    base = over(base, (255, 170, 60), np.clip(halo * 1.4, 0, 0.6) * np.clip(sil + hill, 0, 1))
    base = over(base, WARM, lit)
    base = over(base, (34, 20, 22), dark)
    base = base * (1 - candm[..., None]) + cand * candm[..., None]
    base = over(base, (255, 150, 60), np.clip(blur(flames, 4 * s) * 1.6, 0, 0.7))
    base = over(base, FLAME, flames)
    # snow over everything (in front of the scene), then the front mist over the hill foot
    base = over(base, (226, 236, 255), np.clip(flakes * 0.85 + bokeh, 0, 1))
    mist2 = np.exp(-((yy - (horizon + 40 * s)) / (40 * s)) ** 2) * 0.10
    base = over(base, (120, 150, 210), mist2 * 0.8 * np.ones((1, w), np.float32))
    xx1 = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - 0.16 * xx1 ** 4
    return finish(base, seed)


class cd_draw:
    """RGB drawing for the candle colors that also stamps the coverage mask (so the colors composite cleanly)"""
    def __init__(self, img, mask):
        self.a, self.b = ImageDraw.Draw(img), ImageDraw.Draw(mask)

    def rectangle(self, xy, fill):
        self.a.rectangle(xy, fill=fill)
        self.b.rectangle(xy, fill=255)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else HERE
    os.makedirs(out, exist_ok=True)
    for page in PAGES:
        for size, suf in ((PORTRAIT, ''), (WIDE, '-wide')):
            winter(size, page).save(os.path.join(out, f'wall-{page}{suf}.webp'), 'WEBP', quality=92, method=6)
            print(page, suf or 'portrait')
