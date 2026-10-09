#!/usr/bin/env python3
"""Landmark map per body (STEP ONE of NEXT-ROUND-INK-AND-BLING.md, prototype 10-06).

Measures every body from its ART (the silhouette + the shading-free outline) and the face/letter anchors it ships
with, so items can place themselves from measurements instead of per-body hand fits:

  contour      the outline (simplified polygon)
  headTop      the head-top curve (top row per column above the shoulders), the head band line + width, the peak
  face         eyes + mouth box (beady + smile, the default face) and faceMax (every eyes / mouth part, union)
  letter       the letter box (manifest) and the ink box of the widest initials (W, M)
  shoulders    the shoulder line = where the arms hang from (just above the arm roots) + its two silhouette points;
               shoulderTop = the upper corners of the outline (where backpack straps come over)
  arms         per side: start / end (the two outline notches the mitten sits between), the outward tip, the hand
               ellipse [cx, cy, rx, ry] (the whole mitten, incl. the part over the torso)
  neckBand     the arm-free band a necklace may use: below the mouth, above the letter + the arm roots
  waist / hips the belt line (between the letter and the legs) and the hip line (bottom of the torso)
  feet         the two feet boxes, the floor line
  torso        the torso span per row (arms excluded), every 0.01 body units

All values are BODY UNITS (fractions of the body art square), like avatar-parts.json.

  python3 integration/landmarks.py [bodies…]     → integration/landmarks.json + out/landmarks/overlay-<body>.jpg
                                                    + out/landmarks/overlays.jpg (all bodies on one sheet)
Other scripts: `import landmarks as LM; LM.load()`; LM.install() swaps the rig's hand-fit HANDS for the measured
hands (the rule renderer runs on measurements only); LM.register_body() adds a body that has no manifest entry
(the size variants).
"""
import json, os, sys
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
import cv2  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from scipy import ndimage  # noqa: E402
import rig  # noqa: E402
from rig import U, M, CW, MAN, place_part, draw_letter  # noqa: E402

OUT = os.path.join(HERE, 'out', 'landmarks')
JSON = os.path.join(HERE, 'landmarks.json')
FACE_EYES, FACE_MOUTH = 'beady', 'smile'
# the hat band line: this far down from the head top toward the eye line (the head width is measured there)
HEAD_BAND = 0.3
# a hat is never narrower than this × the face (eyes + mouth) width (the narrowest hand fit today: drop 0.84)
HEAD_MIN_FACE = 0.85
# Expected mitten centers (body units) for bodies whose mittens the notch search can confuse with the feet (the 18 new
# bodies, item 50): written by new-bodies.py from each silhouette. {body: {'L': [x, y], 'R': [x, y]}}
_HP = os.path.join(HERE, 'hands-prior.json')
HANDS_PRIOR = json.load(open(_HP)) if os.path.exists(_HP) else {}
rig.LETTER_MODE = 'app'     # guard the letter the apps actually draw (Nunito 900, ~20% bigger than the rig's)
# Body-level landmark overrides: today's hand fit kept where the measurement is clearly worse (and why).
LANDMARK_OVERRIDES = {
    'cloud': dict(headTop='manifest', why='the head band lands on the small top puff (0.29 wide), so every hat came '
                  'out tiny on the puff; the hand fit seats hats over the puff on the two shoulder lumps (0.62 wide)'),
}
_REG = {}      # body id → RGBA art (variants that are not in parts/)


def bu(v):
    """canvas px → body units"""
    return round(float((v - M) / U), 4)


def bl(v):
    """canvas px length → body units"""
    return round(float(v / U), 4)


# ── bodies that are not in parts/ (size variants) ───────────────────────────────────────────────────────────────
_orig_body_art = rig.body_art


@lru_cache(None)
def _body_art(body):
    if body in _REG:
        im = _REG[body].resize((U, U), Image.LANCZOS)
        c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
        c.alpha_composite(im, (M, M))
        return c
    return _orig_body_art(body)


rig.body_art = _body_art


def register_body(body, art, anchors, hands=None):
    """Make a body the rig doesn't know (art: RGBA image, anchors: an avatar-parts.json body entry) usable by every
    rig / pieces / landmark function. hands: {'L': (cx, cy, rx, ry), 'R': …} (else measured on first use)."""
    _REG[body] = art
    MAN['bodies'][body] = anchors
    if hands:
        rig.HANDS[body] = hands


# ── outline helpers ───────────────────────────────────────────────────────────────────────────────────────────────
def alpha_mask(body):
    return np.asarray(rig.body_art(body).getchannel('A')) > 128


def _contour(A):
    cs, _ = cv2.findContours(A.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    return max(cs, key=len)[:, 0, :].astype(float)


def _turning(c, k=14, sig=4):
    """Signed turning angle (degrees) along the closed contour: > 0 convex, < 0 concave (a notch)."""
    cs = ndimage.gaussian_filter1d(c, sig, axis=0, mode='wrap')
    v1 = cs - np.roll(cs, k, 0)
    v2 = np.roll(cs, -k, 0) - cs
    t = np.degrees(np.arctan2(v1[:, 0] * v2[:, 1] - v1[:, 1] * v2[:, 0], (v1 * v2).sum(1)))
    return t if t.sum() > 0 else -t


def _arcs(i, j, n):
    f = np.arange(i, j + 1) if j >= i else np.r_[np.arange(i, n), np.arange(0, j + 1)]
    g = np.arange(j, i + 1) if i >= j else np.r_[np.arange(j, n), np.arange(0, i + 1)]
    return f, g


def find_arms(A, prior=None):
    """The mittens. Each sits between two concave notches of the outline (the thumb notch above, the armpit below)
    and bulges outward. The hand ellipse covers the whole mitten: from its outward tip to 40% of its protrusion
    inside the torso edge (the part drawn over the torso), from the upper notch to where the outline returns to the
    torso edge below the tip."""
    ys = np.nonzero(A.any(1))[0]
    top, bot = ys.min(), ys.max()
    H = bot - top
    xs = np.nonzero(A.any(0))[0]
    cx = (xs.min() + xs.max()) / 2
    c = _contour(A)
    t = _turning(c)
    n = len(c)
    notches = [i for i in range(n) if t[i] < -20 and t[i] == t[max(0, i - 10):i + 11].min()]
    arms = {}
    for side in 'LR':
        sg = -1 if side == 'L' else 1
        cand = sorted(i for i in notches if sg * (c[i, 0] - cx) > 0 and top + 0.2 * H < c[i, 1] < top + 0.88 * H)
        best = None
        pp = prior.get(side) if prior else None     # an expected hand center (canvas px): the nearest bulge wins
        for a in range(len(cand)):
            i, j = cand[a], cand[(a + 1) % len(cand)]
            if i == j:
                continue
            for seg in _arcs(i, j, n):
                P = c[seg]
                if not (0.15 * U < len(seg) < 0.9 * U) or (sg * (P[:, 0] - cx) < 0).any():
                    continue
                pro = (sg * P[:, 0]).max() - max(sg * c[i, 0], sg * c[j, 0])
                score = pro if pp is None else -np.hypot(*(P.mean(0) - np.array(pp)))
                if pro >= 0.015 * U and (best is None or score > best[0]):
                    best = (score, P)
        if best is None:
            continue
        P = best[1]
        if P[0, 1] > P[-1, 1]:
            P = P[::-1]
        e0 = sg * P[0, 0]                          # the torso edge at the upper notch
        k = int(np.argmax(sg * P[:, 0]))
        tip = sg * P[k, 0]
        pro = tip - e0
        q1 = len(P) - 1
        for q in range(k, len(P)):                 # below the tip: back at the torso edge
            if sg * P[q, 0] <= e0 + 0.3 * pro:
                q1 = q
                break
        y0, y1 = P[0, 1], P[q1, 1]
        outer, inner = sg * tip, sg * (e0 - 0.4 * pro)
        hx, rx = (outer + inner) / 2, abs(outer - inner) / 2
        hy, ry = (y0 + y1) / 2, (y1 - y0) / 2
        if rx < 0.62 * ry:                         # a mitten that barely sticks out (star): keep its proportions
            rx = 0.62 * ry
            hx = outer - sg * rx
        arms[side] = dict(start=P[0], end=P[q1], tip=P[k], hand=(hx, hy, rx, ry), arc=P[:q1 + 1])
    return arms


def arm_regions(A, arms, grow=1.0):
    """Bool canvas mask per side: the mitten (hand ellipse ∩ silhouette) ∪ the outline bulge between its notches."""
    yy, xx = np.mgrid[0:CW, 0:CW]
    out = {}
    for s, a in arms.items():
        hx, hy, rx, ry = a['hand']
        e = ((xx - hx) / (rx * grow)) ** 2 + ((yy - hy) / (ry * grow)) ** 2 <= 1
        poly = np.zeros((CW, CW), np.uint8)
        cv2.fillPoly(poly, [a['arc'].astype(np.int32)], 1)
        out[s] = (e | poly.astype(bool)) & A
    return out


def _span(m, y):
    r = np.nonzero(m[int(round(y))])[0]
    return (r.min(), r.max()) if len(r) else None


@lru_cache(None)
def face_masks(body):
    """(default face mask, every-face mask, eye boxes, widest-letter mask) on the canvas."""
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    place_part(c, f'eyes:{FACE_EYES}', b)
    eyes = np.asarray(c.getchannel('A')) > 40
    place_part(c, f'mouth:{FACE_MOUTH}', b)
    face = np.asarray(c.getchannel('A')) > 40
    allf = face.copy()
    for k, it in MAN['items'].items():
        if k.split(':')[0] in ('eyes', 'mouth') and it.get('slot') in ('eyes', 'mouth'):
            c2 = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
            try:
                place_part(c2, k, b)
            except FileNotFoundError:
                continue
            allf |= np.asarray(c2.getchannel('A')) > 40
    lab, n = ndimage.label(eyes)
    sz = ndimage.sum(eyes, lab, range(1, n + 1))
    boxes = []
    for i in np.argsort(sz)[::-1][:2]:
        yy, xx = np.nonzero(lab == i + 1)
        boxes.append((xx.min(), yy.min(), xx.max(), yy.max()))
    c3 = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    draw_letter(c3, b, 'W')
    draw_letter(c3, b, 'M')
    letter = np.asarray(c3.getchannel('A')) > 40
    return face, allf, sorted(boxes), letter


def _box(m):
    ys, xs = np.nonzero(m)
    return [bu(xs.min()), bu(ys.min()), bl(xs.max() - xs.min()), bl(ys.max() - ys.min())]


def _feet(A, hip_y, crotch=None):
    """The two feet: the silhouette below the hip line, as two boxes. Their width comes from the rows below the
    crotch (where the feet are apart; joined feet are split at the thinnest column)."""
    sub = A.copy()
    sub[:int(max(hip_y, crotch or 0))] = False
    lab, n = ndimage.label(sub)
    sz = ndimage.sum(sub, lab, range(1, n + 1))
    comps = [lab == i + 1 for i in np.argsort(sz)[::-1][:2] if sz[i] > 200]
    if len(comps) == 1:
        ys, xs = np.nonzero(comps[0])
        cols = comps[0].sum(0).astype(float)
        mid = (xs.min() + xs.max()) / 2
        win = np.arange(int(mid - 0.08 * U), int(mid + 0.08 * U))
        cx = win[np.argmin(cols[win])]                # the thinnest column near the middle
        xx = np.arange(CW)[None, :]
        comps = [comps[0] & (xx < cx), comps[0] & (xx >= cx)]
    out = []
    for cm in comps:
        ys, xs = np.nonzero(cm)
        # the ankle: going up from the floor the foot widens to its widest row, then narrows into the leg (star) —
        # the foot starts at the narrowest row above that (no narrowing: the foot tucks straight under the torso)
        rows = np.arange(ys.max(), ys.min() - 1, -1)
        w = ndimage.uniform_filter1d(np.array([cm[y].sum() for y in rows], float), 9)
        k = int(np.argmax(w[:int(0.12 * U)]))     # the foot itself: its widest row near the floor
        y0 = int(hip_y)
        if k < len(w) - 1:
            j = k + int(np.argmin(w[k:]))
            if w[j] < 0.85 * w[k] and j < len(w) - 3:
                y0 = rows[j]
        sub_ = cm.copy()
        sub_[:y0] = False
        yy, xx = np.nonzero(sub_)
        out.append((xx.min(), y0, xx.max(), ys.max()))
    return sorted(out)


def measure(body):
    """Every landmark of one body, in body units (+ the private canvas masks under '_')."""
    b = MAN['bodies'][body]
    A = alpha_mask(body)
    ys = np.nonzero(A.any(1))[0]
    xs = np.nonzero(A.any(0))[0]
    top, bot = ys.min(), ys.max()
    face, allf, eye_boxes, letter = face_masks(body)
    fys = np.nonzero(face.any(1))[0]
    lys = np.nonzero(letter.any(1))[0]
    lx = np.nonzero(letter.any(0))[0]

    hp = b.get('handsPrior') or HANDS_PRIOR.get(body)
    arms = find_arms(A, {s_: (M + v[0] * U, M + v[1] * U) for s_, v in hp.items()} if hp else None)
    regions = arm_regions(A, arms)
    arm_any = np.zeros_like(A)
    for m in regions.values():
        arm_any |= m
    arm_top = min(a['start'][1] for a in arms.values())

    # torso: the silhouette without the arm bulges
    torso = A.copy()
    for s, a in arms.items():
        poly = np.zeros((CW, CW), np.uint8)
        cv2.fillPoly(poly, [a['arc'].astype(np.int32)], 1)
        torso &= ~poly.astype(bool)

    # hips: the bottom of the torso = the notches where the feet tuck under it (outer foot tops); crotch = top of
    # the gap between the feet
    c = _contour(A)
    t = _turning(c)
    cxm = (xs.min() + xs.max()) / 2
    low = [i for i in range(len(c)) if t[i] < -20 and t[i] == t[max(0, i - 10):i + 11].min()
           and c[i, 1] > max(a['end'][1] for a in arms.values()) + 0.01 * U]
    crotch = None
    for y in range(bot, int(top + (bot - top) * 0.5), -1):
        e = np.diff(np.concatenate([[0], A[y].astype(np.int8), [0]]))
        runs = np.nonzero(e == 1)[0]
        if len(runs) >= 2:
            crotch = y
        elif crotch is not None:
            break
    outer = [c[i, 1] for i in low if abs(c[i, 0] - cxm) > 0.12 * U]
    hip_y = float(np.median(outer)) if outer else (crotch if crotch is not None else bot - 0.115 * (bot - top))
    if crotch is not None:
        hip_y = min(hip_y, crotch + 0.02 * U) if hip_y > crotch else hip_y
    feet = _feet(A, hip_y, crotch)
    hs = _span(torso, hip_y - 2) or _span(A, hip_y - 2)

    # head-top curve: top row per column, over the part of the outline above the shoulder line
    shoulder_y = arm_top - 0.015 * U
    curve = []
    for x in range(xs.min(), xs.max() + 1):
        col = np.nonzero(A[:, x])[0]
        if len(col) and col.min() < shoulder_y:
            curve.append((x, col.min()))
    curve = np.array(curve, float)
    eye_y = M + b['eyeY'] * U
    band_y = top + HEAD_BAND * (eye_y - top)
    hl, hr = _span(A, band_y)
    peak = curve[np.argmin(curve[:, 1])]
    samples = curve[np.linspace(0, len(curve) - 1, 33).astype(int)]

    # shoulders: the silhouette edge just above the arm roots (per side: the bean leans), + the upper corners
    sh = {}
    for s, a in arms.items():
        y = a['start'][1] - 0.015 * U
        l, r = _span(torso, y)
        sh[s] = [bu(l if s == 'L' else r), bu(y)]
    w_eye = np.ptp(np.nonzero(A[int(eye_y)])[0])
    sty = top
    for y in range(top, int(arm_top)):
        r = np.nonzero(A[y])[0]
        if len(r) and np.ptp(r) >= 0.8 * w_eye:
            sty = y
            break
    stl, str_ = _span(A, sty)

    # the arm-free neck band: under the mouth, above the letter, between the arms (the arm roots sit beside the face
    # on these head-bodies, so the band is bounded by the arms' inner edges, not by rows above them)
    mouth_bot = fys.max()
    band_bot = lys.min()
    band_rows = slice(int(mouth_bot), int(band_bot) + 1)
    ax0 = max([np.nonzero(regions['L'][band_rows].any(0))[0].max()] if 'L' in regions and regions['L'][band_rows].any() else [xs.min()])
    ax1 = min([np.nonzero(regions['R'][band_rows].any(0))[0].min()] if 'R' in regions and regions['R'][band_rows].any() else [xs.max()])
    bs = _span(A, (mouth_bot + band_bot) / 2) or (ax0, ax1)
    ax0, ax1 = max(ax0, bs[0]), min(ax1, bs[1])
    # the waist: the free band between the letter and the hip line
    w0, w1 = lys.max() + 0.012 * U, hip_y - 0.004 * U
    room = w1 - w0
    wy = (w0 + w1) / 2 if room > 0.026 * U else (M + (b['letterBox'][1] + b['letterBox'][3] * 0.8) * U)
    ws = _span(torso, wy) or _span(A, wy)

    rows = []
    for yb in np.arange(round((top - M) / U, 2), round((hip_y - M) / U, 2) + 1e-9, 0.01):
        sp = _span(torso, M + yb * U)
        if sp:
            rows.append([round(float(yb), 2), bu(sp[0]), bu(sp[1])])

    cont = cv2.approxPolyDP(_contour(A).astype(np.float32).reshape(-1, 1, 2), 0.003 * U, True)[:, 0, :]
    lm = dict(
        bbox=[bu(xs.min()), bu(top), bu(xs.max()), bu(bot)],
        contour=[[bu(x), bu(y)] for x, y in cont],
        headTop=dict(curve=[[bu(x), bu(y)] for x, y in samples], peak=[bu(peak[0]), bu(peak[1])],
                     bandY=bu(band_y), x=bu((hl + hr) / 2), w=round(max(bl(hr - hl), HEAD_MIN_FACE * _box(face)[2]), 4),
                     bandW=bl(hr - hl)),
        face=dict(box=_box(face), boxMax=_box(allf), eyes=[[bu(x0), bu(y0), bl(x1 - x0), bl(y1 - y0)] for x0, y0, x1, y1 in eye_boxes],
                  x=b['face']['x'], eyeY=b['eyeY'], mouthY=b['mouthY']),
        letter=dict(box=list(b['letterBox']), ink=[bu(lx.min()), bu(lys.min()), bl(lx.max() - lx.min()), bl(lys.max() - lys.min())]),
        shoulders=dict(y=round(float(np.mean([v[1] for v in sh.values()])), 4), **sh),
        shoulderTop=dict(y=bu(sty), L=[bu(stl), bu(sty)], R=[bu(str_), bu(sty)]),
        arms={s: dict(start=[bu(a['start'][0]), bu(a['start'][1])], end=[bu(a['end'][0]), bu(a['end'][1])],
                      tip=[bu(a['tip'][0]), bu(a['tip'][1])],
                      hand=[bu(a['hand'][0]), bu(a['hand'][1]), bl(a['hand'][2]), bl(a['hand'][3])]) for s, a in arms.items()},
        neckBand=dict(y0=bu(mouth_bot), y1=bu(band_bot), x0=bu(ax0), x1=bu(ax1), room=bl(band_bot - mouth_bot)),
        waist=dict(y=bu(wy), x0=bu(ws[0]), x1=bu(ws[1]), room=bl(max(0, room)), underLetter=bool(room <= 0.026 * U)),
        hips=dict(y=bu(hip_y), x0=bu(hs[0]), x1=bu(hs[1]), crotch=bu(crotch) if crotch is not None else None),
        feet={s: [bu(f[0]), bu(f[1]), bu(f[2]), bu(f[3])] for s, f in zip('LR', feet)},
        floor=bu(bot),
        torso=rows,
    )
    ov = LANDMARK_OVERRIDES.get(body.split('@')[0])
    if ov and ov.get('headTop') == 'manifest':
        lm['headTop'].update(x=b['headTop']['x'], w=b['headTop']['w'], bandY=b['headTop']['y'], override=ov['why'])
    lm['_'] = dict(A=A, torso=torso, arms=regions, arm_any=arm_any, face=face, allf=allf, letter=letter)
    return lm


def vs_fit(body, lm):
    """How far the measurement is from today's hand fit (rig.HANDS, the manifest's headTop / floor), body units."""
    out = {}
    hf = rig.HANDS.get(body) if body in MAN['bodies'] and body in rig.HANDS else None
    if hf and not body.startswith('lm'):
        out['hands'] = {s: round(float(np.hypot(lm['arms'][s]['hand'][0] - hf[s][0], lm['arms'][s]['hand'][1] - hf[s][1])), 4)
                        for s in 'LR' if s in lm['arms']}
    b = MAN['bodies'][body]
    if 'floor' in b:
        out['floor'] = round(lm['floor'] - b['floor'], 4)
    out['headTopX'] = round(lm['headTop']['x'] - b['headTop']['x'], 4)
    return out


def public(lm):
    return {k: v for k, v in lm.items() if k != '_'}


def load():
    return json.load(open(JSON))['bodies']


def install(lms=None):
    """Use the MEASURED hands everywhere in the rig (pieces.hand, arm_mask, the hand-over layer) instead of the
    hand-fit HANDS, and the measured hip line as the rig's feet line. Call before the first rig() of a body."""
    lms = lms or load()
    for body, lm in lms.items():
        rig.HANDS[body] = {s: tuple(lm['arms'][s]['hand']) for s in 'LR'}
    _orig_rig = rig.rig.__wrapped__

    @lru_cache(None)
    def rig_lm(body):
        R = _orig_rig(body)
        if body in lms:
            R['feet_y'] = M + lms[body]['hips']['y'] * U
        return R
    rig.rig = rig_lm
    for mod in [m for m in list(sys.modules.values()) if m is not None and getattr(m, 'rig', None) is _orig_rig_ref[0]]:
        mod.rig = rig_lm
    _orig_rig_ref[0] = rig_lm
    return lms


_orig_rig_ref = [rig.rig]


# ── debug overlay ─────────────────────────────────────────────────────────────────────────────────────────────────
def _font(size):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def overlay(body, lm, size=560, color='#b9b4d6', drape=None):
    """The body art with every landmark drawn on it (crop around the body, 1 body unit = size px)."""
    S = size / U
    im = rig.tint(rig.body_art(body), color)
    base = Image.new('RGBA', (CW, CW), (250, 250, 252, 255))
    base.alpha_composite(im)
    pr = lm['_']
    a = np.asarray(base).astype(np.float32)
    for s, m in pr['arms'].items():
        a[m, :3] = a[m, :3] * 0.55 + np.array([255, 170, 60]) * 0.45
    a[pr['face'], :3] = (40, 30, 60)
    a[pr['letter'] & ~pr['face'], :3] = a[pr['letter'] & ~pr['face'], :3] * 0.4 + 255 * 0.6
    base = Image.fromarray(a.astype(np.uint8), 'RGBA')
    # crop to the body square + a little margin
    pad = int(0.08 * U)
    base = base.crop((M - pad, M - pad, M + U + pad, M + U + pad)).resize((int((U + 2 * pad) * S),) * 2, Image.LANCZOS)
    d = ImageDraw.Draw(base)

    def p(x, y):
        return ((x * U + pad) * S, (y * U + pad) * S)
    W = max(2, int(size / 220))
    # torso width per row (ticks), contour
    for y, x0, x1 in lm['torso'][::2]:
        d.line([p(x0, y), p(x1, y)], fill=(120, 200, 255, 255), width=1)
    d.line([p(*q) for q in lm['contour'] + lm['contour'][:1]], fill=(30, 30, 30, 255), width=1)
    # head-top curve + band
    d.line([p(*q) for q in lm['headTop']['curve']], fill=(230, 40, 120, 255), width=W + 1)
    ht = lm['headTop']
    d.line([p(ht['x'] - ht['w'] / 2, ht['bandY']), p(ht['x'] + ht['w'] / 2, ht['bandY'])], fill=(230, 40, 120, 255), width=W)
    px, py = p(*ht['peak'])
    d.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(230, 40, 120, 255))
    # face / letter boxes
    for key, col in (('boxMax', (150, 150, 150, 255)), ('box', (20, 160, 60, 255))):
        x, y, w, h = lm['face'][key]
        d.rectangle([p(x, y), p(x + w, y + h)], outline=col, width=W)
    x, y, w, h = lm['letter']['box']
    d.rectangle([p(x, y), p(x + w, y + h)], outline=(40, 80, 230, 255), width=W)
    x, y, w, h = lm['letter']['ink']
    d.rectangle([p(x, y), p(x + w, y + h)], outline=(120, 150, 255, 255), width=1)
    # neck band
    nb = lm['neckBand']
    if nb['y1'] > nb['y0']:
        d.rectangle([p(nb['x0'], nb['y0']), p(nb['x1'], nb['y1'])], outline=(160, 60, 200, 255), width=1)
    if drape is not None:
        d.line([p(x, y) for x, y in drape], fill=(160, 60, 200, 255), width=W + 1)
    # shoulders
    sh = lm['shoulders']
    d.line([p(*sh['L']), p(*sh['R'])], fill=(255, 120, 0, 255), width=W)
    for s in 'LR':
        qx, qy = p(*sh[s])
        d.ellipse([qx - 7, qy - 7, qx + 7, qy + 7], fill=(255, 120, 0, 255))
    st = lm['shoulderTop']
    for s in 'LR':
        qx, qy = p(*st[s])
        d.rectangle([qx - 5, qy - 5, qx + 5, qy + 5], outline=(255, 120, 0, 255), width=2)
    # arms: hand ellipse, start/end notches, hand center
    for s, a_ in lm['arms'].items():
        hx, hy, rx, ry = a_['hand']
        d.ellipse([p(hx - rx, hy - ry), p(hx + rx, hy + ry)], outline=(200, 90, 0, 255), width=W)
        for key, col in (('start', (0, 150, 0, 255)), ('end', (200, 0, 0, 255))):
            qx, qy = p(*a_[key])
            d.polygon([(qx, qy - 7), (qx + 7, qy + 6), (qx - 7, qy + 6)], fill=col)
        qx, qy = p(hx, hy)
        d.line([qx - 8, qy, qx + 8, qy], fill=(0, 0, 0, 255), width=2)
        d.line([qx, qy - 8, qx, qy + 8], fill=(0, 0, 0, 255), width=2)
    # waist, hips, feet, floor
    wa = lm['waist']
    d.line([p(wa['x0'], wa['y']), p(wa['x1'], wa['y'])], fill=(0, 170, 170, 255), width=W + 1)
    hp = lm['hips']
    d.line([p(hp['x0'], hp['y']), p(hp['x1'], hp['y'])], fill=(140, 90, 40, 255), width=W + 1)
    for s, (x0, y0, x1, y1) in lm['feet'].items():
        d.rectangle([p(x0, y0), p(x1, y1)], outline=(90, 60, 30, 255), width=W)
    d.line([p(lm['bbox'][0] - 0.05, lm['floor']), p(lm['bbox'][2] + 0.05, lm['floor'])], fill=(0, 0, 0, 255), width=W)
    d.text((10, 8), body, font=_font(int(size / 16)), fill=(30, 20, 50, 255))
    return base.convert('RGB')


LEGEND = ('pink: head-top curve + band (head width) · green: face box (grey: every face part) · blue: letter box (light: '
          'W/M ink) · purple: neck band + necklace drape · orange: shoulder line/points (squares: shoulder tops) · '
          'brown ellipses: hands (▲ start, ▲ end) · teal: waist · brown: hips · boxes: feet · black: floor · '
          'cyan ticks: torso width')


def main(only):
    os.makedirs(OUT, exist_ok=True)
    bodies = [b for b in MAN['bodies'] if not only or b in only]
    old = json.load(open(JSON))['bodies'] if os.path.exists(JSON) and only else {}
    res = dict(old)
    tiles = []
    for body in bodies:
        lm = measure(body)
        lm['vsFit'] = vs_fit(body, lm)
        res[body] = public(lm)
        print(f'{body:8s}', 'hands Δ', lm['vsFit'].get('hands'), 'neck room', lm['neckBand']['room'], 'waist room', lm['waist']['room'])
        tiles.append((body, lm))
    with open(JSON, 'w') as f:
        json.dump(dict(version=1, units='body (fractions of the body art square)', U=U,
                       source='integration/landmarks.py (measured from parts/art-av-body-<id>.png + the manifest face/letter anchors)',
                       bodies=res), f, indent=1)
    # overlays need the drape (measured hands): computed in a clean process by rules.py; here the measured arms only
    install({b: res[b] for b in res})
    from pieces import drape_path
    ims = []
    for body, lm in tiles:
        try:
            xs_, ys_, _ = drape_path(body)
            dr = [((x - M) / U, (y - M) / U) for x, y in zip(xs_[::6], ys_[::6])]
        except Exception:
            dr = None
        im = overlay(body, lm, drape=dr)
        im.save(os.path.join(OUT, f'overlay-{body}.jpg'), quality=86)
        ims.append(im)
    if len(ims) > 1:
        T = 300
        cols = 6
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new('RGB', (T * cols, T * rows + 44), (255, 255, 255))
        for i, im in enumerate(ims):
            sheet.paste(im.resize((T, T), Image.LANCZOS), ((i % cols) * T, (i // cols) * T))
        cut = LEGEND.rfind(' · ', 0, len(LEGEND) // 2 + 20)
        for k, line in enumerate((LEGEND[:cut], LEGEND[cut + 3:])):
            ImageDraw.Draw(sheet).text((8, T * rows + 6 + k * 18), line, font=_font(12), fill=(40, 40, 40))
        sheet.save(os.path.join(OUT, 'overlays.jpg'), quality=86)
    print('wrote', JSON, OUT)


if __name__ == '__main__':
    main(sys.argv[1:])
