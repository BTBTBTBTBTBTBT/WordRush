"""Integrated accessory builders (10-04). Each builder takes a body id (+ colors) and returns the layers for
rig.compose(): back (behind, AO-clipped), front (on the body, face/letter-guarded, contact-shadowed),
held (gripped: drawn under the hand-over layer), head.

Source pixels are the existing ChatGPT art (cut/acc-*.png); the integration is code: per-body anchors and
scale, warps that follow the body, front/back splits, hand-over grips, contact shadow, AO and re-lighting.
"""
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
from rig import (AV, CW, M, U, P, MAN, rig, load, trim, tint, place, light_match, face_letter_mask, place_part,
                 draw_letter, COLORS, hexrgb, soft, shade)
import os
from functools import lru_cache

CUT = os.path.join(AV, 'cut')


def cut(name):
    return trim(load(os.path.join(CUT, f'acc-{name}.png')))


# ── body measurements ────────────────────────────────────────────────────────

@lru_cache(None)
def guards(body):
    """(mouth+eyes mask, letter mask) as bool canvas arrays."""
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    place_part(c, 'eyes:beady', b)
    place_part(c, 'mouth:smile', b)
    face = np.asarray(c.getchannel('A')) > 40
    c2 = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    draw_letter(c2, b, 'W')   # the widest initial
    draw_letter(c2, b, 'M')
    letter = np.asarray(c2.getchannel('A')) > 40
    return face, letter


@lru_cache(None)
def neck_band(body, thick=0.085, margin=0.012):
    """The wrap line: per column, the top/bottom rows a neck wrap may use (between the mouth and the letter,
    fuller at the sides where nothing is in the way), smoothed so the wrap reads as soft fabric.
    Returns (x0, x1, top[], bot[]) in canvas px."""
    R = rig(body)
    A = R['A']
    face, letter = guards(body)
    b = R['b']
    mg = int(margin * U)
    fy = np.nonzero(face.any(1))[0]
    ly = np.nonzero(letter.any(1))[0]
    mouth_bot = fy.max()
    letter_top = ly.min()
    yc = (mouth_bot + letter_top) / 2
    row = np.nonzero(A[int(yc)])[0]
    x0, x1 = row.min(), row.max()
    xs = np.arange(x0, x1 + 1)
    half = thick * U / 2
    top = np.full(len(xs), yc - half)
    bot = np.full(len(xs), yc + half)
    for i, x in enumerate(xs):
        fcol = np.nonzero(face[:, x])[0]
        fcol = fcol[fcol < yc + 2]
        if len(fcol):
            top[i] = max(top[i], fcol.max() + mg)
        lcol = np.nonzero(letter[:, x])[0]
        lcol = lcol[lcol > yc - 2]
        if len(lcol):
            bot[i] = min(bot[i], lcol.min() - mg)
    # smooth (fabric, not a cut-out)
    k = int(0.06 * U) | 1
    ker = np.ones(k) / k
    pad = k // 2
    top = np.convolve(np.pad(top, pad, mode='edge'), ker, 'valid')
    bot = np.convolve(np.pad(bot, pad, mode='edge'), ker, 'valid')
    # min thickness
    mid = (top + bot) / 2
    t = np.maximum(bot - top, 0.018 * U)
    # a gentle smile: the wrap dips toward the middle (it rounds the front of the body)
    u = (xs - (x0 + x1) / 2) / ((x1 - x0) / 2)
    return x0, x1, mid - t / 2 + 0 * u, mid + t / 2


def warp_to_band(tex, x0, x1, top, bot, A, wrap_shade=True, overhang=0.012):
    """Map a horizontal strip texture into the band, then shade it as a cylinder wrap (darker where it turns
    away around the body's sides) and let it overhang the silhouette a hair (it goes AROUND, not on)."""
    n = len(top)
    Hmax = int(max(bot - top)) + 2
    texr = cv2.resize(np.asarray(tex), (n, Hmax), interpolation=cv2.INTER_AREA)
    out = np.zeros((CW, CW, 4), np.uint8)
    ys = np.arange(CW)
    for i in range(n):
        x = x0 + i
        t0, t1 = top[i], bot[i]
        if t1 - t0 < 1:
            continue
        sel = (ys >= t0) & (ys <= t1)
        v = ((ys[sel] - t0) / (t1 - t0) * (Hmax - 1)).astype(int)
        out[sel, x] = texr[v, i]
    im = out.astype(np.float32)
    if wrap_shade:
        xs = np.arange(CW)
        c, hw = (x0 + x1) / 2, (x1 - x0) / 2
        u = np.clip(np.abs(xs - c) / hw, 0, 1)
        s = 0.58 + 0.42 * np.sqrt(1 - u ** 2)
        im[..., :3] *= s[None, :, None]
    # around the body, not past it: clip to the silhouette grown by the overhang
    from scipy import ndimage
    grow = ndimage.binary_dilation(A, iterations=int(overhang * U))
    im[..., 3] *= grow
    return Image.fromarray(np.clip(im, 0, 255).astype(np.uint8), 'RGBA')


def hand(body, side='R'):
    R = rig(body)
    cx, cy = R['arms'][side]['cu']
    return cx, cy, R['arms'][side]['rx'], R['arms'][side]['ry']


def main_width(body):
    R = rig(body)
    b = R['b']
    l, r = R['span'](P(b['eyeY']))
    return (r - l) / U, (l + r) / 2


def avoid(make, body, step=(0.01, 0.0), tries=12, masks=('face', 'letter'), grip=None):
    """Re-place a layer (make(dx, dy) -> layer) until it covers none of the guarded pixels: the part moves out of
    the way instead of being cut by the mask."""
    face, letter = guards(body)
    g = np.zeros_like(face)
    if 'face' in masks:
        g |= face
    if 'letter' in masks:
        g |= letter
    best = None
    for k in range(tries):
        lay = make(step[0] * k, step[1] * k)
        a = np.asarray(lay.getchannel('A')) > 90
        hit = (a & g).sum()
        if best is None or hit < best[0]:
            best = (hit, lay)
        if hit == 0:
            break
    return best[1]


# ── 1. BACKPACK: pack behind, straps in front over the shoulders, tucked under the arms ─────────────────

def strap_path(body, side):
    R = rig(body)
    A = R['A']
    b = R['b']
    sgn = -1 if side == 'L' else 1
    hx, hy, rx, ry = hand(body, side)
    # shoulder: the first row from the top where the body is ≥ 80% of its width at the eyes
    w_eye, _ = main_width(body)
    ys0 = R['top']
    for y in range(int(ys0), int(P(hy))):
        l, r = R['span'](y)
        if (r - l) / U >= 0.8 * w_eye:
            break
    l, r = R['span'](y)
    edge = (l if side == 'L' else r) / U - 0.5 / U * 0
    edge = (edge * U - M) / U
    sw = min(0.075, 0.2 * w_eye)
    ys = (y - M) / U
    p0 = (edge - sgn * sw * 0.55, ys - 0.035)            # comes over the shoulder from behind
    p1 = (edge - sgn * sw * 1.15, ys + (hy - ys) * 0.45)  # hugs the side, a little in from the edge
    p2 = (hx - sgn * rx * 0.15, hy - ry * 0.1)             # disappears under the hand
    return [p0, p1, p2], sw


def bezier(pts, n=60):
    p0, p1, p2 = [np.array(p) for p in pts]
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2


def draw_strap(pts, sw, color, buckle=True):
    """A padded glossy strap along a curve: dark rim, body, top-left highlight, stitching, a slider buckle."""
    SS = 2
    im = Image.new('RGBA', (CW * SS, CW * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    path = bezier(pts)
    Q = [(P(x) * SS, P(y) * SS) for x, y in path]
    base = np.array(hexrgb(COLORS.get(color, color)), float)
    rim = tuple(int(v) for v in base * 0.62) + (255,)
    body = tuple(int(v) for v in base * 0.92) + (255,)
    hi = tuple(int(v) for v in np.minimum(255, base * 0.6 + 255 * 0.45)) + (255,)
    W = sw * U * SS
    d.line(Q, fill=rim, width=int(W), joint='curve')
    for q in (Q[0], Q[-1]):
        d.ellipse([q[0] - W / 2, q[1] - W / 2, q[0] + W / 2, q[1] + W / 2], fill=rim)
    d.line(Q, fill=body, width=int(W * 0.8), joint='curve')
    # highlight: offset toward the light
    off = np.array([-0.18, -0.1]) * W
    d.line([(x + off[0], y + off[1]) for x, y in Q], fill=hi, width=max(1, int(W * 0.16)), joint='curve')
    im = im.filter(ImageFilter.GaussianBlur(SS * 0.8))
    d = ImageDraw.Draw(im)
    # stitches
    st = tuple(int(v) for v in base * 0.5) + (200,)
    for sgn in (-1, 1):
        pts2 = []
        for i in range(1, len(path)):
            (x0, y0), (x1, y1) = path[i - 1], path[i]
            nx, ny = -(y1 - y0), (x1 - x0)
            L = math.hypot(nx, ny) or 1
            pts2.append((P(x1 + sgn * nx / L * sw * 0.32) * SS, P(y1 + sgn * ny / L * sw * 0.32) * SS))
        for i in range(0, len(pts2) - 1, 3):
            d.line([pts2[i], pts2[i + 1]], fill=st, width=max(1, SS))
    if buckle:
        i = int(len(path) * 0.5)
        (x0, y0), (x1, y1) = path[i - 1], path[i + 1]
        ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
        bw, bh = W * 1.12, W * 0.42
        bk = Image.new('RGBA', (int(bw * 1.6), int(bw * 1.6)), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bk)
        cx, cy = bk.width / 2, bk.height / 2
        bd.rounded_rectangle([cx - bh / 2, cy - bw / 2, cx + bh / 2, cy + bw / 2], radius=bh * 0.35, fill=(206, 212, 222, 255))
        bd.rounded_rectangle([cx - bh / 2 + bh * 0.22, cy - bw / 2 + bh * 0.22, cx + bh / 2 - bh * 0.22, cy + bw / 2 - bh * 0.22], radius=bh * 0.2, fill=(120, 128, 142, 255))
        bd.line([cx - bh / 2 + 2, cy - bw / 2 + bh * 0.3, cx - bh / 2 + 2, cy + bw / 2 - bh * 0.3], fill=(255, 255, 255, 230), width=max(1, int(bh * 0.12)))
        bk = bk.rotate(-ang + 90, Image.BICUBIC)
        X, Y = P(path[i][0]) * SS, P(path[i][1]) * SS
        im.alpha_composite(bk, (int(X - bk.width / 2), int(Y - bk.height / 2)))
    return im.resize((CW, CW), Image.LANCZOS)


def backpack(body, acc='sky'):
    R = rig(body)
    b = R['b']
    w_eye, cxp = main_width(body)
    hl, hr = hand(body, 'L'), hand(body, 'R')
    cx = (hl[0] + hr[0]) / 2
    pack = tint(cut('backpack'), acc)
    pack = light_match(pack, 0.08)
    (p0, _, _), sw = strap_path(body, 'L')
    top = p0[1] - 0.17      # the handle + top of the pack peek above the shoulders
    asp = pack.height / pack.width
    pw = min(0.98, max(0.5, w_eye * 0.95), (hl[1] + 0.08 - top) / asp)   # never hangs below the hands
    back = place(pack, cx, top, pw, anchor=(0.5, 0.0))
    front = []
    for sd in ('L', 'R'):
        pts, _ = strap_path(body, sd)
        sg = -1 if sd == 'L' else 1
        def mk(dx, dy, pts=pts, sg=sg):
            q = [(pts[0][0] + sg * dx * 0.6, pts[0][1]), (pts[1][0] + sg * dx, pts[1][1]), pts[2]]
            return draw_strap(q, sw * max(0.45, 1 - dx * 7), acc)
        front.append(avoid(mk, body, step=(0.007, 0), tries=14))
    return dict(back=[back], front=front, handover=('L', 'R'))


# ── 2. SCARF: a wrap that follows the neck line, around the body (not on it), a tail tucked under the arm ──

def scarf(body):
    R = rig(body)
    A = R['A']
    s = cut('scarf')
    W, H = s.size
    band_tex = s.crop((0, int(H * 0.02), int(W * 0.5), int(H * 0.36)))
    # make it tile wider: mirror-repeat the knit roll
    bt = Image.new('RGBA', (band_tex.width * 2, band_tex.height))
    bt.paste(band_tex, (0, 0)); bt.paste(band_tex.transpose(Image.FLIP_LEFT_RIGHT), (band_tex.width, 0))
    x0, x1, top, bot = neck_band(body, thick=0.10, margin=0.02)
    band = warp_to_band(bt, x0, x1, top, bot, A)
    # the tail (+ fringe) from the original art, hanging over the viewer's-left side, under the left hand
    tail = s.crop((int(W * 0.5), int(H * 0.27), W, H))
    tail = trim(tail)
    face, letter = guards(body)
    lx = np.nonzero(letter.any(0))[0].min()
    edge = x0
    room = (lx - edge) / U
    hx, hy, rx, ry = hand(body, 'L')
    tw = max(0.1, min(0.15, room * 0.9))
    i0 = int(len(top) * 0.16)
    tx = (x0 + i0 - M) / U
    ty = (top[i0] - M) / U + 0.01
    tail = tail.transpose(Image.FLIP_LEFT_RIGHT)
    tail = light_match(tail, 0.06)
    tl = avoid(lambda dx, dy: place(tail, tx - dx, ty, tw * (1 - dx * 2), anchor=(0.5, 0.0), rot=-4), body, step=(0.012, 0))
    return dict(front=[tl, band], handover=(), seat_min=0.25)


# ── 3. CHAIN: links stamped along the wrap line, foreshortened toward the sides, going around ─────────

NO_NECK_ROOM = {'wide', 'mini'}   # mouth and letter nearly touch: a neck wrap would cover one of them


def chain(body):
    if body in NO_NECK_ROOM:
        return dict(unsupported='no neck room between the mouth and the letter')
    R = rig(body)
    A = R['A']
    c = cut('chain')
    W, H = c.size
    link_flat = trim(c.crop((int(W * 0.40), int(H * 0.80), int(W * 0.60), H)))
    x0, x1, top, bot = neck_band(body, thick=0.075)
    mid = (top + bot) / 2
    lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    lw = min(0.1, (x1 - x0) / U / 7)
    # a gentle smile curve
    xs = np.arange(x0, x1 + 1)
    u = (xs - (x0 + x1) / 2) / ((x1 - x0) / 2)
    yline = mid
    x = x0 + lw * U * 0.2
    k = 0
    while x < x1:
        i = int(x - x0)
        uu = u[min(i, len(u) - 1)]
        fs = math.sqrt(max(0.15, 1 - uu ** 2))  # foreshortening toward the sides
        w = lw * U * fs
        lk = link_flat if k % 2 == 0 else link_flat.rotate(90, expand=True).resize((max(1, int(link_flat.width * 0.45)), link_flat.width))
        if k % 2:
            w *= 0.55
        h = w * lk.height / lk.width
        th = (bot[min(i, len(bot) - 1)] - top[min(i, len(top) - 1)]) * 1.0
        if h > th:
            w, h = w * th / h, th
        L = lk.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)
        L = shade(L, np.full((L.height, L.width), 0.62 + 0.38 * fs, np.float32))
        yy = yline[min(i, len(yline) - 1)]
        lay.alpha_composite(L, (int(x - w * 0.1), int(yy - h / 2)))
        x += w * 0.78
        k += 1
    from scipy import ndimage
    a = np.asarray(lay).copy()
    a[..., 3] = a[..., 3] * ndimage.binary_dilation(A, iterations=int(0.01 * U))
    return dict(front=[Image.fromarray(a, 'RGBA')], handover=())


# ── 4/5. HELD: the hand-over layer grips them ──────────────────────────────

def bubbletea(body):
    hx, hy, rx, ry = hand(body, 'R')
    t = light_match(cut('bubbletea'), 0.06)
    w = rx * 2 * 1.5
    held = avoid(lambda dx, dy: place(t, hx + rx * 0.35 + dx, hy + ry * 0.55 - dx * 1.5, w, anchor=(0.5, 0.8), rot=-6), body, step=(0.012, 0), masks=('letter',))
    return dict(held=[held], handover=('R',))


def guitar(body):
    g = cut('guitar')
    # stand it up: headstock up, body down (carried by the neck)
    a = np.asarray(g.getchannel('A')) > 60
    ys, xs = np.nonzero(a)
    cov = np.cov(np.vstack([xs - xs.mean(), ys - ys.mean()]))
    ev, evec = np.linalg.eigh(cov)
    vx, vy = evec[:, -1]
    ang = math.degrees(math.atan2(vy, vx))
    g = g.rotate(ang + 90, Image.BICUBIC, expand=True)
    g = trim(g)
    a = np.asarray(g.getchannel('A')) > 60
    if np.nonzero(a)[0].mean() < g.height / 2:  # body should be at the bottom
        g = g.rotate(180)
    g = trim(g)
    side = 'L' if body == 'bean' else 'R'   # the bean's letter leans right: it carries the guitar on the left
    sg = 1 if side == 'R' else -1
    if side == 'L':
        g = g.transpose(Image.FLIP_LEFT_RIGHT)
    hx, hy, rx, ry = hand(body, side)
    R = rig(body)
    floor = (R['bot'] - M) / U
    Lg = (floor - hy) / 0.62   # the hand holds the neck at ~38% from the top
    w = Lg * g.width / g.height
    g = light_match(g, 0.06)
    held = avoid(lambda dx, dy: place(g, hx + sg * (rx * 0.55 + dx), hy - Lg * 0.36, w, anchor=(0.5, 0.0), rot=sg * (-8 - dx * 60)), body, step=(0.012, 0), tries=20, masks=('letter',))
    return dict(held=[held], handover=(side,))


# ── 6. CAPES: the cape hangs BEHIND from the neck line; a cord + the clasp come around to the front ───

def cape(body, white=False, acc='red'):
    R = rig(body)
    A = R['A']
    b = R['b']
    src = cut('capewhite' if white else 'cape')
    if white:
        src = tint(src, acc)
    W, H = src.size
    x0, x1, top, bot = neck_band(body, thick=0.05)
    yc = float(((top + bot) / 2).mean())
    w_eye, _ = main_width(body)
    floor = (R['bot'] - M) / U
    ytop = (yc - M) / U - 0.14
    hgt = floor - ytop + 0.02
    cw = 1.28 * (x1 - x0) / U + 0.06
    capeL = src.resize((int(cw * U), int(hgt * U)), Image.LANCZOS)
    back = place(light_match(capeL, 0.06), ((x0 + x1) / 2 - M) / U, ytop, cw, anchor=(0.5, 0.0))
    # the cord: a thin rolled band in the cape's color along the wrap line, + the original clasp in the middle
    rgb = np.asarray(src.convert('RGB')).reshape(-1, 3)[np.asarray(src.getchannel('A')).reshape(-1) > 200]
    ccol = '#%02x%02x%02x' % tuple(int(v) for v in np.median(rgb, 0))
    xa, xb, xm = (x0 - M) / U + 0.01, (x1 - M) / U - 0.01, ((x0 + x1) / 2 - M) / U
    midb = (top + bot) / 2
    thick = float((bot - top)[len(top) // 2])
    yat = lambda xu: (midb[int(np.clip(xu * U + M - x0, 0, len(midb) - 1))] - M) / U
    ym = yat(xm)
    cord = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    for p in ([(xa, yat(xa) - 0.02), ((xa + xm) / 2, yat((xa + xm) / 2)), (xm, ym)], [(xb, yat(xb) - 0.02), ((xb + xm) / 2, yat((xb + xm) / 2)), (xm, ym)]):
        cord.alpha_composite(draw_strap(p, min(0.022, thick / U * 0.7), ccol, buckle=False))
    from scipy import ndimage
    ca = np.asarray(cord).copy(); ca[..., 3] = ca[..., 3] * ndimage.binary_dilation(A, iterations=int(0.008 * U)); cord = Image.fromarray(ca, 'RGBA')
    clasp = trim(src.crop((int(W * 0.4), 0, int(W * 0.6), int(H * 0.2))))
    if not white:
        pass
    face, letter = guards(body)
    cl = place(clasp, xm, ym, min(0.1, thick / U * 1.1), anchor=(0.5, 0.5))
    return dict(back=[back], front=[cord, cl], handover=())


REBUILT = {
    'backpack': lambda b: backpack(b, 'sky'),
    'scarf': scarf,
    'chain': chain,
    'bubbletea': bubbletea,
    'guitar': guitar,
    'cape': lambda b: cape(b),
    'supercape': lambda b: cape(b, white=True, acc='blue'),
}
