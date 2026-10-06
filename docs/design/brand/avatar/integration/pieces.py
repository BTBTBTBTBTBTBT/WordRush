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


def avoid(make, body, step=(0.01, 0.0), tries=12, masks=('face', 'letter'), grip=None, pad=0.0):
    """Re-place a layer (make(dx, dy) -> layer) until it covers none of the guarded pixels: the part moves out of
    the way instead of being cut by the mask. pad (body units): keep that much clear space around the face too
    (10-05: the backpack straps crowded the eyes on the narrow bodies)."""
    face, letter = guards(body)
    if pad:
        from scipy import ndimage as _nd
        face = _nd.binary_dilation(face, iterations=max(1, int(pad * U)))
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
            return draw_strap(q, sw * max(0.42, 1 - dx * 7), acc)
        # 10-05: keep a clear gap around the eyes (pad), so on tall / drop / pear / bean / mini the straps get
        # thinner and ride farther out on the shoulder instead of crowding the face
        front.append(avoid(mk, body, step=(0.007, 0), tries=22, pad=0.035))
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
    # 10-05 wrap fix: along the necklace drape (ends tucked behind at cheek height, above the arms), not a hoop
    band, (x0, x1, top, bot) = drape_wrap(bt, body, 0.10, margin=0.02)
    # the tail (+ fringe) from the original art hangs from the drape in the gap between the left arm and the letter
    # (10-05: never over the arm, never over the letter; a body without that gap gets a short stub tail)
    tail = trim(s.crop((int(W * 0.5), int(H * 0.27), W, H)))
    face, letter = guards(body)
    lx = np.nonzero(letter.any(0))[0].min()
    arms = arm_mask(body)
    acols = np.nonzero(arms.any(0))[0]
    ain = acols[acols < P(R['b']['face']['x'])].max() if len(acols) else x0
    gap = (lx - ain) / U
    tw = float(np.clip(gap * 0.8, 0.07, 0.14))
    xc = (ain + lx) / 2
    i0 = int(np.clip(xc - x0, 0, len(top) - 1))
    tx, ty = (xc - M) / U, (top[i0] - M) / U + 0.012
    tail = light_match(tail.transpose(Image.FLIP_LEFT_RIGHT), 0.06)
    tl = avoid(lambda dx, dy: place(tail, tx, ty, tw * (1 - dx * 3), anchor=(0.5, 0.0), rot=-3), body, step=(0.012, 0), tries=10)
    return dict(front=[tl, band], handover=(), seat_min=0.25)


# ── 3. CHAIN: links stamped along the wrap line, foreshortened toward the sides, going around ─────────

NO_NECK_ROOM = {'wide', 'mini'}   # mouth and letter nearly touch: a neck wrap would cover one of them


def chain(body):
    """10-05 wrap fix: a necklace, not a hoop. The links hang along the drape (pieces.drape_path): a soft U under
    the mouth whose ends tuck behind the silhouette at cheek height, above the arms; smaller toward the ends."""
    if body in NO_NECK_ROOM:
        return dict(unsupported='no neck room between the mouth and the letter')
    c = cut('chain')
    W, H = c.size
    link = trim(c.crop((int(W * 0.40), int(H * 0.80), int(W * 0.60), H)))
    link = light_match(link, 0.08)
    return dict(front=[drape_chain(body, link)], handover=())


# ── 10-05 WRAP FIX: the necklace drape. Founder: the chain "went around his arms like a hula hoop". These are
#    head-bodies with no neck, so anything worn at the neck hangs as a soft U under the mouth: its ends tuck BEHIND the
#    silhouette at about cheek height, above + inside the arms (never over them); the bottom of the U sits in the gap
#    between the mouth and the letter. Chain links, cape / collar cords and their clasps all follow this path. ─────

def arm_mask(body, grow=1.18):
    """The arms: the hand ellipses grown a little, plus the column above each one up to the shoulder bulge (the
    arm's root), inside the silhouette. A neck wrap must stay above this."""
    R = rig(body)
    A = R['A']
    yy, xx = np.mgrid[0:CW, 0:CW]
    m = np.zeros((CW, CW), bool)
    for side, (cx, cy, rx, ry) in [(k, (v['cu'][0], v['cu'][1], v['rx'], v['ry'])) for k, v in R['arms'].items()]:
        m |= ((xx - P(cx)) / (rx * U * grow)) ** 2 + ((yy - P(cy)) / (ry * U * grow)) ** 2 <= 1
    return m & A


@lru_cache(None)
def drape_path(body, half=0.016, end_y=None, margin=0.008):
    """The U-shaped necklace line for a body: (xs, ys, us) in canvas px, us = -1 … 1 from end to end (0 = under the
    mouth). Ends at the silhouette edge ~cheek height; clear of the face, the letter and the arms by `margin`."""
    R = rig(body)
    A = R['A']
    b = R['b']
    face, letter = guards(body)
    arms = arm_mask(body)
    mg = margin * U
    hp = half * U
    cxm = P(b['face']['x'])
    fys = np.nonzero(face.any(1))[0]
    ye = P(end_y if end_y is not None else b['cheekY'] - 0.05)
    row = np.nonzero(A[int(ye)])[0]
    xl, xr = row.min(), row.max()
    xs = np.arange(xl, xr + 1).astype(float)
    # bottom of the U: the middle of the mouth–letter gap under the mouth
    col = int(cxm)
    fb = np.nonzero(face[:, col])[0]
    fb = fb[fb < P(b['letterBox'][1])]
    lt = np.nonzero(letter[:, col])[0]
    lt = lt[lt > (fb.max() if len(fb) else ye)]
    yb = ((fb.max() if len(fb) else ye) + (lt.min() if len(lt) else ye + 0.1 * U)) / 2
    us = np.where(xs < cxm, (xs - cxm) / (cxm - xl), (xs - cxm) / (xr - cxm))
    ys = ye + (yb - ye) * (1 - np.abs(us) ** 1.6)
    # per-column limits: below the face, above the letter and the arms
    for i, x in enumerate(xs.astype(int)):
        f = np.nonzero(face[:, x])[0]
        f = f[f < yb + hp]
        lo = (f.max() + mg + hp) if len(f) else -1e9
        l = np.nonzero(letter[:, x])[0]
        l = l[l > ye]
        a = np.nonzero(arms[:, x])[0]
        hi = min([(l.min() - mg - hp) if len(l) else 1e9, (a.min() - mg - hp) if len(a) else 1e9])
        y = ys[i]
        if hi < 1e8:
            y = min(y, hi)
        if lo > -1e8:
            y = max(y, lo) if lo <= hi else (lo + hi) / 2
        ys[i] = y
    k = int(0.05 * U) | 1
    ys = np.convolve(np.pad(ys, k // 2, mode='edge'), np.ones(k) / k, 'valid')
    return xs, ys, us


def _tuck(im, body, fade=0.035):
    """Clip a front drape to inside the silhouette and darken it as it nears the edge: it goes BEHIND there."""
    from scipy import ndimage
    A = rig(body)['A']
    d = ndimage.distance_transform_edt(A) / U
    a = np.asarray(im).astype(np.float32)
    k = np.clip(d / fade, 0, 1)
    a[..., :3] *= (0.55 + 0.45 * k)[..., None]
    a[..., 3] *= np.clip(d / 0.006, 0, 1)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def drape_cord(body, color, width=0.017, path=None):
    """A thin round cord along the drape (rim, body, top-left highlight), thinner toward the ends (perspective)."""
    xs, ys, us = path or drape_path(body)
    SS = 2
    im = Image.new('RGBA', (CW * SS, CW * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    base = np.array(hexrgb(COLORS.get(color, color)), float)
    rim = tuple(int(v) for v in base * 0.55) + (255,)
    mid = tuple(int(v) for v in base * 0.95) + (255,)
    hi = tuple(int(v) for v in np.minimum(255, base * 0.55 + 255 * 0.5)) + (255,)
    step = 3
    for i in range(0, len(xs) - step, step):
        fs = 0.6 + 0.4 * math.sqrt(max(0.0, 1 - us[i] ** 2))
        W = width * U * SS * fs
        a, b2 = (xs[i] * SS, ys[i] * SS), (xs[i + step] * SS, ys[i + step] * SS)
        d.line([a, b2], fill=rim, width=max(1, int(W)))
        d.ellipse([a[0] - W / 2, a[1] - W / 2, a[0] + W / 2, a[1] + W / 2], fill=rim)
    for i in range(0, len(xs) - step, step):
        fs = 0.6 + 0.4 * math.sqrt(max(0.0, 1 - us[i] ** 2))
        W = width * U * SS * fs
        a, b2 = (xs[i] * SS, ys[i] * SS), (xs[i + step] * SS, ys[i + step] * SS)
        d.line([a, b2], fill=mid, width=max(1, int(W * 0.68)))
        d.line([(a[0] - W * 0.12, a[1] - W * 0.16), (b2[0] - W * 0.12, b2[1] - W * 0.16)], fill=hi, width=max(1, int(W * 0.2)))
    im = im.filter(ImageFilter.GaussianBlur(SS * 0.6)).resize((CW, CW), Image.LANCZOS)
    return _tuck(im, body)


def drape_bottom(body, path=None):
    """(x, y) body units of the bottom of the drape (where a clasp / pendant sits) and the room there (px)."""
    xs, ys, us = path or drape_path(body)
    i = int(np.argmin(np.abs(us)))
    return (xs[i] - M) / U, (ys[i] - M) / U


def drape_chain(body, link, half=0.016):
    """Chain links stamped along the drape: alternating flat / edge-on links, smaller + darker toward the ends
    (perspective: they turn away around the body), each rotated to the curve."""
    path = drape_path(body, half=half)
    xs, ys, us = path
    lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    # arc length
    seg = np.hypot(np.diff(xs), np.diff(ys))
    s = np.concatenate([[0], np.cumsum(seg)])
    pos, k = 0.0, 0
    hmax = half * 2 * U
    while pos < s[-1]:
        i = int(np.searchsorted(s, pos))
        i = min(i, len(xs) - 2)
        u = us[i]
        fs = 0.5 + 0.5 * math.sqrt(max(0.0, 1 - u ** 2))
        ang = math.degrees(math.atan2(ys[i + 1] - ys[i], xs[i + 1] - xs[i]))
        if k % 2 == 0:
            h = hmax * fs
            w = h * link.width / link.height
            L = link.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)
        else:
            h = hmax * fs * 0.42
            w = hmax * fs * 0.95
            L = link.resize((max(1, int(w)), max(1, int(h))), Image.LANCZOS)
        L = shade(L, np.full((L.height, L.width), 0.6 + 0.4 * fs, np.float32))
        L = L.rotate(-ang, Image.BICUBIC, expand=True)
        lay.alpha_composite(L, (int(xs[i] - L.width / 2), int(ys[i] - L.height / 2)))
        pos += (w if k % 2 == 0 else w * 0.9) * 0.62
        k += 1
    return _tuck(lay, body)


def drape_band(body, thick, margin=0.012, min_thick=0.02):
    """A fabric / flower band along the drape: (x0, x1, top[], bot[]) like neck_band, but following the U (ends
    up at cheek height, tucked behind) and kept clear of the face, the letter and the arms per column."""
    xs, ys, us = drape_path(body, half=0.012)
    R = rig(body)
    face, letter = guards(body)
    arms = arm_mask(body)
    mg = margin * U
    h = thick * U / 2
    fs = 0.75 + 0.25 * np.sqrt(np.clip(1 - us ** 2, 0, 1))   # a little thinner as it turns away
    top, bot = ys - h * fs, ys + h * fs
    for i, x in enumerate(xs.astype(int)):
        f = np.nonzero(face[:, x])[0]
        f = f[f < ys[i] + 2]
        if len(f):
            top[i] = max(top[i], f.max() + mg)
        l = np.nonzero(letter[:, x] | arms[:, x])[0]
        l = l[l > ys[i] - 2]
        if len(l):
            bot[i] = min(bot[i], l.min() - mg)
    k = int(0.05 * U) | 1
    sm = lambda v: np.convolve(np.pad(v, k // 2, mode='edge'), np.ones(k) / k, 'valid')
    top, bot = sm(top), sm(bot)
    mid = (top + bot) / 2
    t = np.maximum(bot - top, min_thick * U)
    return int(xs[0]), int(xs[-1]), mid - t / 2, mid + t / 2


def drape_wrap(tex, body, thick, margin=0.012):
    """A strip texture warped along the drape band, cylinder-shaded, tucked behind the silhouette at the ends."""
    x0, x1, top, bot = drape_band(body, thick, margin)
    band = warp_to_band(tex, x0, x1, top, bot, rig(body)['A'], overhang=0.0)
    return _tuck(band, body), (x0, x1, top, bot)


def fit_clasp(img, body, xm, ym, sizes=(0.07, 0.058, 0.048, 0.04, 0.034)):
    """The clasp at the bottom of the drape: the biggest size (body units) that clears the face and the letter,
    nudged up/down a hair if needed (wide / mini / cloud have almost no room between the mouth and the letter)."""
    face, letter = guards(body)
    g = face | letter
    best = None
    for w in sizes:
        for dy in (0, -0.004, 0.004, -0.008, 0.008):
            lay = place(img, xm, ym + dy, w, anchor=(0.5, 0.5))
            hit = int(((np.asarray(lay.getchannel('A')) > 90) & g).sum())
            if best is None or hit < best[0]:
                best = (hit, lay)
            if hit == 0:
                return lay
    return best[1]


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
    # 10-05 wrap fix: no straight cord across the belly + arms. The tie is a thin cord on the necklace drape (a soft
    # U under the mouth whose ends tuck behind the silhouette at cheek height, where the cape's top corners peek
    # out), with the clasp at the bottom of the U.
    rgb = np.asarray(src.convert('RGB')).reshape(-1, 3)[np.asarray(src.getchannel('A')).reshape(-1) > 200]
    ccol = '#%02x%02x%02x' % tuple(int(v) for v in np.median(rgb, 0))
    path = drape_path(body, half=0.011)
    cord = drape_cord(body, ccol, width=0.016, path=path)
    xm, ym = drape_bottom(body, path)
    clasp = trim(src.crop((int(W * 0.4), 0, int(W * 0.6), int(H * 0.2))))
    cl = fit_clasp(clasp, body, xm, ym, sizes=(0.05, 0.042, 0.036, 0.03))
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
