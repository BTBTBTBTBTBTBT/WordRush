#!/usr/bin/env python3
"""Thanksgiving wallpapers v2: HARVEST DUSK, the same family as the shipped Halloween "midnight" walls.

Founder (10-16): every screen wallpaper that got a Halloween scene needs a Thanksgiving version. v1 (make-
thanksgiving-walls.py) was a gradient with a few scattered icons; this mirrors ../../halloween/walls/
make-halloween-walls-v2.py (direction "midnight") beat for beat, so the two seasons swap without the UI noticing:

  sky        deep plum -> wine -> burnt-orange dusk, soft stars in the top half only (fewer than Halloween)
  moon       a big warm harvest moon, top right, with a wide amber halo
  flyers     a V of geese in the top band (Halloween: bats), kept off the stats row / cast header
  skyline    two rolling field hills, corn stalks at the outer edges (Halloween: bare trees), wheat clusters,
             a split-rail fence (Halloween: graveyard fence), low warm mist
  hero       home: red-barn farmhouse + silo with lit windows   games: round hay bales + pumpkins + a lantern
             leaderboard: a scarecrow (one crow)                stats: a harvest tree with falling leaves
             friends: a picnic table with a cornucopia + lantern

Everything is CODE-DRAWN at full resolution (PIL + numpy, silhouettes at 2x then downsampled; never an upscale).
The center and bottom stay as calm as Halloween's: cards, boards and keyboards are opaque, so the walls are bold
only in the top band, the skyline band, and the side margins. Overall darkness matches Halloween so the existing
night-UI text stays readable (wallTone: dark, no -light twins; iOS / Android / web fall back to the base wall).

  python3 make-thanksgiving-walls-v2.py [outdir]
  -> <outdir>/wall-<page>[-wide].webp  (1290 x 2796 portrait, 2400 x 1500 wide)   default outdir: this folder
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

# per page: horizon glow accent + the hero silhouette on the skyline
ACCENT = {
    'home':        (255, 136, 48),
    'games':       (255, 118, 36),
    'stats':       (255, 156, 64),
    'friends':     (255, 124, 76),
    'leaderboard': (255, 176, 56),
}
HERO = {'home': 'barn', 'games': 'bales', 'stats': 'tree', 'friends': 'picnic', 'leaderboard': 'scarecrow'}

# time of day (founder 10-16: "can we do different wallpapers to match the time of day?"). 'night' is the shipped
# v2 look and stays byte-identical; the others keep the SAME scene and swap only sky, light source, clouds, haze,
# silhouette ink, field color and whether the windows glow. See ../../time-of-day/NOTES.md for the schedule.
TOD = {
    'morning': dict(
        sky=[(0, (96, 126, 178)), (0.38, (158, 176, 210)), (0.62, (226, 194, 192)), (0.80, (250, 210, 172)), (1, (252, 200, 150))],
        horizon=((255, 220, 176), 0.72), horizon2=((255, 244, 220), 0.5),
        sun=dict(pos=(0.30, -0.055), r=84, col=(255, 232, 168), core=(255, 250, 214), halo1=((255, 178, 92), 0.62, 4.8), halo2=((255, 214, 140), 0.72, 2.1), haze=0.55),
        clouds='wisps', stars=0, geese=5,
        ink=(66, 44, 60), hill_far=(188, 160, 142), hill_near=(156, 122, 96),
        windows=0.0, mist=((244, 230, 222), 1.6), mist2=((246, 232, 224), 0.22), vignette=0.10),
    'day': dict(
        sky=[(0, (56, 122, 214)), (0.45, (118, 176, 236)), (0.75, (184, 216, 244)), (1, (214, 230, 242))],
        horizon=((236, 236, 224), 0.5), horizon2=((255, 250, 232), 0.35),
        sun=dict(pos=(0.74, 0.072), r=82, col=(255, 252, 236), halo1=((255, 246, 200), 0.5, 4.0), halo2=((255, 255, 240), 0.7, 1.8), haze=0.0),
        clouds='cumulus', stars=0, geese=7,
        ink=(58, 40, 36), hill_far=(190, 160, 84), hill_near=(160, 130, 58),
        windows=0.0, mist=((240, 236, 220), 0.5), mist2=((238, 230, 210), 0.08), vignette=0.10),
    'evening': dict(
        sky=[(0, (50, 26, 66)), (0.36, (122, 56, 82)), (0.66, (214, 112, 70)), (0.86, (248, 164, 84)), (1, (252, 196, 116))],
        horizon=((255, 176, 72), 0.85), horizon2=((255, 226, 150), 0.6),
        sun=dict(pos=(0.74, 0.072), r=104, col=(255, 206, 128), halo1=((255, 138, 56), 0.5, 4.4), halo2=((255, 196, 116), 0.6, 1.9), haze=0.0),
        clouds='streaks', stars=0.35, geese=7,
        ink=(30, 12, 20), hill_far=(126, 66, 50), hill_near=(92, 44, 40),
        windows=0.75, mist=((240, 190, 140), 1.0), mist2=((224, 166, 124), 0.10), vignette=0.16),
}


# ---------- helpers (same engine as the Halloween v2 script) ----------
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
    x, y = round(cx * SS - a.width / 2), round(cy * SS - a.height / 2)
    if alpha >= 1:
        mask.paste(255, (x, y), a)
    else:
        mask.paste(Image.new('L', a.size, int(255 * alpha)), (x, y), a)


def S(px, py):
    return (px * SS, py * SS)


def box(d, x0, y0, x1, y1, ellipse=False):
    """rectangle / ellipse at SS scale with the corners sorted (mirrored shapes pass them reversed)"""
    xy = [*S(min(x0, x1), min(y0, y1)), *S(max(x0, x1), max(y0, y1))]
    (d.ellipse if ellipse else d.rectangle)(xy, fill=255)


def thick_curve(d, pts, w0, w1, steps=18):
    """tapered stroke along a quadratic bezier (p0, c, p1), widths w0 -> w1, drawn at SS scale"""
    (x0, y0), (cx, cy), (x1, y1) = pts
    prev = None
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1
        wd = w0 + (w1 - w0) * t
        if prev:
            d.line([S(*prev), S(x, y)], fill=255, width=max(1, round(wd * SS)))
        r = wd / 2
        d.ellipse([*S(x - r, y - r), *S(x + r, y + r)], fill=255)
        prev = (x, y)


def moon_disc(base, cx, cy, r, col, shade, rnd):
    """a lit moon with soft craters (limb darkening toward the lower left)"""
    h, w = base.shape[:2]
    yy, xx = np.ogrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    a = np.clip(r + 0.8 - dist, 0, 1).astype(np.float32)
    lim = np.clip(((xx - cx) * -0.5 + (yy - cy) * 0.7) / r, 0, 1).astype(np.float32)
    disc = np.array(col, np.float32) * (1 - 0.18 * lim[..., None]) + np.zeros_like(base)
    for _ in range(7):
        ang, rr = rnd.uniform(0, 6.28), rnd.uniform(0.1, 0.7) * r
        ccx, ccy, cr = cx + math.cos(ang) * rr, cy + math.sin(ang) * rr, rnd.uniform(0.07, 0.18) * r
        cd = np.sqrt((xx - ccx) ** 2 + (yy - ccy) ** 2)
        ca = (np.clip(1 - cd / cr, 0, 1) ** 0.6 * 0.22).astype(np.float32)[..., None]
        disc = disc * (1 - ca) + np.array(shade, np.float32) * ca
    return over(base, disc, a)


def sun_disc(base, cx, cy, r, col, core=None):
    """a plain sun disc with a soft limb (no craters); 'core' = a brighter center so a low hazy sun reads as a
    solid ball instead of a ring (10-16 morning fix)"""
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
    """soft daytime clouds in the top ~55%: 'cumulus' (puffy, white), 'wisps' (thin, pink-lit), 'streaks' (amber)"""
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
        base = over(base, (206, 216, 232), np.clip(under, 0, 1) * 0.55)
        base = over(base, (255, 255, 255), soft * 0.92)
    elif kind == 'wisps':
        for fx, fy, ln in ((0.22, 0.30, 0.9), (0.62, 0.40, 0.7), (0.38, 0.52, 0.6), (0.78, 0.58, 0.5)):
            cx, cy, cw = fx * w, fy * h, 520 * s * ln
            for i in range(5):
                ox = (i - 2) * cw * 0.22 + rnd.uniform(-20, 20) * s
                rx, ry = cw * rnd.uniform(0.18, 0.3), (10 + 6 * rnd.random()) * s
                ld.ellipse([cx + ox - rx, cy - ry + i * 2 * s, cx + ox + rx, cy + ry + i * 2 * s], fill=255)
        soft = np.asarray(lay.filter(ImageFilter.GaussianBlur(14 * s))).astype(np.float32) / 255
        base = over(base, (255, 226, 214), np.clip(soft * 1.3, 0, 1) * 0.7)
    else:  # streaks
        for fx, fy, ln in ((0.30, 0.44, 1.0), (0.66, 0.54, 0.8), (0.22, 0.62, 0.7)):
            cx, cy, cw = fx * w, fy * h, 640 * s * ln
            for i in range(4):
                ox = (i - 1.5) * cw * 0.24
                rx, ry = cw * rnd.uniform(0.2, 0.32), (8 + 7 * rnd.random()) * s
                ld.ellipse([cx + ox - rx, cy - ry, cx + ox + rx, cy + ry], fill=255)
                sd.ellipse([cx + ox - rx * 0.9, cy + ry * 0.3, cx + ox + rx * 0.9, cy + ry * 1.3], fill=255)
        soft = np.asarray(lay.filter(ImageFilter.GaussianBlur(10 * s))).astype(np.float32) / 255
        under = np.asarray(shade.filter(ImageFilter.GaussianBlur(14 * s))).astype(np.float32) / 255
        base = over(base, (120, 50, 70), np.clip(under, 0, 1) * 0.35)
        base = over(base, (255, 196, 140), np.clip(soft * 1.2, 0, 1) * 0.75)
    return base


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


# ---------- silhouettes ----------
def goose(d, x, y, L, flap, heading=1):
    """flying goose, side view, heading +x (heading=-1 mirrors). flap in [-1, 1]: -1 wing down, 1 wing up."""
    def P(px, py):
        return S(x + heading * px * L, y + py * L)
    bx0, by0 = x + heading * -0.50 * L, y - 0.12 * L
    bx1, by1 = x + heading * 0.42 * L, y + 0.12 * L
    box(d, bx0, by0, bx1, by1, ellipse=True)
    d.polygon([P(-0.46, -0.07), P(-0.46, 0.07), P(-0.70, 0.015)], fill=255)                    # tail
    d.line([P(0.36, -0.03), P(0.76, -0.14)], fill=255, width=max(1, round(0.10 * L * SS)))      # neck
    box(d, x + heading * 0.70 * L, y - 0.23 * L, x + heading * 0.88 * L, y - 0.05 * L, ellipse=True)  # head
    d.polygon([P(0.86, -0.17), P(0.86, -0.10), P(1.00, -0.125)], fill=255)                      # bill
    # one swept wing from a pivot on the back; angle from "straight back" (0) up to ~110 degrees
    ang = math.radians(35 + 80 * (flap + 1) / 2) if flap >= -0.2 else math.radians(-20 - 45 * (-flap))
    px, py = 0.04, -0.02
    ln = 0.66
    tip = (px - math.cos(ang) * ln, py - math.sin(ang) * ln)
    ux, uy = (tip[0] - px) / ln, (tip[1] - py) / ln
    nx, ny = -uy, ux                                                   # perpendicular (toward the front)
    mid1 = (px + ux * 0.45 * ln + nx * 0.10, py + uy * 0.45 * ln + ny * 0.10)
    mid2 = (px + ux * 0.58 * ln - nx * 0.08, py + uy * 0.58 * ln - ny * 0.08)
    d.polygon([P(0.18, -0.02), P(*mid1), P(*tip), P(*mid2), P(-0.14, -0.01), P(0.0, 0.06)], fill=255)


def geese_v(d, w, h, lead, L, n, rnd, heading=1, spread=0.46):
    """a V flock: lead goose at fraction (fx, fy), two arms trailing behind. Returns nothing (draws into d)."""
    lx, ly = lead[0] * w, lead[1] * h
    goose(d, lx, ly, L, rnd.uniform(-0.3, 0.8), heading)
    per_arm = (n - 1) // 2
    for arm, dy in ((0, -1), (1, 1)):
        for i in range(1, per_arm + 1 + (1 if arm == 1 and (n - 1) % 2 else 0)):
            gx = lx - heading * i * L * 0.92 + rnd.uniform(-0.05, 0.05) * L
            gy = ly + dy * i * L * spread * (0.78 if arm == 0 else 1.0) + rnd.uniform(-0.06, 0.06) * L
            goose(d, gx, gy, L * rnd.uniform(0.86, 1.0), rnd.uniform(-1, 1), heading)


def corn_stalk(d, x, y, height, rnd, lean=0.0):
    """tall corn stalk: stem, drooping leaves alternating sides, an ear, a tassel. base at (x, y)."""
    top = (x + lean * height * 0.35, y - height)
    thick_curve(d, [(x, y), (x + lean * height * 0.12, y - height * 0.5), top], height * 0.035, height * 0.014)
    for i in range(6):
        t = 0.18 + i * 0.12
        side = -1 if i % 2 else 1
        sx = x + lean * height * 0.35 * t ** 1.6
        sy = y - height * t
        reach = height * rnd.uniform(0.26, 0.36) * (1.0 - t * 0.35)
        ex, ey = sx + side * reach, sy - reach * 0.12 + reach * 0.42   # tip drops below the shoulder
        cx, cy = sx + side * reach * 0.55, sy - reach * 0.55
        thick_curve(d, [(sx, sy), (cx, cy), (ex, ey)], height * 0.038, height * 0.005)
    ex, ey = x + lean * height * 0.08 + height * 0.035, y - height * 0.52            # the ear
    d.ellipse([*S(ex - height * 0.035, ey - height * 0.11), *S(ex + height * 0.035, ey + height * 0.09)], fill=255)
    d.polygon([S(ex - height * 0.01, ey - height * 0.11), S(ex + height * 0.025, ey - height * 0.10), S(ex + height * 0.045, ey - height * 0.19)], fill=255)
    for k in range(5):                                                               # tassel
        a = math.pi / 2 + (k - 2) * 0.32 + rnd.uniform(-0.08, 0.08)
        ln = height * rnd.uniform(0.09, 0.14)
        d.line([S(*top), S(top[0] + math.cos(a) * ln, top[1] - math.sin(a) * ln)], fill=255, width=max(1, round(height * 0.012 * SS)))


def wheat_cluster(d, x, y, height, n, rnd, spread=0.22):
    """n wheat stems fanning from the ground at x, heads as stacked grains"""
    for i in range(n):
        a = (i - (n - 1) / 2) * spread / max(1, n - 1) * 2 + rnd.uniform(-0.03, 0.03)
        hh = height * rnd.uniform(0.78, 1.0)
        tx, ty = x + math.sin(a) * hh, y - math.cos(a) * hh
        d.line([S(x + rnd.uniform(-3, 3), y), S(tx, ty)], fill=255, width=max(1, round(hh * 0.016 * SS)))
        gl = hh * 0.22
        for k in range(6):
            t = k / 6
            gx, gy = tx - math.sin(a) * gl * t, ty + math.cos(a) * gl * t
            r = hh * 0.022
            d.ellipse([*S(gx - r * 1.4, gy - r), *S(gx + r * 1.4, gy + r)], fill=255)
            d.line([S(gx, gy), S(gx + math.sin(a + 0.35) * hh * 0.07, gy - math.cos(a + 0.35) * hh * 0.07)], fill=255, width=max(1, round(hh * 0.006 * SS)))


def rail_fence(d, x0, x1, y, s):
    """split-rail fence: posts with two rails, no spikes"""
    p = 60 * s
    hgt = 40 * s
    for ry in (0.80, 0.42):
        d.rectangle([x0 * SS, (y - hgt * ry) * SS, x1 * SS, (y - hgt * ry + 4.5 * s) * SS], fill=255)
    xx = x0
    while xx <= x1 + 1:
        d.rectangle([(xx - 3.4 * s) * SS, (y - hgt) * SS, (xx + 3.4 * s) * SS, y * SS], fill=255)
        xx += p


def pumpkin_plain(d, x, y, r):
    """uncarved pumpkin resting on ground y"""
    cy = y - r * 0.82
    for dx, rx in ((-0.42, 0.62), (0.42, 0.62), (0, 0.66)):
        d.ellipse([*S(x + dx * r - rx * r, cy - 0.82 * r), *S(x + dx * r + rx * r, cy + 0.82 * r)], fill=255)
    d.polygon([S(x - 0.08 * r, cy - 0.7 * r), S(x + 0.1 * r, cy - 0.7 * r), S(x + 0.2 * r, cy - 1.05 * r), S(x + 0.06 * r, cy - 1.08 * r)], fill=255)


def hay_bale(d, x, y, r):
    """round bale on its side (a disc), with a hint of the wrapped twine as a thin notch"""
    d.ellipse([*S(x - r, y - 1.9 * r), *S(x + r, y)], fill=255)


def lantern(d, gd, x, y, s):
    """small barn lantern standing on ground y; the pane glows"""
    d.rectangle([*S(x - 12 * s, y - 40 * s), *S(x + 12 * s, y)], fill=255)
    d.rectangle([*S(x - 15 * s, y - 46 * s), *S(x + 15 * s, y - 40 * s)], fill=255)
    d.polygon([S(x - 9 * s, y - 46 * s), S(x + 9 * s, y - 46 * s), S(x + 3 * s, y - 56 * s), S(x - 3 * s, y - 56 * s)], fill=255)
    d.arc([*S(x - 9 * s, y - 70 * s), *S(x + 9 * s, y - 52 * s)], 180, 360, fill=255, width=max(1, round(2.2 * s * SS)))
    gd.rectangle([*S(x - 8 * s, y - 36 * s), *S(x + 8 * s, y - 8 * s)], fill=255)


def barn(d, glowd, x, y, s, rnd):
    """red-barn farmhouse: gambrel roof, cupola, big door, loft window, a silo on the right. Lit into glowd."""
    bw, bh = 190 * s, 96 * s
    L, R, T = x - bw / 2, x + bw / 2, y - bh
    d.rectangle([*S(L, T), *S(R, y)], fill=255)
    # gambrel roof (two pitches) with an overhang
    d.polygon([S(L - 12 * s, T + 2 * s), S(L + 10 * s, T - 52 * s), S(x, T - 82 * s), S(R - 10 * s, T - 52 * s), S(R + 12 * s, T + 2 * s)], fill=255)
    # cupola + weathervane
    d.rectangle([*S(x - 12 * s, T - 104 * s), *S(x + 12 * s, T - 78 * s)], fill=255)
    d.polygon([S(x - 16 * s, T - 104 * s), S(x + 16 * s, T - 104 * s), S(x, T - 118 * s)], fill=255)
    d.line([S(x, T - 118 * s), S(x, T - 136 * s)], fill=255, width=round(2.4 * s * SS))
    d.line([S(x - 10 * s, T - 130 * s), S(x + 10 * s, T - 130 * s)], fill=255, width=round(2.2 * s * SS))
    d.polygon([S(x + 2 * s, T - 137 * s), S(x + 14 * s, T - 133 * s), S(x + 2 * s, T - 129 * s)], fill=255)  # arrow
    # silo
    sx, sr = R + 36 * s, 24 * s
    d.rectangle([*S(sx - sr, T - 70 * s), *S(sx + sr, y)], fill=255)
    d.ellipse([*S(sx - sr, T - 70 * s - sr * 0.9), *S(sx + sr, T - 70 * s + sr * 0.9)], fill=255)
    d.rectangle([*S(sx - 4 * s, T - 70 * s - sr * 1.2), *S(sx + 4 * s, T - 70 * s - sr * 0.8)], fill=255)
    # lit openings: big door (barn doors slightly open), two low windows, hayloft window, cupola vents
    glowd.rectangle([*S(x - 14 * s, y - 56 * s), *S(x + 14 * s, y - 2 * s)], fill=255)
    for wx in (L + 34 * s, R - 34 * s):
        glowd.rectangle([*S(wx - 9 * s, T + 36 * s), *S(wx + 9 * s, T + 54 * s)], fill=255)
    glowd.polygon([S(x - 11 * s, T - 46 * s), S(x + 11 * s, T - 46 * s), S(x + 11 * s, T - 24 * s), S(x, T - 16 * s), S(x - 11 * s, T - 24 * s)], fill=255)
    glowd.rectangle([*S(x - 5 * s, T - 100 * s), *S(x + 5 * s, T - 86 * s)], fill=255)
    if rnd.random() < 0.6:
        glowd.rectangle([*S(sx - 5 * s, T - 40 * s), *S(sx + 5 * s, T - 30 * s)], fill=255)


def scarecrow(d, x, y, s, rnd):
    """scarecrow on a post: hat, round head, coat with sleeves along the crossbar, straw cuffs, one crow"""
    post_h = 210 * s
    d.rectangle([*S(x - 5 * s, y - post_h), *S(x + 5 * s, y)], fill=255)
    cb = y - post_h + 70 * s                                                       # crossbar height
    d.rectangle([*S(x - 92 * s, cb - 5 * s), *S(x + 92 * s, cb + 5 * s)], fill=255)
    # coat: torso below the crossbar, flared hem, sleeves wrapped around the bar
    d.polygon([S(x - 34 * s, cb - 10 * s), S(x + 34 * s, cb - 10 * s), S(x + 46 * s, cb + 92 * s), S(x - 46 * s, cb + 92 * s)], fill=255)
    for side in (-1, 1):
        d.polygon([S(x + side * 30 * s, cb - 14 * s), S(x + side * 88 * s, cb - 10 * s), S(x + side * 96 * s, cb + 12 * s),
                   S(x + side * 30 * s, cb + 16 * s)], fill=255)
        for k in range(5):                                                           # straw at the cuffs + hem
            a = rnd.uniform(-0.45, 0.45)
            ln = rnd.uniform(16, 28) * s
            cx, cy = x + side * 96 * s, cb + 2 * s
            d.line([S(cx, cy), S(cx + side * math.cos(a) * ln, cy + math.sin(a) * ln)], fill=255, width=max(1, round(2 * s * SS)))
    for k in range(9):
        a = rnd.uniform(-0.6, 0.6)
        ln = rnd.uniform(14, 26) * s
        hx = x + rnd.uniform(-40, 40) * s
        d.line([S(hx, cb + 90 * s), S(hx + math.sin(a) * ln, cb + 90 * s + math.cos(a) * ln)], fill=255, width=max(1, round(2 * s * SS)))
    # head, neck, hat
    hy = cb - 44 * s
    d.ellipse([*S(x - 26 * s, hy - 26 * s), *S(x + 26 * s, hy + 26 * s)], fill=255)
    d.rectangle([*S(x - 8 * s, hy + 20 * s), *S(x + 8 * s, cb - 6 * s)], fill=255)
    d.polygon([S(x - 48 * s, hy - 18 * s), S(x + 48 * s, hy - 18 * s), S(x + 40 * s, hy - 26 * s), S(x - 40 * s, hy - 26 * s)], fill=255)
    d.polygon([S(x - 26 * s, hy - 24 * s), S(x + 26 * s, hy - 24 * s), S(x + 20 * s, hy - 66 * s), S(x - 24 * s, hy - 62 * s)], fill=255)
    # one crow perched on the left arm
    cx, cy = x - 84 * s, cb - 8 * s
    d.ellipse([*S(cx - 14 * s, cy - 18 * s), *S(cx + 12 * s, cy)], fill=255)
    d.ellipse([*S(cx + 4 * s, cy - 28 * s), *S(cx + 18 * s, cy - 14 * s)], fill=255)
    d.polygon([S(cx + 16 * s, cy - 23 * s), S(cx + 16 * s, cy - 18 * s), S(cx + 28 * s, cy - 20 * s)], fill=255)
    d.polygon([S(cx - 12 * s, cy - 12 * s), S(cx - 30 * s, cy - 20 * s), S(cx - 28 * s, cy - 8 * s)], fill=255)


def harvest_tree(d, x, y, height, rnd, lean=0.0):
    """a round, leafed harvest tree: flared trunk, a few boughs, a canopy of overlapping ellipses"""
    tw = height * 0.07
    d.polygon([S(x - tw * 1.7, y), S(x + tw * 1.7, y), S(x + tw * 0.55, y - height * 0.3), S(x - tw * 0.55, y - height * 0.3)], fill=255)
    cx, cy = x + lean * height * 0.1, y - height * 0.62
    for i in range(3):
        a = math.pi / 2 + (i - 1) * 0.6 + lean
        thick_curve(d, [(x, y - height * 0.28), (x + math.cos(a) * height * 0.12, y - height * 0.45),
                        (cx + math.cos(a) * height * 0.22, cy + math.sin(a) * -height * 0.1)], tw * 0.8, tw * 0.3)
    blobs = [(0, 0, 0.36, 0.30), (-0.26, 0.08, 0.26, 0.22), (0.27, 0.06, 0.27, 0.23), (-0.12, -0.2, 0.26, 0.2),
             (0.14, -0.22, 0.25, 0.2), (0.0, -0.33, 0.2, 0.15), (-0.34, -0.06, 0.18, 0.15), (0.36, -0.08, 0.18, 0.15)]
    for bx, by, rx, ry in blobs:
        jx, jy = rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02)
        d.ellipse([*S(cx + (bx + jx) * height - rx * height, cy + (by + jy) * height - ry * height),
                   *S(cx + (bx + jx) * height + rx * height, cy + (by + jy) * height + ry * height)], fill=255)


def picnic_table(d, gd, x, y, s):
    """A-frame picnic table with two benches; a lantern on top (pane lit into gd)"""
    top_y = y - 70 * s
    d.rectangle([*S(x - 110 * s, top_y - 8 * s), *S(x + 110 * s, top_y + 4 * s)], fill=255)
    for side in (-1, 1):
        box(d, x + side * 100 * s, y - 36 * s, x + side * 160 * s, y - 28 * s)   # benches
        d.line([S(x + side * 60 * s, top_y), S(x + side * 118 * s, y)], fill=255, width=round(7 * s * SS))   # A legs
        d.line([S(x + side * 60 * s, top_y), S(x + side * 40 * s, y)], fill=255, width=round(7 * s * SS))
    d.rectangle([*S(x - 100 * s, y - 20 * s), *S(x + 100 * s, y - 13 * s)], fill=255)                     # brace
    lantern(d, gd, x + 64 * s, top_y - 8 * s, s * 0.8)


# ---------- the wall ----------
def harvest(size, page, tod='night', flyers=False):
    """flyers: bake the V of geese into the sky. Founder 10-16: the geese FLY now (the living wallpaper's `flock`,
    sprite ambient-goose from make-goose-sprite.py, same goose() drawing), so the shipped walls leave the sky empty;
    True only for the static mockups. Off or on, every other pixel is byte-identical (the geese are the last thing
    drawn from the random stream)."""
    w, h = size
    seed = seed_of('harvest', page, w)
    rnd = random.Random(seed)
    portrait = h > w
    s = min(w, h) / 1290 * (1.0 if portrait else 1.25)
    acc = ACCENT[page]
    T = TOD.get(tod)      # None = night (the shipped v2 look)
    horizon = h * (0.815 if portrait else 0.80)
    if T is None:
        # dusk sky: deep plum up top, wine in the middle, burnt orange at the horizon (Halloween: violet -> plum)
        base = vgrad(h, w, [(0, (14, 7, 26)), (0.45, (38, 14, 44)), (0.75, (78, 28, 44)), (1, (112, 42, 34))])
        base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), acc, 0.85)
        base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), (255, 206, 120), 0.55)
        # title zone (top ~18-28%): a soft dusk-amber band so the brown-rimmed Thanksgiving lettering keeps its edge
        # against the plum sky (art review 10-16). Wide, soft, no visible edge; the center stays calm.
        if portrait:
            base = glow(base, w * 0.5, h * 0.21, w * 0.80, h * 0.105, (184, 96, 70), 0.38, 1.3)
        else:
            base = glow(base, w * 0.5, h * 0.16, w * 0.85, h * 0.14, (184, 96, 70), 0.33, 1.3)
    else:
        base = vgrad(h, w, T['sky'])
        base = glow(base, w * 0.5, horizon, w * 0.9, h * (0.16 if portrait else 0.30), *T['horizon'])
        base = glow(base, w * 0.5, horizon + h * 0.01, w * 0.5, h * (0.06 if portrait else 0.12), *T['horizon2'])
    # soft stars, top half only, fewer than Halloween's (daytime: none; evening: a few faint ones up top)
    star_k = 1.0 if T is None else T['stars']
    st = Image.new('L', (w, h), 0)
    sd = ImageDraw.Draw(st)
    for _ in range(int(w * h / 14000)):
        x, y = rnd.uniform(0, w), h * rnd.uniform(0, 0.60) ** 1.5
        r = rnd.choice([1.3, 1.6, 2.0, 2.4])
        sd.ellipse([x - r, y - r, x + r, y + r], fill=int(rnd.uniform(50, 190) * (1 - y / (h * 0.66)) * star_k * (1 if star_k == 1 else max(0, 1 - y / (h * 0.25)))))
    if star_k:
        base = over(base, (255, 240, 215), np.asarray(st.filter(ImageFilter.GaussianBlur(0.9))).astype(np.float32) / 255)
    if T is None:
        # big warm harvest moon, top right, with a wide amber halo
        mx, my, mr = (w * 0.74, h * 0.072, 122 * s) if portrait else (w * 0.85, h * 0.17, 124 * s)
        base = glow(base, mx, my, mr * 4.4, mr * 4.4, (255, 128, 50), 0.46, 1.2)
        base = glow(base, mx, my, mr * 1.9, mr * 1.9, (255, 190, 110), 0.58, 1.4)
        base = moon_disc(base, mx, my, mr, (255, 200, 118), (228, 136, 70), rnd)
    else:
        # the sun: morning low over the left field (hazy), day high where the moon sits, evening low at the right
        sun = T['sun']
        fx, fy = sun['pos']
        if not portrait and fy < 0:
            fx = 0.22
        mx, my, mr = w * fx, (horizon + fy * h if fy < 0 else h * fy), sun['r'] * s
        if fy >= 0 and not portrait:
            mx, my = w * 0.85, h * 0.17
        c1, k1, p1 = sun['halo1']
        c2, k2, p2 = sun['halo2']
        if sun['haze']:   # low sun: a milky haze band across the horizon, laid down BEFORE the sun so the disc stays
            base = glow(base, w * 0.5, horizon - h * 0.015, w * 0.9, h * 0.05, (250, 236, 226), sun['haze'], 1.0)   # a solid ball
        base = glow(base, mx, my, mr * p1, mr * p1, c1, k1, 1.2)
        base = glow(base, mx, my, mr * p2, mr * p2, c2, k2, 1.4)
        base = sun_disc(base, mx, my, mr, sun['col'], sun.get('core'))
        base = clouds(base, w, h, s, T['clouds'], random.Random(seed + 7), portrait)
        for _ in range(7):   # keep the rnd stream in step with moon_disc so the scene below is the SAME scene
            rnd.uniform(0, 6.28), rnd.uniform(0.1, 0.7), rnd.uniform(0.07, 0.18)
    # skyline silhouette: two field hills (night: one ink mask; day: far hill, objects, near hill as three layers)
    m, d = mask_layer(w, h)
    g, gd = mask_layer(w, h)
    ys = hill_y(w, h, horizon + 40 * s, 34 * s, seed)
    ys2 = hill_y(w, h, horizon + 110 * s, 22 * s, seed + 1, 1.3)
    if T is None:
        fill_below(d, ys)
        fill_below(d, ys2)
        far_m = near_m = None
    else:
        far_m, fd = mask_layer(w, h)
        fill_below(fd, ys)
        near_m, nd = mask_layer(w, h)
        fill_below(nd, ys2)
    gy = lambda fx: float(ys[min(w - 1, max(0, int(fx * w)))])
    # corn stalks at the outer edges (they reach up the side margins), a wheat cluster at their feet
    corn_stalk(d, w * 0.055, gy(0.055) + 10 * s, 520 * s, rnd, lean=0.10)
    corn_stalk(d, w * 0.945, gy(0.945) + 10 * s, 500 * s, rnd, lean=-0.10)
    if portrait:   # a second stalk beside each edge stalk (the wide wall gets its pair at 0.20 / 0.80 instead)
        corn_stalk(d, w * 0.10, gy(0.10) + 12 * s, 400 * s, rnd, lean=-0.05)
        corn_stalk(d, w * 0.90, gy(0.90) + 12 * s, 380 * s, rnd, lean=0.06)
    wheat_cluster(d, w * 0.14, gy(0.14) + 14 * s, 150 * s, 7, rnd)
    wheat_cluster(d, w * 0.86, gy(0.86) + 14 * s, 140 * s, 6, rnd)
    if not portrait:
        corn_stalk(d, w * 0.20, gy(0.20) + 10 * s, 300 * s, rnd, lean=0.08)
        corn_stalk(d, w * 0.80, gy(0.80) + 10 * s, 310 * s, rnd, lean=-0.08)
    hero = HERO[page]
    hx = 0.62 if portrait else 0.64
    leaf_m = None
    if hero == 'barn':
        barn(d, gd, w * hx, gy(hx) + 6 * s, s * 1.1, rnd)
    elif hero == 'bales':
        for fx, r in ((0.53, 46), (0.60, 40)):              # two bales touching, a third stacked in the notch
            hay_bale(d, w * fx, gy(fx) + 10 * s, r * s)
        hay_bale(d, w * 0.565, gy(0.565) + 10 * s - 64 * s, 32 * s)
        for fx, r in ((0.42, 24), (0.67, 20), (0.74, 28), (0.47, 16)):
            pumpkin_plain(d, w * fx, gy(fx) + 10 * s, r * s)
        lantern(d, gd, w * 0.785, gy(0.785) + 8 * s, s * 0.9)
    elif hero == 'scarecrow':
        scarecrow(d, w * hx, gy(hx) + 8 * s, s * 1.05, rnd)
    elif hero == 'tree':
        harvest_tree(d, w * 0.68, gy(0.68) + 8 * s, 430 * s, rnd, lean=0.05)
        # falling leaves drifting down the right margin, sparser higher up
        leaf_m, _ = mask_layer(w, h)
        leaves = [prop_alpha('leaf-maple'), prop_alpha('leaf-oak')]
        band_top = (0.42 if portrait else 0.36)
        for i in range(9 if portrait else 11):
            fy = band_top + (gy(0.68) / h - band_top - 0.12) * (i / 8) ** 1.1 + rnd.uniform(-0.01, 0.01)
            fx = (0.70 + rnd.uniform(-0.06, 0.06) + (0.12 if i % 3 == 0 else 0) * (1 if portrait else 0.6)
                  + rnd.uniform(-0.04, 0.04) * i / 8)
            fx = min(0.96, fx)
            stamp(leaf_m, leaves[i % 2], fx * w, fy * h, (26 + 10 * i / 8) * s, rot=rnd.uniform(-70, 70),
                  flip=rnd.random() < 0.5, alpha=0.55 + 0.45 * i / 8)
    else:  # picnic
        picnic_table(d, gd, w * hx, gy(hx) + 8 * s, s * 1.0)
        stamp(m, prop_alpha('cornucopia'), w * (hx - 0.045), gy(hx) + 8 * s - 70 * s - 30 * s, 92 * s)
    # split-rail fence along the near hill
    rail_fence(d, w * 0.18, w * (0.46 if hero != 'scarecrow' else 0.42), gy(0.32) + 14 * s, s)
    if not portrait:
        rail_fence(d, w * 0.72, w * 0.86, gy(0.78) + 14 * s, s)
    sil = down(m, w, h)
    lit = down(g, w, h)
    # geese V in the top band (kept off the stats row and the cast header lettering center); mockups only (flyers=True),
    # the app flies them (ambient `flock`, same lead spot: portrait x 0.46 / y 0.066, L = 72 px of 1290)
    geesem = None
    if flyers:
        bm, bd = mask_layer(w, h)
        n_geese = 7 if T is None else T['geese']
        if portrait:   # lower arm stays right of the stats row box (x < 0.30, y 0.08-0.125), upper arm below the header
            geese_v(bd, w, h, (0.46, 0.066), 72 * s, n_geese, rnd, heading=1, spread=0.30)
        else:   # below the page-title zone, left of the moon, heading for it
            geese_v(bd, w, h, (0.60, 0.29), 72 * s, n_geese + 2, rnd, heading=1, spread=0.30)
        geesem = down(bm, w, h)
    # mist: soft warm band hugging the hills (behind the near silhouette)
    mist = np.zeros((h, w), np.float32)
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    for k in range(3):
        cy0 = horizon + (k * 36 - 20) * s
        wav = np.sin(xx / w * math.pi * (2 + k) + k) * 14 * s
        mist += np.exp(-((yy - cy0 - wav) / (26 * s)) ** 2) * (0.20 - k * 0.04)
    if T is None:
        base = over(base, (236, 182, 130), np.clip(mist, 0, 0.4))
        ink = (16, 7, 16)
        base = over(base, ink, sil)
        obj = sil
    else:
        mc, mk = T['mist']
        base = over(base, mc, np.clip(mist * mk, 0, 0.6))
        far = down(far_m, w, h)
        near = down(near_m, w, h)
        ink = T['ink']
        base = over(base, T['hill_far'], far)
        base = over(base, ink, sil)
        base = over(base, T['hill_near'], near)          # the near rise sits in front of the scene
        obj = sil * (1 - near)
    if geesem is not None:
        base = over(base, ink, geesem * 0.92)
    if leaf_m is not None:
        base = over(base, (40, 14, 20) if T is None else ink, down(leaf_m, w, h) * 0.9)
    # lit windows / lantern glow (off by day, warming up at dusk)
    wk = 1.0 if T is None else T['windows']
    if wk:
        halo = np.asarray(Image.fromarray((lit * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10 * s))).astype(np.float32) / 255
        base = over(base, (255, 150, 40), np.clip(halo * 1.4, 0, 0.6) * obj * wk)
        base = over(base, (255, 200, 96), lit * wk)
    # front mist over the hill foot
    m2c, m2k = ((220, 160, 120), 0.10) if T is None else T['mist2']
    mist2 = np.exp(-((yy - (horizon + 40 * s)) / (40 * s)) ** 2) * m2k
    base = over(base, m2c, mist2 * np.ones((1, w), np.float32))
    xx1 = np.linspace(-1, 1, w, dtype=np.float32)[None, :, None]
    base *= 1 - (0.16 if T is None else T['vignette']) * xx1 ** 4
    return finish(base, seed)


if __name__ == '__main__':
    flyers = '--flyers' in sys.argv   # bake the geese (static mockups only; the shipped walls leave them to the app)
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else HERE
    os.makedirs(out, exist_ok=True)
    for page in PAGES:
        for size, suf in ((PORTRAIT, ''), (WIDE, '-wide')):
            harvest(size, page, flyers=flyers).save(os.path.join(out, f'wall-{page}{suf}.webp'), 'WEBP', quality=92, method=6)
            print(page, suf or 'portrait')
