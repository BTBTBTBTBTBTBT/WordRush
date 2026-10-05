"""New additions for the mascot maker (10-05), built with the integration rig. Proposals only: nothing here is in
the shipped avatar-parts.json. Source art = ChatGPT sheets in ../new/raw (split into ../new/pieces by
../new/split.py); everything else (grip, wrap warps, front/back splits, per-body fit, shadows) is code.

Each builder(body) returns layers for rig.compose(): back / front / held / handover, plus two new keys:
  shoes   drawn over the feet (sized per foot from the body art)
  beside  companions and face extras that sit on the head, the shoulder, the floor or the face (never over the
          eyes, mouth or letter); fit-checked for face/letter cover and frame, not for "seat"
"""
import math, os
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from rig import (AV, CW, M, U, P, MAN, rig, load, trim, tint, place, light_match, place_part, hexrgb, soft, shade,
                 COLORS, compose as _compose)
from pieces import guards, neck_band, warp_to_band, hand, main_width, avoid, draw_strap, REBUILT

NEW = os.path.join(AV, 'new', 'pieces')


@lru_cache(None)
def piece(name):
    im = trim(load(os.path.join(NEW, f'{name}.png')))
    if name == 'flashlight':     # its soft glow was keyed off a cyan sheet: re-color the see-through glow warm
        a = np.asarray(im).astype(np.float32)
        glow = (a[..., 3] < 235) & (np.arange(a.shape[0])[:, None] < a.shape[0] * 0.3)
        a[glow, :3] = (255, 236, 160)
        im = Image.fromarray(a.astype(np.uint8), 'RGBA')
    return im


# ── held items: (grip point as a fraction of the piece box, width in hand diameters, tilt, side) ───────────
HELD = {
    'mug':        dict(grip=(0.1, 0.5), w=2.3, rot=0, side='R', set='Bookworm', label='Coffee mug'),
    'book':       dict(grip=(0.42, 0.74), w=1.05, rot=-6, side='L', set='Bookworm', label='Book'),
    'pencil-big': dict(grip=(0.5, 0.56), w=0.55, rot=-12, side='R', set='Bookworm', label='Big pencil'),
    'balloon':    dict(grip=(0.5, 0.99), w=1.9, rot=8, side='R', set='Party', label='Balloon', face=True),
    'trophy':     dict(grip=(0.5, 0.86), w=1.75, rot=0, side='R', set='Athlete', label='Trophy'),
    'magnifier':  dict(grip=(0.5, 0.86), w=1.35, rot=10, side='R', set='Explorer', label='Magnifier'),
    'flashlight': dict(grip=(0.5, 0.66), w=0.85, rot=-8, side='L', set='Explorer', label='Flashlight'),
    'umbrella':   dict(grip=(0.66, 0.9), w=1.35, rot=6, side='R', set='Rainy day', label='Umbrella'),
    'icecream':   dict(grip=(0.5, 0.8), w=1.25, rot=-6, side='R', set='Summer', label='Ice cream'),
    'spatula':    dict(grip=(0.5, 0.8), w=1.35, rot=8, side='R', set='Chef', label='Spatula'),
    'mic':        dict(grip=(0.5, 0.82), w=1.15, rot=-8, side='R', set='Rock star', label='Microphone'),
    'wand-star':  dict(grip=(0.5, 0.84), w=1.45, rot=10, side='R', set='Pro: Magic', label='Star wand'),
}


def held(name, body, side=None):
    spec = HELD[name]
    side = side or spec['side']
    if body == 'bean' and side == 'R' and name in ('balloon', 'umbrella'):
        side = 'L'
    sg = 1 if side == 'R' else -1
    im = light_match(piece(name), 0.06)
    if side == 'L':
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    gx, gy = spec['grip']
    if side == 'L':
        gx = 1 - gx
    hx, hy, rx, ry = hand(body, side)
    w = rx * 2 * spec['w'] * 1.3          # read at app size: a little bigger than the fist-sized original
    masks = ('face', 'letter')
    lay = avoid(lambda dx, dy: place(im, hx + sg * (rx * 0.25 + dx), hy + ry * 0.1, w, anchor=(gx, gy), rot=-sg * spec['rot'] - sg * dx * 40),
                body, step=(0.01, 0), tries=16, masks=masks)
    out = dict(held=[lay], handover=(side,))
    if name == 'balloon':
        out['grip_range'] = (0.003, 0.5)     # held by its string: the fist covers the knot, not the balloon
    if name == 'pencil-big':
        out['grip_range'] = (0.02, 0.7)      # a thin pencil: the fist wraps most of its width
    return out


# ── wraps ───────────────────────────────────────────────────────────────────
def _tile_strip(tex, reps=2):
    out = Image.new('RGBA', (tex.width * reps, tex.height))
    for i in range(reps):
        out.paste(tex if i % 2 == 0 else tex.transpose(Image.FLIP_LEFT_RIGHT), (i * tex.width, 0))
    return out


def band_wrap(name, body, thick=0.09, margin=0.016, knot=None, tilt=0.0):
    R = rig(body)
    A = R['A']
    tex = light_match(piece(name), 0.05)
    x0, x1, top, bot = neck_band(body, thick=thick, margin=margin)
    if tilt:
        face, letter = guards(body)
        xs = np.arange(x0, x1 + 1)
        best = (top, bot)
        for t in np.linspace(tilt, 0, 9):      # the steepest tilt that still clears the face and the letter
            sh = (xs - (x0 + x1) / 2) * t
            lay = warp_to_band(tex, x0, x1, top + sh, bot + sh, A)
            if not ((np.asarray(lay.getchannel('A')) > 90) & (face | letter)).any():
                best = (top + sh, bot + sh)
                break
        top, bot = best
    band = warp_to_band(tex, x0, x1, top, bot, A)
    front = [band]
    if knot:
        k = light_match(piece(knot), 0.05)
        i = int(len(top) * 0.14)
        kx, ky = (x0 + i - M) / U, ((top[i] + bot[i]) / 2 - M) / U
        kw = min(0.24, (x1 - x0) / U * 0.32)
        front.append(avoid(lambda dx, dy: place(k, kx - dx, ky, kw * (1 - dx * 2), anchor=(0.5, 0.42), rot=-8), body, step=(0.012, 0)))
    return dict(front=front, handover=(), seat_min=0.45)


def belt(body):
    R = rig(body)
    A = R['A']
    lb = MAN['bodies'][body]['letterBox']
    y0 = P(lb[1] + lb[3]) + 0.012 * U
    y1 = R['feet_y'] - 0.004 * U
    # stop above the legs: the last row (below the letter) where the body is still one solid run
    for y in range(int(y0), int(y1)):
        e = np.diff(np.concatenate([[0], A[y].astype(np.int8), [0]]))
        if (e == 1).sum() > 1:
            y1 = y - 2
            break
    under = False
    if y1 - y0 < 0.026 * U:
        # no room below the letter: the belt goes across the lower letter and the letter sits on top of it
        under = True
        yc, th = P(lb[1] + lb[3] * 0.8), 0.05 * U
        y0, y1 = yc - th / 2, yc + th / 2
    yc, th = (y0 + y1) / 2, min(y1 - y0, 0.06 * U)
    row = np.nonzero(A[int(yc)])[0]
    x0, x1 = row.min(), row.max()
    n = x1 - x0 + 1
    xs = np.arange(n)
    u = (xs - n / 2) / (n / 2)
    sag = 0.012 * U * (1 - u ** 2)          # rounds the front of the body
    top, bot = yc - th / 2 + sag, yc + th / 2 + sag
    band = warp_to_band(light_match(piece('belt-strip'), 0.05), x0, x1, top, bot, A)
    bkx = ((x0 + x1) / 2 - M) / U
    if under:     # the buckle moves to the side, clear of the letter
        lx1 = lb[0] + lb[2]
        bkx = min((x1 - M) / U - th / U, lx1 + th / U * 0.9)
    bk = place(light_match(piece('belt-buckle'), 0.05), bkx, (yc + 0.012 * U * 0.9 - M) / U, th / U * 1.45, anchor=(0.5, 0.5))
    if under:
        return dict(under=[band], front=[bk], handover=(), seat_min=0.45)
    return dict(front=[band, bk], handover=(), seat_min=0.45)


def behind_letter(lay, body, letter='A'):
    """Tuck a front layer behind the letter: the letter stays drawn over it (the layer is cut to the letter's
    outline, so it reads as the letter printed on top; the letter is never covered)."""
    from rig import draw_letter
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    draw_letter(c, b, letter)
    lm = ndimage.binary_dilation(np.asarray(c.getchannel('A')) > 30, iterations=3)
    a = np.asarray(lay).copy()
    a[..., 3] = np.where(lm, 0, a[..., 3])
    return Image.fromarray(a, 'RGBA')


def apron(body, color='red'):
    R = rig(body)
    A = R['A']
    face, _ = guards(body)
    x0, x1, top, bot = neck_band(body, thick=0.035, margin=0.02)
    ytop = float(np.median(top))
    floor = R['feet_y']
    w = (x1 - x0) * 0.82
    panel = tint(piece('apron-panel'), color)
    panel = light_match(panel, 0.06)
    hgt = floor - ytop
    panel = panel.resize((int(w), int(hgt)), Image.LANCZOS)
    lay = place(panel, ((x0 + x1) / 2 - M) / U, (ytop - M) / U, w / U, anchor=(0.5, 0.0))
    a = np.asarray(lay).copy(); a[..., 3] = a[..., 3] * ndimage.binary_dilation(A, iterations=2); lay = Image.fromarray(a, 'RGBA')
    tie = warp_to_band(tint(piece('apron-tie'), color), x0, x1, top, bot, A)
    return dict(under=[lay], front=[tie], handover=('L', 'R'), seat_min=0.45)


def necktie(body):
    R = rig(body)
    x0, x1, top, bot = neck_band(body, thick=0.05, margin=0.016)
    i = len(top) // 2
    t = light_match(piece('tie'), 0.05)
    lb = MAN['bodies'][body]['letterBox']
    length = (lb[1] + lb[3] * 0.75) - (top[i] - M) / U
    w = length * t.width / t.height
    w = max(w * 1.7, 0.16)                    # wide enough to show on both sides of the letter it tucks behind
    t = t.resize((int(w * U), int(length * U)), Image.LANCZOS)
    lay = place(t, (x0 + i - M) / U, (top[i] - M) / U, w, anchor=(0.5, 0.0))
    return dict(under=[lay], handover=('L', 'R'), seat_min=0.45)


def sash(body, ang=-34):
    """Pageant sash: a diagonal band from the viewer's-left shoulder to the right hip, tucked behind the letter
    (the letter stays on top) and moved down until it clears the face."""
    R = rig(body)
    A = R['A']
    tex = light_match(piece('sash'), 0.05)
    w_eye, cx = main_width(body)
    b = R['b']
    L = (R['bot'] - R['top']) / U * 1.6
    th = 0.085
    tex = tex.resize((int(L * U), int(th * U)), Image.LANCZOS)
    cy = (P(b['letterBox'][1]) - M) / U
    def mk(dx, dy):
        lay = place(tex, (cx - M) / U, cy + dy, L, anchor=(0.5, 0.5), rot=ang)
        a = np.asarray(lay).astype(np.float32)
        # cylinder shade: darker where it turns away at the sides
        xs = np.arange(CW); l, r = np.nonzero(A.any(0))[0][[0, -1]]
        u = np.clip(np.abs(xs - (l + r) / 2) / ((r - l) / 2), 0, 1)
        a[..., :3] *= (0.62 + 0.38 * np.sqrt(1 - u ** 2))[None, :, None]
        a[..., 3] *= ndimage.binary_dilation(A, iterations=int(0.01 * U))
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')
    lay = avoid(mk, body, step=(0, 0.012), tries=14, masks=('face',))
    return dict(under=[lay], handover=('L', 'R'), seat_min=0.45)


def cape_drape(body):
    R = rig(body)
    A = R['A']
    x0, x1, top, bot = neck_band(body, thick=0.05)
    yc = float(((top + bot) / 2).mean())
    floor = (R['bot'] - M) / U
    ytop = (yc - M) / U - 0.16
    cw = 1.08 * (x1 - x0) / U + 0.04
    src = piece('cape-drape')
    capeL = src.resize((int(cw * U), int((floor - ytop + 0.02) * U)), Image.LANCZOS)
    back = place(light_match(capeL, 0.06), ((x0 + x1) / 2 - M) / U, ytop, cw, anchor=(0.5, 0.0))
    col = light_match(piece('cape-collar'), 0.05)
    th = float(np.median(bot - top)) / U
    cwid = min(0.42, th * 4.2, (x1 - x0) / U * 0.6)
    collar = avoid(lambda dx, dy: place(col, ((x0 + x1) / 2 - M) / U, (yc - M) / U, cwid * (1 - dx * 4), anchor=(0.5, 0.5)),
                   body, step=(0.02, 0), tries=10)
    return dict(back=[back], front=[collar], handover=(), seat_min=0.45)


# ── footwear: one shoe per foot, sized from the body's own feet ─────────────
@lru_cache(None)
def feet(body):
    R = rig(body)
    A = R['A']
    fy = int(R['feet_y'])
    sub = A.copy(); sub[:fy] = False
    lab, n = ndimage.label(sub)
    sz = ndimage.sum(sub, lab, range(1, n + 1))
    comps = [lab == i + 1 for i in np.argsort(sz)[::-1][:2] if sz[i] > 200]
    if len(comps) == 1:                    # joined feet (tall, bean, pear): split at the middle
        ys, xs = np.nonzero(comps[0]); cx = (xs.min() + xs.max()) / 2
        c = comps[0]; xx = np.arange(CW)[None, :]
        comps = [c & (xx < cx), c & (xx >= cx)]
    out = []
    for c in comps:
        ys, xs = np.nonzero(c)
        out.append((xs.min(), xs.max(), ys.min(), ys.max()))
    return sorted(out)


SHOE_KEEP = {'sneakers': 0.45, 'boots': 0.36, 'slippers': 0.75, 'skates': 0.55}   # lower part of the shoe kept


def shoes(name, body):
    R = rig(body)
    A = R['A']
    pair = piece(name)
    a = np.asarray(pair.getchannel('A')) > 40
    cols = a.any(0)
    # split the pair at the widest empty gap near the middle
    xs = np.arange(len(cols))
    mid = len(cols) // 2
    gap = [x for x in xs if not cols[x] and abs(x - mid) < len(cols) * 0.25]
    cut_x = int(np.median(gap)) if gap else mid
    L, Rr = trim(pair.crop((0, 0, cut_x, pair.height))), trim(pair.crop((cut_x, 0, pair.width, pair.height)))
    lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    keep = SHOE_KEEP.get(name, 0.7)
    for (fx0, fx1, fy0, fy1), s in zip(feet(body), (L, Rr)):
        s = s.crop((0, int(s.height * (1 - keep)), s.width, s.height))
        fw = (fx1 - fx0) / U * 1.22
        fh = (fy1 - fy0) / U
        if fw * s.height / s.width > fh * 2.6:          # never much taller than the foot
            fw = fh * 2.6 * s.width / s.height
        s = light_match(s, 0.05)
        lay.alpha_composite(place(s, ((fx0 + fx1) / 2 - M) / U, (fy1 - M) / U + 0.014, fw, anchor=(0.5, 1.0)))
    # the legs go INTO the shoes: the torso (body above the feet line) stays in front of the shoe tops
    a = np.asarray(lay).copy()
    torso = A & (np.arange(CW)[:, None] < R['feet_y'] - 0.01 * U)
    a[..., 3] = np.where(torso, 0, a[..., 3])
    return dict(shoes=[Image.fromarray(a, 'RGBA')], handover=())


# ── companions and face extras ──────────────────────────────────────────────
def companion(name, body):
    R = rig(body)
    b = R['b']
    A = R['A']
    im = light_match(piece(name), 0.05)
    if name == 'bird':          # on the head, beside where a hat sits
        hx, hy, hw = b['headTop']['x'], b['headTop']['y'], b['headTop']['w']
        xs = np.nonzero(A.any(0))[0]
        x = hx + hw * 0.32
        col = np.nonzero(A[:, int(P(x))])[0]
        y = (col.min() - M) / U + 0.012 if len(col) else hy
        lay = place(im, x, y, 0.21, anchor=(0.5, 0.95))
    elif name == 'snail':       # on the shoulder edge
        y = b['eyeY'] - 0.02
        l, r = R['span'](P(b['eyeY']) - 0.1 * U)
        x = (r - M) / U - 0.03
        col = np.nonzero(A[:, int(P(x))])[0]
        y = (col.min() - M) / U + 0.01
        lay = place(im, x, y, 0.19, anchor=(0.5, 0.92))
    else:                       # kitten / puppy on the floor beside the feet
        fx = feet(body)[-1][1]
        floor = (R['bot'] - M) / U
        lay = place(im, (fx - M) / U + 0.16, floor + 0.005, 0.32, anchor=(0.5, 1.0))
    return dict(beside=[lay], handover=())


EXTRA = {'sweat': ('sweat', 0.06), 'tear': ('tear', 0.05), 'steam': ('steam', 0.11), 'heart': ('heart', 0.07)}


@lru_cache(None)
def eyes_boxes(body, eyes='beady'):
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    place_part(c, f'eyes:{eyes}', MAN['bodies'][body])
    m = np.asarray(c.getchannel('A')) > 60
    lab, n = ndimage.label(m)
    sz = ndimage.sum(m, lab, range(1, n + 1))
    out = []
    for i in np.argsort(sz)[::-1][:2]:
        ys, xs = np.nonzero(lab == i + 1)
        out.append((xs.min(), xs.max(), ys.min(), ys.max()))
    return sorted(out)


def extra(name, body):
    im = light_match(piece(name), 0.04)
    (lx0, lx1, ly0, ly1), (rx0, rx1, ry0, ry1) = eyes_boxes(body)
    ew = (rx1 - rx0) / U
    if name == 'sweat':
        lay = place(im, (rx1 - M) / U + ew * 0.55, (ry0 - M) / U - ew * 0.2, ew * 0.55, anchor=(0.5, 0.5), rot=-12)
    elif name == 'tear':
        lay = place(im, (lx0 - M) / U + ew * 0.1, (ly1 - M) / U + ew * 0.05, ew * 0.42, anchor=(0.5, 0.0))
    elif name == 'steam':
        R = rig(body)
        lay = place(im, (rx1 - M) / U + ew * 0.9, (R['top'] - M) / U + 0.05, ew * 1.7, anchor=(0.5, 1.0))
    else:   # heart: floats up beside the cheek
        lay = place(im, (rx1 - M) / U + ew * 0.95, (ry1 - M) / U + ew * 0.35, ew * 0.6, anchor=(0.5, 0.5), rot=-10)
    lay = avoid(lambda dx, dy: lay if dx == 0 else place(im, 0.5, 0.5, 0.01), body, tries=1)
    return dict(beside=[lay], handover=())


# brows: code-drawn in the eyes' own dark plum, so they are crisp at every size (six friendly pairs, no angry)
BROWS = {
    'happy':      [(-0.5, 0.15), (0, -0.2), (0.5, 0.15)],
    'worried':    [(-0.5, 0.15), (0.05, -0.05), (0.5, -0.25)],       # inner end (toward the nose) raised
    'determined': [(-0.5, -0.08), (0, 0.0), (0.5, 0.12)],            # gently down toward the middle, not angry
    'surprised':  [(-0.5, 0.05), (0, -0.42), (0.5, 0.05)],
    'cheeky':     None,                                               # one up, one flat
    'sleepy':     [(-0.5, -0.05), (0, 0.08), (0.5, 0.18)],
}


def brows(kind, body):
    (lx0, lx1, ly0, ly1), (rx0, rx1, ry0, ry1) = eyes_boxes(body)
    c = Image.new('RGBA', (CW * 3, CW * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    ink = (43, 22, 56, 255)
    for i, (x0, x1, y0, y1) in enumerate(((lx0, lx1, ly0, ly1), (rx0, rx1, ry0, ry1))):
        w = (x1 - x0)
        cx, base = (x0 + x1) / 2, y0 - w * 0.42
        pts = BROWS[kind]
        if kind == 'cheeky':
            pts = [(-0.5, 0.1), (0, -0.35), (0.5, 0.05)] if i == 1 else [(-0.5, 0.0), (0, 0.0), (0.5, 0.0)]
        if i == 1 and kind in ('worried', 'determined', 'sleepy'):
            pts = [(-x, y) for x, y in pts[::-1]]       # mirror for the right eye
        # quadratic through the 3 points
        P3 = [(cx + px * w * 0.95, base + py * w * 0.5) for px, py in pts]
        t = np.linspace(0, 1, 30)
        q = [((1 - s) ** 2 * P3[0][0] + 2 * (1 - s) * s * P3[1][0] + s * s * P3[2][0],
              (1 - s) ** 2 * P3[0][1] + 2 * (1 - s) * s * P3[1][1] + s * s * P3[2][1]) for s in t]
        lw = max(3, w * 0.2)
        d.line([(x * 3, y * 3) for x, y in q], fill=ink, width=int(lw * 3), joint='curve')
        for x, y in (q[0], q[-1]):
            d.ellipse([x * 3 - lw * 1.5, y * 3 - lw * 1.5, x * 3 + lw * 1.5, y * 3 + lw * 1.5], fill=ink)
    lay = c.resize((CW, CW), Image.LANCZOS)
    return dict(beside=[lay], handover=())


# ── R's ghost sheet for the Halloween header: see ../../seasons/halloween/header (back panel + hood) ─────

def NEW_ADDITIONS():
    """id -> (category, label, set, builder)"""
    out = {}
    for k, v in HELD.items():
        out[k] = ('Held items', v['label'], v['set'], (lambda b, k=k: held(k, b)))
    out['bandana'] = ('Wraps', 'Bandana + knot', 'Explorer', lambda b: band_wrap('bandana-band', b, thick=0.08, knot='bandana-knot'))
    out['sash'] = ('Wraps', 'Pageant sash (behind the letter)', 'Party', sash)
    out['belt'] = ('Wraps', 'Belt + buckle', 'Athlete', belt)
    out['apron'] = ('Wraps', 'Chef apron (letter on top)', 'Chef', apron)
    out['tie'] = ('Wraps', 'Necktie (tucks behind the letter)', 'Bookworm', necktie)
    out['lei'] = ('Wraps', 'Flower lei', 'Summer', lambda b: band_wrap('lei', b, thick=0.1, margin=0.012))
    out['cape-drape'] = ('Wraps', 'Drape cape + collar', 'Pro: Magic', cape_drape)
    for k, lab in (('sneakers', 'High-tops'), ('boots', 'Rain boots'), ('slippers', 'Bunny slippers'), ('skates', 'Roller skates')):
        out[k] = ('Footwear', lab, {'sneakers': 'Athlete', 'boots': 'Rainy day'}.get(k, ''), (lambda b, k=k: shoes(k, b)))
    for k, lab in (('bird', 'Bird on the head'), ('kitten', 'Kitten at the feet'), ('puppy', 'Puppy at the feet'), ('snail', 'Snail on the shoulder')):
        out[k] = ('Companions', lab, '', (lambda b, k=k: companion(k, b)))
    for k in BROWS:
        out['brows-' + k] = ('Brows + extras', k.capitalize() + ' brows', '', (lambda b, k=k: brows(k, b)))
    for k, lab in (('sweat', 'Sweat drop'), ('tear', 'Happy tear'), ('steam', 'Steam puff'), ('heart', 'Floating heart')):
        out[k] = ('Brows + extras', lab, '', (lambda b, k=k: extra(k, b)))
    return out


def compose(body, color, L, head=None, extra_face=()):
    """rig.compose + the two new layer kinds (shoes over the feet, beside on top)."""
    im = _compose(body, color, back=L.get('back', ()), front=L.get('front', ()), held=L.get('held', ()),
                  handover=L.get('handover', ()), head=head, extra_face=extra_face, under=L.get('under', ()))
    for k in ('shoes', 'beside'):
        for lay in L.get(k, ()):
            im.alpha_composite(lay)
    return im


def merge(*Ls):
    out = {}
    for L in Ls:
        for k, v in L.items():
            if k in ('back', 'front', 'held', 'shoes', 'beside', 'under'):
                out.setdefault(k, []).extend(v)
            elif k == 'handover':
                out['handover'] = tuple(sorted(set(out.get('handover', ())) | set(v)))
            elif k == 'seat_min':
                out['seat_min'] = min(out.get('seat_min', 1), v)
    return out


def head_layer(body, *keys):
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    for k in keys:
        place_part(c, k, MAN['bodies'][body])
    return c


SETS = [   # set -> (layers builder, head/face shipped parts, note)
    ('Bookworm', lambda b: merge(held('mug', b), held('book', b), necktie(b)), ('acc:roundglasses',), 'mug + book in both hands, round glasses (have), necktie behind the letter'),
    ('Athlete', lambda b: merge(held('trophy', b), shoes('sneakers', b), belt(b) if not belt(b).get('unsupported') else {}), ('acc:sweatband',), 'trophy, sweatband (have), high-tops, belt'),
    ('Chef', lambda b: merge(held('spatula', b), apron(b)), ('acc:chef',), 'spatula, apron with the letter on top, chef hat (have)'),
    ('Explorer', lambda b: merge(REBUILT['backpack'](b), held('magnifier', b), held('flashlight', b)), ('acc:bucket',), 'magnifier + flashlight, bucket hat (have), rebuilt backpack'),
    ('Rock star', lambda b: merge(held('mic', b), REBUILT['chain'](b) if not REBUILT['chain'](b).get('unsupported') else {}), ('acc:starglasses',), 'mic, star glasses (have), rebuilt chain'),
    ('Rainy day', lambda b: merge(held('umbrella', b), shoes('boots', b)), (), 'umbrella + rain boots'),
    ('Pro: Magic', lambda b: merge(held('wand-star', b), cape_drape(b)), ('acc:wizard',), 'star wand, wizard hat (have), drape cape'),
    ('Summer', lambda b: merge(held('icecream', b), band_wrap('lei', b, thick=0.1, margin=0.012)), (), 'ice cream + flower lei'),
]
