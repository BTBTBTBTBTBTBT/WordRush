#!/usr/bin/env python3
"""Clothing that conforms to the body (prototype 10-06): the "garment" rule type. A garment is shaped BY the body's
landmarks, not pinned to a point on it.

  top      the silhouette between the NECKLINE (the necklace drape: under the mouth, rising to the shoulder points)
           and the hem (waist line for a tee, hip line for a hoodie), inset a hair so it reads as worn; cut away where
           the mittens cross the torso (the arms + hands stay on top); sleeves are separate pieces fitted to each arm
           region (short = the arm root, long = down to the wrist, none = a tank with wide arm holes)
  bottom   the silhouette from the waist line down to just above the feet; the leg openings come from the feet + floor
           landmarks (shorts end at the crotch); a skirt flares a little past the hip width
  dress    top + skirt joined
  shading  the body's OWN lighting (the luminance of the white body art: top-left highlight, darker toward the edges
           and the bottom) multiplied over flat zone fills + a soft hem shadow on the body below the hem
  zones    2-colour team jerseys are zone maps (primary / secondary trim / optional accent): collar, sleeve bands, side
           panels, hem stripes, V-neck, pinstripes, button placket, shoulder pads, lace collar — procedural here
           (flat fills + the body lighting) to prove the fit; the final art comes later
  letter   when a top is worn the letter is drawn ON it (the jersey number / chest print) in the measured letter box,
           taking the garment's lighting

  python3 integration/garments.py     → out/landmarks/garments-<garment>.jpg (every body × size), garments-jerseys.jpg,
                                        out/landmarks/garments.json (garment guards)
"""
import io, json, os, sys
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
import cv2  # noqa: E402
from PIL import Image, ImageDraw, ImageFilter  # noqa: E402
from scipy import ndimage  # noqa: E402
import landmarks as LM  # noqa: E402
import rig  # noqa: E402
from rig import U, M, CW, MAN, P, hexrgb  # noqa: E402

OUT = os.path.join(HERE, 'out', 'landmarks')
INSET = 0.004          # a hair inside the outline
FLARE = 1.12           # a skirt's hem = the hip width × FLARE
HOLE = (1.25, 0.85, 0.09)   # tank arm holes: × the hand rx, × ry, centered this far below the arm root

# test garments (colors are hex; zones: name → color key)
GARMENTS = {
    'tshirt':  dict(top=dict(hem='waist', sleeves='short'), colors=dict(p='#2f80ed', s='#1c5bb8')),
    'jersey':  dict(top=dict(hem='hip', sleeves='short', template='soccer'), colors=dict(p='#e63946', s='#ffffff', a='#1d3557')),
    'hoodie':  dict(top=dict(hem='hip', sleeves='long', hood=True, pocket=True), colors=dict(p='#7b8794', s='#5f6b78')),
    'shorts':  dict(bottom=dict(kind='shorts'), colors=dict(p='#2a9d8f', s='#21867a')),
    'pants':   dict(bottom=dict(kind='pants'), colors=dict(p='#264653', s='#1b333d')),
    'skirt':   dict(bottom=dict(kind='skirt'), colors=dict(p='#e76f9a', s='#c9517d')),
}
JERSEYS = {   # the 5 sport templates (two team colours + an accent)
    'basketball': dict(top=dict(hem='hip', sleeves='none', template='basketball'), colors=dict(p='#f2c14e', s='#5b2a86', a='#ffffff')),
    'baseball':   dict(top=dict(hem='hip', sleeves='short', template='baseball'), colors=dict(p='#f4f1ea', s='#1d3557', a='#c1121f')),
    'football':   dict(top=dict(hem='hip', sleeves='short', template='football', number=1.15), colors=dict(p='#0b6e4f', s='#ffffff', a='#f2c14e')),
    'hockey':     dict(top=dict(hem='hip', sleeves='long', template='hockey'), colors=dict(p='#c1121f', s='#ffffff', a='#1d3557')),
    'soccer':     dict(top=dict(hem='hip', sleeves='short', template='soccer'), colors=dict(p='#1d4ed8', s='#facc15', a='#ffffff')),
}


# ── body measurements on the canvas ──────────────────────────────────────────────────────────────────────────────
@lru_cache(None)
def body(b):
    lm = LM.measure(b)
    pr = lm['_']
    art = np.asarray(rig.body_art(b)).astype(np.float32)
    lum = art[..., :3].mean(-1) / 255
    inside = pr['A']
    ref = np.percentile(lum[inside], 92) if inside.any() else 1
    shade = np.clip(lum / max(ref, 1e-3), 0.35, 1.08)              # the body's own lighting, ~1 on the lit side
    return lm, pr, shade


def neckline(b):
    """Per canvas column, the top row of the garment: the necklace drape (U under the mouth) between the shoulder
    points, rising to the shoulder line outside it (canvas px; inf where the body has no torso)."""
    import pieces as PC
    lm, pr, _ = body(b)
    xs, ys, us = PC.drape_path(b, half=0.006)
    top = np.full(CW, np.inf)
    sh_y = M + min(lm['shoulders']['L'][1], lm['shoulders']['R'][1]) * U
    cols = np.nonzero(pr['A'].any(0))[0]
    top[cols] = sh_y
    top[xs.astype(int)] = np.minimum(ys + 0.004 * U, np.inf)
    # outside the drape ends the neckline follows the shoulder line down to the arm roots
    return ndimage.uniform_filter1d(np.where(np.isfinite(top), top, CW), 7)


def _rows(mask, y0, y1):
    m = mask.copy()
    m[:max(0, int(y0))] = False
    m[int(y1):] = False
    return m


def arm_zones(b):
    """{side: (mitten mask, sleeve root mask, long-sleeve mask)}: the root = the upper 45% of the arm (from its start
    notch), long = everything but the hand tip (the outer/lower 35% of the mitten)."""
    lm, pr, _ = body(b)
    out = {}
    yy, xx = np.mgrid[0:CW, 0:CW]
    for s, a in lm['arms'].items():
        m = pr['arms'][s]
        hx, hy, rx, ry = [M + v * U if i < 2 else v * U for i, v in enumerate(a['hand'])]
        y0 = M + a['start'][1] * U
        y1 = M + a['end'][1] * U
        sg = -1 if s == 'L' else 1
        root = m & (yy < y0 + 0.45 * (y1 - y0))
        tip = ((xx - (hx + sg * rx * 0.55)) / (rx * 0.75)) ** 2 + ((yy - (hy + ry * 0.35)) / (ry * 0.72)) ** 2 <= 1
        long_ = m & ~tip
        out[s] = (m, root, long_)
    return out


# ── zones ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def top_mask(b, spec):
    lm, pr, _ = body(b)
    A = pr['A']
    inset = ndimage.binary_erosion(A, iterations=max(1, int(INSET * U)))
    nl = neckline(b)
    hem = M + (lm['waist']['y'] if spec.get('hem') == 'waist' else lm['hips']['y'] + 0.01) * U
    yy = np.arange(CW)[:, None]
    m = inset & (yy >= nl[None, :]) & (yy < hem)
    arms = arm_zones(b)
    for s, (mit, root, long_) in arms.items():
        m &= ~mit                                       # the arms + hands stay on top where they cross the torso
    if spec.get('sleeves') == 'none':                   # a tank: wide arm holes around the arm roots
        for s, a in lm['arms'].items():
            hx, hy, rx, ry = a['hand']
            hole = ((np.arange(CW)[None, :] - P(hx)) / (rx * U * HOLE[0])) ** 2 + ((yy - P(a['start'][1] + HOLE[2])) / (ry * U * HOLE[1])) ** 2 <= 1
            m &= ~hole
    return m


def sleeve_masks(b, spec):
    if spec.get('sleeves') in (None, 'none'):
        return {}
    out = {}
    for s, (mit, root, long_) in arm_zones(b).items():
        out[s] = ndimage.binary_erosion(long_ if spec['sleeves'] == 'long' else root, iterations=1)
    return out


RISE = 0.3      # bottoms come up 30% of the torso height above the hips (the letter is printed over them)


def rise_y(lm):
    return min(lm['waist']['y'] - 0.02, lm['hips']['y'] - RISE * (lm['hips']['y'] - lm['shoulders']['y']))


def bottom_mask(b, spec):
    lm, pr, _ = body(b)
    A = pr['A']
    inset = ndimage.binary_erosion(A, iterations=max(1, int(INSET * U)))
    yy = np.arange(CW)[:, None]
    xx = np.arange(CW)[None, :]
    w0 = M + rise_y(lm) * U
    feet_top = min(lm['feet']['L'][1], lm['feet']['R'][1])
    crotch = lm['hips'].get('crotch') or lm['hips']['y']
    if spec['kind'] == 'pants':
        y1 = M + (feet_top + 0.45 * (lm['floor'] - feet_top)) * U       # just above the feet (cuffs over the ankles)
        m = inset & (yy >= w0) & (yy < y1)
        for s in 'LR':                                  # the arms + hands stay on top
            m &= ~pr['arms'][s]
        return m, None
    if spec['kind'] == 'shorts':
        y1 = M + (max(crotch, lm['hips']['y']) + 0.035) * U
        m = inset & (yy >= w0) & (yy < y1)
        for s in 'LR':
            m &= ~pr['arms'][s]
        return m, None
    # skirt: a trapezoid from the waist width to the hip width × FLARE, hem a little below the hips (flares past
    # the outline by design; the legs show below it)
    wy = rise_y(lm)
    import rules as _r
    ww, wc = _r.torso_at(b, wy) if _r.LMS else (lm['waist']['x1'] - lm['waist']['x0'], (lm['waist']['x0'] + lm['waist']['x1']) / 2)
    x0, x1 = wc - ww / 2, wc + ww / 2
    hy = max(crotch, lm['hips']['y']) + 0.06
    hx0, hx1 = lm['hips']['x0'], lm['hips']['x1']
    hc, hw = (hx0 + hx1) / 2, max(hx1 - hx0, x1 - x0) * FLARE
    poly = np.array([[P(x0), P(wy)], [P(x1), P(wy)], [P(hc + hw / 2), P(hy)], [P(hc - hw / 2), P(hy)]], np.int32)
    tr = np.zeros((CW, CW), np.uint8)
    cv2.fillPoly(tr, [poly], 1)
    m = tr.astype(bool) & ((inset & (yy >= w0)) | (yy > P(lm['hips']['y']) - 0.03 * U))
    for s in 'LR':
        m &= ~pr['arms'][s]
    flare = m & ~A
    return m, flare


def zone_map(b, spec, tm, sleeves):
    """Primary 'p' / secondary 's' / accent 'a' per pixel of the top (a dict of bool masks)."""
    lm, pr, _ = body(b)
    t = spec.get('template')
    yy, xx = np.mgrid[0:CW, 0:CW]
    nl = neckline(b)
    dn = yy - nl[None, :]                                # depth below the neckline
    hem = M + lm['hips']['y'] * U + 0.01 * U
    s = np.zeros((CW, CW), bool)
    a = np.zeros((CW, CW), bool)
    dist_edge = ndimage.distance_transform_edt(pr['A']) / U
    cx = P((lm['bbox'][0] + lm['bbox'][2]) / 2)
    collar = (dn >= 0) & (dn < 0.022 * U)
    if t in ('soccer',):
        # V-neck: the collar band dips into a V at the center
        v = (dn >= 0) & (dn < 0.022 * U + np.clip(0.06 * U - np.abs(xx - cx) * 0.9, 0, None))
        s |= v & ~(dn >= 0.022 * U + np.clip(0.06 * U - np.abs(xx - cx) * 0.9, 0, None) - 0.018 * U)
        s |= collar
    elif t == 'hockey':
        s |= collar
        lace = (np.abs(xx - cx) < 0.012 * U) & (dn >= 0) & (dn < 0.07 * U)
        a |= lace & ((yy // int(0.012 * U)) % 2 == 0)
        for k in (0.05, 0.085):                          # two hem stripes
            s |= (yy > hem - k * U) & (yy < hem - (k - 0.02) * U)
    elif t == 'basketball':
        s |= collar
        s |= (dist_edge < 0.05) & (dn > 0.05 * U)        # side panels
        for side, a_ in lm['arms'].items():               # arm-hole trim
            hx, hy, rx, ry = a_['hand']
            ring = ((xx - P(hx)) / (rx * U * HOLE[0])) ** 2 + ((yy - P(a_['start'][1] + HOLE[2])) / (ry * U * HOLE[1])) ** 2
            s |= (ring > 1) & (ring < 1.25)
    elif t == 'baseball':
        s |= collar
        s |= (np.abs(xx - cx) < 0.008 * U) & (dn > 0)    # the button placket
        a |= ((np.abs(xx - cx) < 0.007 * U) & (dn > 0.03 * U) & (((yy - nl[None, :]) // int(0.05 * U)) % 2 == 0) &
              (((yy - nl[None, :]) % int(0.05 * U)) < 0.012 * U))     # buttons
        pin = (((xx - cx) % int(0.045 * U)) < max(1, int(0.004 * U)))
        s |= pin & (dn > 0.022 * U)                       # pinstripes
    elif t == 'football':
        s |= collar
        for side in 'LR':                                 # shoulder pads: the top of the shoulders in the trim colour
            sx, sy = lm['shoulders'][side]
            s |= ((xx - P(sx)) / (0.12 * U)) ** 2 + ((yy - P(sy)) / (0.07 * U)) ** 2 <= 1
    else:
        s |= collar
    cuff = {}
    for side, m in sleeves.items():
        # a sleeve band at the open end (the lowest 25% of the sleeve)
        ys_ = np.nonzero(m.any(1))[0]
        if len(ys_):
            lo = ys_.max() - 0.25 * (ys_.max() - ys_.min())
            cuff[side] = m & (yy > lo)
    hemb = (yy > hem - 0.022 * U) & (yy <= hem)
    if t in (None,) and spec.get('pocket'):
        pass
    return dict(s=s & tm, a=a & tm, hem=hemb & tm, cuff=cuff)


# ── painting ──────────────────────────────────────────────────────────────────────────────────────────────────────
def paint(mask, color, shade, gloss=0.08):
    """A flat fill shaded with the body's own lighting (+ a hair of fabric gloss on the lit side)."""
    rgb = np.array(hexrgb(color), np.float32)
    out = np.zeros((CW, CW, 4), np.float32)
    lit = rgb[None, None, :] * shade[..., None] ** 1.15
    lit += 255 * gloss * np.clip(shade - 0.95, 0, None)[..., None] * 3
    out[..., :3] = lit
    out[..., 3] = mask * 255
    return out


def soft_edge(arr, mask, r=1.0):
    a = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), r) * mask.astype(np.float32) ** 0.0
    arr[..., 3] = np.minimum(arr[..., 3], a * 255 + (mask * 0))
    return arr


def hem_shadow(b, gm, strength=0.28):
    """A soft shadow the hem casts on the body just below it (and the garment edge onto the arms)."""
    lm, pr, _ = body(b)
    sh = np.roll(gm.astype(np.float32), int(0.008 * U), 0)
    sh = cv2.GaussianBlur(sh, (0, 0), 0.008 * U) * strength
    sh *= pr['A'] & ~gm
    out = np.zeros((CW, CW, 4), np.float32)
    out[..., 3] = sh * 255
    return out


def over(dst, src):
    a = src[..., 3:4] / 255
    dst[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
    dst[..., 3:4] = src[..., 3:4] + dst[..., 3:4] * (1 - a)


def build(b, g):
    """→ dict(layers={'back': RGBA, 'under': RGBA, 'sleeves': RGBA}, masks, letter_on_top: bool). 'under' = the garment
    body (drawn before the letter, the letter goes ON it); 'sleeves' are drawn over the arms."""
    lm, pr, shade = body(b)
    C = g['colors']
    under = np.zeros((CW, CW, 4), np.float32)
    back = np.zeros((CW, CW, 4), np.float32)
    sleeve_l = np.zeros((CW, CW, 4), np.float32)
    masks = {}
    if 'bottom' in g:
        bm, flare = bottom_mask(b, g['bottom'])
        masks['bottom'], masks['flare'] = bm, flare
        lay = paint(bm, C['p'], shade if flare is None else np.where(pr['A'], shade, 0.8))
        # a waistband in the darker shade
        yy = np.arange(CW)[:, None]
        wb = bm & (yy < M + (rise_y(lm) + 0.025) * U)
        over(lay, paint(wb, C['s'], shade))
        over(under, hem_shadow(b, bm))
        over(under, lay)
    if 'top' in g:
        spec = g['top']
        tm = top_mask(b, spec)
        sl = sleeve_masks(b, spec)
        masks['top'], masks['sleeves'] = tm, sl
        z = zone_map(b, spec, tm, sl)
        lay = paint(tm, C['p'], shade)
        over(lay, paint(z['s'], C['s'], shade))
        over(lay, paint(z['a'], C.get('a', C['s']), shade))
        over(lay, paint(z['hem'], C['s'], shade * 0.92))
        if spec.get('pocket'):
            yy, xx = np.mgrid[0:CW, 0:CW]
            hem = M + lm['hips']['y'] * U
            cx = P((lm['bbox'][0] + lm['bbox'][2]) / 2)
            pw = (lm['hips']['x1'] - lm['hips']['x0']) * U * 0.32
            pocket = tm & (yy > hem - 0.1 * U) & (yy < hem - 0.03 * U) & (np.abs(xx - cx) < pw + (yy - hem + 0.1 * U) * 0.6)
            over(lay, paint(pocket, C['s'], shade * 0.95))
        over(under, hem_shadow(b, tm))
        over(under, lay)
        for s, m in sl.items():
            sll = paint(m, C['p'], shade)
            cuff = z['cuff'].get(s)
            if cuff is not None:
                over(sll, paint(cuff, C['s'], shade))
            over(sleeve_l, hem_shadow(b, m, 0.22))
            over(sleeve_l, sll)
        if spec.get('hood'):
            # the hood: behind the head, peeking out around the head-top curve (a back layer, outside the outline)
            A = pr['A']
            ring = ndimage.binary_dilation(A, iterations=int(0.035 * U)) & ~A
            yy = np.arange(CW)[:, None]
            ring &= yy < M + (lm['shoulders']['y'] + 0.02) * U
            hood = paint(ring, C['s'], np.full((CW, CW), 0.82, np.float32))
            back = hood
            masks['hood'] = ring
    return dict(back=back, under=under, sleeves=sleeve_l, masks=masks)


def to_im(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')


def compose(b, color, gs, letter='A', letter_color='white'):
    """The mascot wearing one or more garments: hood (back), body, garment bodies, LETTER on the garment (taking its
    lighting), eyes, mouth, sleeves over the arms."""
    lm, pr, shade = body(b)
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    built = [build(b, g) for g in gs]
    for B in built:
        c.alpha_composite(to_im(B['back']))
    c.alpha_composite(rig.tint(rig.body_art(b), color))
    for B in sorted(built, key=lambda B: 'top' in B['masks']):      # bottoms first, the top overlaps at the waist
        c.alpha_composite(to_im(B['under']))
    worn_top = any('top' in B['masks'] for B in built)
    L = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    an = MAN['bodies'][b]
    for g in gs:
        if 'top' in g:
            p_ = np.array(hexrgb(g['colors']['p'])) / 255
            if p_ @ [0.299, 0.587, 0.114] > 0.7:        # light fabric: the number takes the trim colour
                letter_color = g['colors']['s']
            k = g['top'].get('number', 1.0)
            if k != 1.0:                                # football: a big number (the letter box × k)
                lx, ly, lw, lh = an['letterBox']
                an = dict(an, letterBox=[lx - lw * (k - 1) / 2, ly - lh * (k - 1) / 2, lw * k, lh * k])
    rig.draw_letter(L, an, letter, fill=letter_color)
    if worn_top:   # printed on the fabric: it takes the garment's (= the body's) lighting
        a = np.asarray(L).astype(np.float32)
        a[..., :3] *= np.clip(shade, 0.5, 1.05)[..., None]
        L = to_im(a)
    c.alpha_composite(L)
    rig.place_part(c, 'eyes:beady', MAN['bodies'][b])
    rig.place_part(c, 'mouth:smile', MAN['bodies'][b])
    for B in built:
        c.alpha_composite(to_im(B['sleeves']))
    return c, built


# ── garment guards ───────────────────────────────────────────────────────────────────────────────────────────────
def guard(b, built, letter='W'):
    lm, pr, _ = body(b)
    A = pr['A']
    fails = []
    grow = ndimage.binary_dilation(A, iterations=2)
    face = pr['face']
    for B in built:
        mk = B['masks']
        allowed = np.zeros((CW, CW), bool)
        if mk.get('flare') is not None:
            allowed |= mk['flare']
        if mk.get('hood') is not None:
            allowed |= mk['hood']
        wear = np.zeros((CW, CW), bool)
        for k in ('top', 'bottom'):
            if k in mk:
                wear |= mk[k]
        for m in mk.get('sleeves', {}).values():
            wear |= m
        out = (wear & ~grow & ~allowed).sum()
        if out > 0.0004 * U * U:
            fails.append(('outline', f'{out} px past the outline'))
        f = ((wear | (mk.get('hood') if mk.get('hood') is not None else False)) & face).sum() / max(1, face.sum())
        if f > 0.0:
            fails.append(('face', f'covers {f:.1%} of the face'))
        if 'top' in mk:
            cov = {}
            nl = neckline(b)
            yy, xx = np.mgrid[0:CW, 0:CW]
            band = (yy >= nl[None, :]) & (yy < nl[None, :] + 0.05 * U) & A & ~pr['arm_any']
            for s in 'LR':
                sx, sy = lm['shoulders'][s]
                sg = 1 if s == 'L' else -1          # the shoulder top: the band just under the neckline, inside the
                x0, x1 = sorted((P(sx + sg * 0.02), P(sx + sg * 0.12)))   # shoulder point (where a strap / seam sits)
                zone = band & (xx >= x0) & (xx <= x1)
                cov[s] = (mk['top'] & zone).sum() / max(1, zone.sum())
            if min(cov.values()) < 0.5 or abs(cov['L'] - cov['R']) > 0.2:
                fails.append(('shoulders', f"L {cov['L']:.0%} / R {cov['R']:.0%} covered"))
            for s, m in mk.get('sleeves', {}).items():
                arm = ndimage.binary_dilation(pr['arms'][s], iterations=2)
                if m.sum() and (m & ~arm).sum() / m.sum() > 0.02:
                    fails.append(('sleeve', f'{s} sleeve leaves its arm'))
                if not m.sum():
                    fails.append(('sleeve', f'{s} sleeve empty'))
    tops = [B['masks']['top'] for B in built if 'top' in B['masks']]
    bots = [B['masks']['bottom'] for B in built if 'bottom' in B['masks']]
    if tops and bots:
        ty = np.nonzero(tops[0].any(1))[0].max()
        by = np.nonzero(bots[0].any(1))[0].min()
        if ty - by < 0.01 * U:
            fails.append(('gap', f'top hem {(ty - M) / U:.3f} vs bottom waist {(by - M) / U:.3f}: no overlap'))
    # the letter stays fully visible: arms (+ sleeves) over it ≤ today's 1%
    if tops:
        L = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
        rig.draw_letter(L, MAN['bodies'][b], letter)
        lmask = np.asarray(L.getchannel('A')) > 60
        cover = pr['arm_any'].copy()
        for B in built:
            for m in B['masks'].get('sleeves', {}).values():
                cover |= m
        lt = (cover & lmask).sum() / max(1, lmask.sum())
        if lt > 0.01:
            fails.append(('letter', f'arms cover {lt:.1%} of the letter'))
    return fails


# ── the run: every test garment on every body × size ────────────────────────────────────────────────────────────
SHEET = ['tshirt', 'jersey', 'hoodie', 'shorts', 'pants', 'skirt', 'jersey+pants']
T = 110


def outfits(name):
    return [GARMENTS['jersey'], GARMENTS['pants']] if name == 'jersey+pants' else [GARMENTS[name]]


def _worker(v):
    import sizes as SZ
    import rules
    import fits
    SZ.register_all()
    base = LM.load()
    sz = json.load(open(os.path.join(HERE, 'landmarks-sizes.json')))['bodies']
    rules.setup({**base, **sz})
    lms = {**base, **sz}
    j = list(base).index(v.split('@')[0])
    res = {}
    for name in SHEET + (list(JERSEYS) if '@' not in v else []):
        gs = outfits(name) if name in SHEET else [JERSEYS[name]]
        c, built = compose(v, 'purple', gs, 'AWMRSOBKEQZH'[j])
        f = guard(v, built)
        t = fits.fixed_tile(c, v, T if name in SHEET else 140, bool(f), lms)
        b = io.BytesIO()
        t.convert('RGB').save(b, 'PNG')
        res[name] = dict(guards=f, tile=b.getvalue())
    return v, res


def main():
    from concurrent.futures import ProcessPoolExecutor
    import sizes as SZ
    import fits
    base = list(LM.load())
    sizes = ['base'] + list(SZ.SIZES)
    vids = [b if s == 'base' else SZ.vid(b, s) for s in sizes for b in base]
    allres = {}
    with ProcessPoolExecutor(max_workers=int(os.environ.get('AV_WORKERS', '1'))) as ex:
        for v, res in ex.map(_worker, vids):
            allres[v] = res
            print(v, {k: [c for c, _ in x['guards']] for k, x in res.items() if x['guards']}, flush=True)
    f, fs = fits.font(14), fits.font(11, bold=False)
    for name in SHEET:
        sh = Image.new('RGB', (90 + (T + 2) * len(base), 30 + (T + 2) * len(sizes)), (255, 255, 255))
        d = ImageDraw.Draw(sh)
        d.text((6, 6), f'garment: {name} — every body × size · red frame = a garment guard fails', font=fs, fill=(40, 30, 60))
        for j, b in enumerate(base):
            d.text((90 + j * (T + 2) + T / 2, 22), b, font=fs, fill=(40, 30, 60), anchor='mm')
        for r_, s in enumerate(sizes):
            d.text((6, 30 + r_ * (T + 2) + T / 2 - 8), s, font=f, fill=(40, 20, 60))
            for j, b in enumerate(base):
                v = b if s == 'base' else SZ.vid(b, s)
                sh.paste(Image.open(io.BytesIO(allres[v][name]['tile'])), (90 + j * (T + 2), 30 + r_ * (T + 2)))
        sh.save(os.path.join(OUT, f'garments-{name}.jpg'), quality=84)
    TJ = 140
    sh = Image.new('RGB', (110 + (TJ + 2) * len(base), 30 + (TJ + 2) * len(JERSEYS)), (255, 255, 255))
    d = ImageDraw.Draw(sh)
    d.text((6, 6), 'team jersey templates (primary / secondary trim / accent zones, flat fills × the body lighting; the letter '
                   'is the number) · red = a garment guard fails', font=fs, fill=(40, 30, 60))
    for j, b in enumerate(base):
        d.text((110 + j * (TJ + 2) + TJ / 2, 22), b, font=fs, fill=(40, 30, 60), anchor='mm')
    for r_, name in enumerate(JERSEYS):
        d.text((6, 30 + r_ * (TJ + 2) + TJ / 2 - 8), name, font=f, fill=(40, 20, 60))
        for j, b in enumerate(base):
            sh.paste(Image.open(io.BytesIO(allres[b][name]['tile'])), (110 + j * (TJ + 2), 30 + r_ * (TJ + 2)))
    sh.save(os.path.join(OUT, 'garments-jerseys.jpg'), quality=86)
    json.dump({v: {k: x['guards'] for k, x in res.items()} for v, res in allres.items()},
              open(os.path.join(OUT, 'garments.json'), 'w'), indent=0)
    n = sum(1 for res in allres.values() for x in res.values() if x['guards'])
    print('garment guard failures:', n, 'of', sum(len(r) for r in allres.values()))


if __name__ == '__main__':
    main()
