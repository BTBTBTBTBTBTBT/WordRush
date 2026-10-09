#!/usr/bin/env python3
"""Attachment rules (STEP ONE, prototype 10-06): every mascot-maker item placed from the body's LANDMARKS
(landmarks.json) by one rule, instead of per-body hand fits.

A rule names
  anchor   the landmark(s) it attaches to          (head-top curve, hand center, drape bottom, waist line, …)
  scale    how its size follows the body           (head width × k, hand diameter × k, biggest that clears, …)
  split    which layers it ships as                (back / under / wrap / held / head / face / neckFront / feet / pet …)
  zone     where it may be                         (above the eyes, inside the arm-free band, beside the feet, …)
  curve    an optional path it follows             (head-top curve, the necklace drape, the waist line)
and optionally an `override` (keep today's hand fit for that item, with the reason).

The renderer (render()) only sees MEASURED landmarks: LM.install() swaps the rig's hand-fit HANDS for the measured
hands and its feet line for the measured hip line, so the existing drawing helpers (drape, straps, warps, contact
shadows, AO, the hand-over cut) run on measurements. Output = the same per-body layers ship-integrated.py ships
(`pieces`: [[layer, x, y, w, h]] + layer art), or for items that ship as ONE art at an anchor today (hats, face
items, the bow tie, the medal, the wings) a per-body rect — shippable as `bodies.<id>.overrides` without new art.

    python3 integration/rules.py                → integration/rule-pieces.json (+ layer art in out/landmarks/_layers)
    python3 integration/rules.py --table        → print the rule table
"""
import importlib.util, json, math, os, sys
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy import ndimage  # noqa: E402
import rig  # noqa: E402
import landmarks as LM  # noqa: E402
from rig import U, M, CW, MAN, P, place, light_match, tint, trim, load, alpha  # noqa: E402

PARTS = os.path.join(os.path.dirname(HERE), 'parts')
LAYERS_OUT = os.path.join(HERE, 'out', 'landmarks', '_layers')
# one global calibration: hat width = HAT_C × item k × measured head width (fits the hand-placed headTop.w on 10 of
# 12 bodies within ±10%; drop and cloud were hand-placed lower, on the wider body)
HAT_C = 0.95
HAT_EYE_CLEARANCE = 0.012          # = avatar-layout.ts
TINT = {'backpack': '#f97316', 'supercape': '#2563eb', 'wings': '#38bdf8'}   # the sheets' accessory colors

PC = NP = SI = SS = None
LMS = {}


def setup(lms=None):
    """Install the measured landmarks into the rig, then import the drawing helpers (they bind the patched rig)."""
    global PC, NP, SI, SS, LMS
    LMS = LM.install(lms)
    import pieces as _pc
    import new_pieces as _np
    PC, NP = _pc, _np
    SI = _load('ship_integrated', 'ship-integrated.py')
    SS = _load('ship_seasonal', 'ship-seasonal.py')
    return LMS


def _load(name, fn):
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, fn))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ── the rule table ───────────────────────────────────────────────────────────────────────────────────────────────
def R(kind, anchor, scale, split, zone, curve=None, **params):
    return dict(kind=kind, anchor=anchor, scale=scale, split=split, zone=zone, curve=curve, params=params)


HAT = lambda **p: R('hat', 'head-top curve (the opening rests on it) + head center x', 'head width × k (k = item w × 0.95)',
                    'head (one art)', 'above the eye line − 0.012 (unless over-face)', 'head-top curve', **p)
FACE = lambda line, **p: R('face', f'face center + the {line}', 'face width × k (item w)', 'face (one art)',
                          'on the face; never on the letter', None, line=line, **p)
HELD = lambda **p: R('held', 'hand center (grip point of the art in the fist)', 'hand diameter × k', 'held (+ hand-over cut)',
                     'beside the body, off the face + letter (nudged out); the side with room', None, **p)
DRAPE = lambda **p: R('drape', 'shoulder points + the drape bottom (U under the mouth)', 'band thickness (body units)',
                      'wrap (front, tucked behind at the ends)', 'inside the arm-free band: below the mouth, above the '
                      'letter, inside the arms', 'necklace drape (pieces.drape_path)', **p)
BUDDY = lambda where, **p: R('buddy', {'floor': 'floor line + the outer edge of the right foot', 'head': 'head-top curve',
                                       'shoulder': 'right shoulder top', 'fly': 'left of the head at the eye line',
                                       'float': 'right of the mouth line'}[where],
                             'k × √(body height ÷ classic body height)', 'pet', 'beside the body, never over the face or '
                             'letter', 'head-top curve' if where in ('head', 'shoulder') else None, where=where, **p)


def build_rules():
    rules = {}
    for key, it in MAN['items'].items():
        kind, pid = key.split(':', 1)
        if kind not in ('acc', 'brows') or it.get('slot') is None:
            continue
        slot, layer = it.get('slot'), it.get('layer')
        if kind == 'brows':
            rules[key] = R('brows', 'the two eye boxes', 'eye width', 'brows', 'above each eye', None)
        elif slot == 'head':
            rules[key] = HAT(over_face=bool(it.get('overFace')))
        if it.get('overFace'):
            rules[key]['anchor'] = 'the sides of the head just above the eye line (cup row)'
            rules[key]['scale'] = 'the body width at the cup row × 1.1'
            rules[key]['zone'] = 'above the eye line − 0.012 (cups beside the head, not over the eyes)'
        elif slot == 'glasses':
            rules[key] = FACE('eye line')
        elif slot == 'mustache':
            rules[key] = FACE('mustache line')
        elif slot == 'cheeks':
            rules[key] = FACE('cheek line')
    # neck / chest
    rules['acc:bowtie'] = R('pendant', 'the drape bottom (between mouth and letter)', 'the biggest of k × shoulder span '
                            '(100–60%) that clears the face + letter', 'neckFront (one art); under the letter (letter '
                            'on top) when nothing clears', 'inside the arm-free neck band', 'necklace drape', k=0.38,
                            anchor_y=0.5)
    rules['acc:medal'] = R('pendant', 'the drape (the ribbon hangs from it): its bottom, else slid toward the left arm',
                           'the biggest of k × shoulder span (100–60%) that clears the face + letter', 'neckFront (one '
                           'art); under the letter when nothing clears', 'below the mouth, off the letter',
                           'necklace drape', k=0.42, anchor_y=0.1, slide=True)
    rules['acc:chain'] = R('necklace', 'shoulder points + the drape bottom', 'link height 0.032 (perspective → 0.5× at '
                           'the ends)', 'wrap', 'inside the arm-free band; withheld where the drape cannot clear the '
                           'face + letter (> 1%)', 'necklace drape')
    rules['acc:scarf'] = DRAPE(builder='scarf', thick=0.10, tail='in the gap between the left arm and the letter')
    rules['acc:bandana'] = DRAPE(builder='bandana', thick=0.08, knot='just inside the left arm')
    rules['acc:lei'] = DRAPE(builder='lei', thick=0.10)
    for pid in ('cape', 'supercape'):
        rules[f'acc:{pid}'] = R('cape', 'the neck line (top 0.14 above it) + the floor', 'width = body width at the neck '
                                'line × 1.28 + 0.06 (peeks out at the sides)', 'back (clipped outside the body, AO) + wrap '
                                '(cord on the drape, clasp at its bottom)', 'behind; front parts inside the arm-free band',
                                'necklace drape (cord)', white=(pid == 'supercape'))
    rules['acc:cape-drape'] = R('cape', 'the neck line + the floor', 'width = body width at the neck line × 1.08 + 0.04',
                                'back + wrap (collar, biggest that clears)', 'behind; collar in the neck band', None,
                                builder='cape-drape')
    rules['acc:vampirecollar'] = R('cape', 'the neck line (the collar flares behind the head)', 'width = body width at '
                                   'the neck line × 1.08 + 0.06, 0.66–1.0', 'back + wrap (cord + clasp)', 'behind; cord '
                                   'on the drape', 'necklace drape', builder='vampirecollar')
    rules['acc:backpack'] = R('backpack', 'shoulder tops (straps come over) + both hand centers (straps end under the '
                              'hands)', 'pack width = body width at the eyes × 0.95 (0.5–0.98), never below the hands',
                              'back (pack, AO) + wrap (two straps, hand-over)', 'straps keep 0.035 clear of the face',
                              'shoulder top → side → hand (bezier)')
    for pid, k, y in (('wings', 1.93, 0.036), ('fairywings', 1.83, 0.05)):
        rules[f'acc:{pid}'] = R('wings', 'torso center at the eye line', 'body width at the eye line × k (0.95–1.45)',
                                'back (one art)', 'behind, centered; peeks out at both sides', None, k=k, dy=y)
    rules['acc:batwings'] = R('wings', 'torso center at the eye line', 'body width at the eye line × 2.25 (0.95–1.45)',
                              'back (clipped, AO)', 'behind, centered', None, k=2.25, dy=0.04, pieces=True)
    rules['acc:cattail'] = R('tail', 'the hip line, inside the right edge', 'height = body height × 0.62 (≤ 0.56)',
                             'back (clipped, AO)', 'behind; the base tucks behind the lower back', None)
    rules['acc:belt'] = R('belt', 'the waist line (between the letter and the legs)', 'thickness = waist room (≤ 0.06); '
                          'width = the body at that line', 'wrap (or under the letter when there is no room)',
                          'the waist band; waist garment (may go around the arms)', 'waist line (a smile sag)')
    rules['acc:apron'] = R('apron', 'the drape bottom (neck strap) + the hip line', 'width = torso width at the top × 0.82',
                           'under (the letter sits on it) + wrap (neck strap on the drape)', 'the torso; waist garment',
                           'necklace drape (strap)')
    for pid in ('sneakers', 'boots', 'slippers', 'skates'):
        rules[f'acc:{pid}'] = R('shoes', 'each foot box (from the ankle / hip line to the floor)', 'foot width × 1.25 '
                                '(boots 1.36)', 'feet (the torso stays in front of the shoe tops)', 'on the feet', None)
    # held (13 + the rebuilt bubble tea and guitar)
    for pid in ('mug', 'book', 'pencil-big', 'balloon', 'trophy', 'magnifier', 'flashlight', 'umbrella', 'icecream',
                'spatula', 'mic', 'wand-star'):
        rules[f'acc:{pid}'] = HELD(builder='np', tall=pid in ('balloon', 'umbrella'))
    rules['acc:candypail'] = HELD(builder='seasonal')
    rules['acc:bubbletea'] = HELD(builder='bubbletea')
    rules['acc:guitar'] = R('held', 'hand center (holds the neck at 38% from the top)', 'length = hand-to-floor ÷ 0.62',
                            'held (+ hand-over)', 'stands on the floor beside the body; the side with room', None,
                            builder='guitar', tall=True)
    # buddies
    for pid, where, k in (('bird', 'head', 0.21), ('snail', 'shoulder', 0.19), ('kitten', 'floor', 0.32),
                          ('puppy', 'floor', 0.32), ('blackcat', 'floor', 0.30), ('bat', 'fly', 0.40),
                          ('ghost', 'float', 0.32)):
        rules[f'acc:{pid}'] = BUDDY(where, k=k)
    for pid in ('sweat', 'tear', 'steam', 'heart'):
        rules[f'acc:{pid}'] = R('extra', 'the eye boxes', 'eye width × k', 'extra', 'beside the face', None)
    missing = [k for k, it in MAN['items'].items() if k.split(':')[0] in ('acc', 'brows') and k not in rules]
    assert not missing, missing
    return rules


RULES = build_rules()

# Today's hand fit kept where it is clearly better (after the side-by-side review, compare.py; REPORT-LANDMARKS.md).
# (Body-level landmark overrides — the cloud's head band — live in landmarks.LANDMARK_OVERRIDES.)
OVERRIDES = {
    'acc:bowtie': dict(keep='shipped', why='there is no room for a readable bow tie between the mouth and the letter on '
                       '10 of 12 bodies: the rule tucks it under the letter where it all but disappears; today\'s anchor '
                       'fit reads as a bow tie but overlaps the mouth + letter (the guards flag it). Needs smaller / '
                       'flatter bow-tie art, then the rule fit takes over.'),
}


def shipped_rect(key, body):
    """The core layout's anchor placement (avatar-layout.ts: slot point × item w, per-body overrides)."""
    m = MAN['items'][key]
    b = MAN['bodies'][body]
    x, y, base = rig.slot_point(b, m['slot'])
    o = b.get('overrides', {}).get(key, {})
    w = base * m['w'] * o.get('scale', 1)
    h = w * m['aspect']
    return [x - m['anchor'][0] * w + o.get('dx', 0), y - m['anchor'][1] * h + o.get('dy', 0), w, h]


# ── landmark helpers ─────────────────────────────────────────────────────────────────────────────────────────────
@lru_cache(None)
def masks(body):
    return LM.measure(body)['_']


@lru_cache(None)
def top_curve(body):
    """top row (canvas px) per canvas column (inf where the column misses the body)."""
    A = masks(body)['A']
    any_ = A.any(0)
    t = np.where(any_, A.argmax(0), np.inf).astype(float)
    return t


def width_at(body, y_bu):
    A = masks(body)['A']
    r = np.nonzero(A[int(round(P(y_bu)))])[0]
    return ((r.max() - r.min()) / U, ((r.max() + r.min()) / 2 - M) / U) if len(r) else (0, 0.5)


def torso_at(body, y_bu):
    T = masks(body)['torso']
    r = np.nonzero(T[int(round(P(y_bu)))])[0]
    return ((r.max() - r.min()) / U, ((r.max() + r.min()) / 2 - M) / U) if len(r) else width_at(body, y_bu)


def body_h(body):
    lm = LMS[body]
    return lm['floor'] - lm['bbox'][1]


H_CLASSIC = None


def h_ratio(body):
    return math.sqrt(body_h(body) / (LMS['classic']['floor'] - LMS['classic']['bbox'][1]))


@lru_cache(None)
def art_opening(pid, anchor_y):
    """The hat art's opaque span on its anchor row (fractions of the art width), or None (a halo floats)."""
    im = load(os.path.join(PARTS, f'art-av-acc-{pid}.png'))
    a = np.asarray(im.getchannel('A')) > 128
    y = min(a.shape[0] - 1, int(anchor_y * a.shape[0]))
    for dy in range(0, int(0.08 * a.shape[0])):
        r = np.nonzero(a[max(0, y - dy)])[0]
        if len(r):
            return r.min() / a.shape[1], r.max() / a.shape[1]
    return None


@lru_cache(None)
def cup_gap(pid):
    """Over-face hats (headphones): the see-through gap between the two cups (fractions of the art width) and the
    row it is narrowest on (fraction of the art height)."""
    a = np.asarray(load(os.path.join(PARTS, f'art-av-acc-{pid}.png')).getchannel('A')) > 128
    H_, W_ = a.shape
    best = None
    for y in range(int(H_ * 0.45), int(H_ * 0.95)):
        r = np.nonzero(a[y])[0]
        if len(r) < 2:
            continue
        mid = W_ / 2
        left, right = r[r < mid], r[r >= mid]
        if not len(left) or not len(right):
            continue
        g = (left.max() / W_, right.min() / W_)
        if best is None or g[1] - g[0] < best[1] - best[0]:
            best = (g[0], g[1], y / H_)
    return best


def eyes_rect(b):
    m = MAN['items']['eyes:beady']
    x, y, base = rig.slot_point(b, m['slot'])
    w = base * m['w']
    h = w * m['aspect']
    return x - m['anchor'][0] * w, y - m['anchor'][1] * h, w, h


# ── anchored kinds: a rect per body (one shared art) ─────────────────────────────────────────────────────────────
def hat_rect(key, body):
    m = MAN['items'][key]
    pid = key.split(':')[1]
    lm = LMS[body]
    b = MAN['bodies'][body]
    ht = lm['headTop']
    if RULES[key]['params'].get('over_face'):
        # headphones: the cups clamp the sides of the head just ABOVE the eyes (the art's cups are too close together
        # to straddle the eyes at a sane size): the cup row's width × 1.1, the art's bottom on the eye line − clearance
        g0, g1, gy = cup_gap(pid)
        ex, ey, ew, eh = eyes_rect(b)
        w = ht['w']
        for _ in range(4):
            h = w * m['aspect']
            y = ey - HAT_EYE_CLEARANCE - h
            wr, cr = width_at(body, y + gy * h)
            w = max(wr, ht['w']) * 1.1
        h = w * m['aspect']
        return [cr - w / 2, ey - HAT_EYE_CLEARANCE - h, w, h]
    w = HAT_C * m['w'] * ht['w']
    h = w * m['aspect']
    cx = ht['x']
    op = art_opening(pid, m['anchor'][1])
    tc = top_curve(body)
    if op is None:                      # floats (halo): its anchor row a little above the peak
        y_rest = ht['peak'][1] - 0.02
    else:
        xl, xr = cx + (op[0] - 0.5) * w * 0.9, cx + (op[1] - 0.5) * w * 0.9
        ys = [tc[int(round(P(x)))] if 0 <= int(round(P(x))) < CW else np.inf for x in (xl, xr)]
        y_rest = (max(ys) - M) / U if np.isfinite(max(ys)) else ht['bandY']
    y = y_rest - m['anchor'][1] * h
    ex, ey, ew, eh = eyes_rect(b)
    limit = ey - HAT_EYE_CLEARANCE
    if y + h > limit:
        y = limit - h
    return [cx - w / 2, y, w, h]


def face_rect(key, body):
    m = MAN['items'][key]
    b = MAN['bodies'][body]
    x, y, base = rig.slot_point(b, m['slot'])
    w = base * m['w']
    h = w * m['aspect']
    return [x - m['anchor'][0] * w, y - m['anchor'][1] * h, w, h]


PENDANT_MIN = 0.6     # below 60% of its size a bow tie / medal stops reading


def pendant_rect(key, body):
    """The biggest size (100% → 60%) at the drape bottom that clears the face + letter; the medal may also slide along
    the drape into the gap beside the letter. No room at a readable size → it goes UNDER the letter (the letter is
    drawn on top of it, the face stays clear): returns (rect, 'under')."""
    m = MAN['items'][key]
    p = RULES[key]['params']
    lm = LMS[body]
    pid = key.split(':')[1]
    path = PC.drape_path(body, half=0.011)
    xs, ys, us = path
    xm, ym = PC.drape_bottom(body, path)
    span = lm['shoulders']['R'][0] - lm['shoulders']['L'][0]
    face, letter = PC.guards(body)
    pr = masks(body)
    # off the face + letter, and on the torso (never over an arm or past the torso edge)
    g = face | letter | pr['arm_any'] | ~ndimage.binary_erosion(pr['torso'], iterations=int(0.01 * U))
    im = load(os.path.join(PARTS, f'art-av-acc-{pid}.png'))
    shifts = [0.0] + ([-0.04, -0.08, -0.12, -0.16] if p.get('slide') else [])
    for f in np.linspace(1.0, PENDANT_MIN, 9):
        w = p['k'] * span * f
        h = w * m['aspect']
        for sx in shifts:
            i = int(np.argmin(np.abs((xs - M) / U - (xm + sx))))
            x0, y0 = (xs[i] - M) / U, (ys[i] - M) / U
            for dy in (0, -0.006, 0.006, 0.012):
                r = [x0 - w / 2, y0 - p['anchor_y'] * h + dy, w, h]
                if not ((np.asarray(place_rect(im, r).getchannel('A')) > 90) & g).any():
                    return r, MAN['items'][key]['layer']
    # nothing clears at a readable size: UNDER the letter (the letter and the face are drawn on top, so it no longer
    # shrinks to dodge them) at the biggest size that still hangs on the body, from the drape bottom (prefer clear of
    # the mouth)
    body_in = ndimage.binary_dilation(pr['A'], iterations=int(0.012 * U))
    for f in np.linspace(1.0, PENDANT_MIN, 9):
        w = p['k'] * span * f
        h = w * m['aspect']
        fallback = None
        for dy in np.arange(0, 0.09, 0.006):
            r = [xm - w / 2, ym - p['anchor_y'] * h + dy, w, h]
            a = np.asarray(place_rect(im, r).getchannel('A')) > 90
            if (a & ~body_in).sum() <= 0.03 * a.sum():
                if not (a & face).any():
                    return r, 'under'
                fallback = fallback or r
        if fallback:
            return fallback, 'under'
    return None, 'no room at a readable size: under the mouth it covers the face, lower it leaves the body'


def wings_rect(key, body):
    m = MAN['items'][key]
    p = RULES[key]['params']
    b = MAN['bodies'][body]
    wE, cE = width_at(body, b['eyeY'])
    w = float(np.clip(wE * p['k'], 0.95, 1.45))
    h = w * m['aspect']
    return [cE - w / 2, b['eyeY'] + p['dy'] - m['anchor'][1] * h, w, h]


ANCHORED = {'hat': hat_rect, 'face': face_rect, 'pendant': pendant_rect, 'wings': wings_rect}
# halo: floats above the head by design
RULES['acc:halo']['params']['floats_ok'] = True


def place_rect(im, r):
    """A canvas layer with im stretched into rect r (body units)."""
    x, y, w, h = r
    s = im.resize((max(1, round(w * U)), max(1, round(h * U))), Image.LANCZOS)
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    rig._clip_paste(c, s, round(P(x)), round(P(y)))
    return c


# ── pieces kinds: builder layers (back / front / under / held / shoes / beside) ─────────────────────────────────
def pick_side(body, pref, tall=False):
    """Held items go in the preferred hand, unless the other hand has clearly more room beside the face + letter
    (the bean's letter leans right: tall items move to its left hand)."""
    if not tall:
        return pref
    lm = LMS[body]
    lx, ly, lw, lh = lm['letter']['ink']
    fx, fy, fw, fh = lm['face']['box']
    room = {}
    for s in 'LR':
        hx = lm['arms'][s]['hand'][0]
        room[s] = (min(lx, fx) - hx) if s == 'L' else (hx - max(lx + lw, fx + fw))
    other = 'L' if pref == 'R' else 'R'
    return other if room[pref] < 0.75 * room[other] else pref


def held_np(name, body, side):
    """new_pieces.held with the side chosen by the rule (no per-body special case)."""
    spec = NP.HELD[name]
    sg = 1 if side == 'R' else -1
    im = light_match(NP.piece(name), 0.06)
    gx, gy = spec['grip']
    if side == 'L':
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
        gx = 1 - gx
    hx, hy, rx, ry = PC.hand(body, side)
    w = rx * 2 * spec['w'] * 1.3
    lay = PC.avoid(lambda dx, dy: place(im, hx + sg * (rx * 0.25 + dx), hy + ry * 0.1, w, anchor=(gx, gy),
                                        rot=-sg * spec['rot'] - sg * dx * 40), body, step=(0.01, 0), tries=16,
                   masks=('face', 'letter'))
    out = dict(held=[lay], handover=(side,))
    if name == 'balloon':
        out['grip_range'] = (0.003, 0.5)
    if name == 'pencil-big':
        out['grip_range'] = (0.02, 0.7)
    return out


def guitar(body, side):
    g = PC.cut('guitar')
    a = np.asarray(g.getchannel('A')) > 60
    ys, xs = np.nonzero(a)
    ev, evec = np.linalg.eigh(np.cov(np.vstack([xs - xs.mean(), ys - ys.mean()])))
    g = trim(g.rotate(math.degrees(math.atan2(evec[1, -1], evec[0, -1])) + 90, Image.BICUBIC, expand=True))
    a = np.asarray(g.getchannel('A')) > 60
    if np.nonzero(a)[0].mean() < g.height / 2:
        g = g.rotate(180)
    g = trim(g)
    sg = 1 if side == 'R' else -1
    if side == 'L':
        g = g.transpose(Image.FLIP_LEFT_RIGHT)
    hx, hy, rx, ry = PC.hand(body, side)
    Lg = (LMS[body]['floor'] - hy) / 0.62
    w = Lg * g.width / g.height
    g = light_match(g, 0.06)
    held = PC.avoid(lambda dx, dy: place(g, hx + sg * (rx * 0.55 + dx), hy - Lg * 0.36, w, anchor=(0.5, 0.0),
                                         rot=sg * (-8 - dx * 60)), body, step=(0.012, 0), tries=20, masks=('letter',))
    return dict(held=[held], handover=(side,))


def bubbletea(body, side='R'):
    hx, hy, rx, ry = PC.hand(body, side)
    sg = 1 if side == 'R' else -1
    t = light_match(PC.cut('bubbletea'), 0.06)
    if side == 'L':
        t = t.transpose(Image.FLIP_LEFT_RIGHT)
    held = PC.avoid(lambda dx, dy: place(t, hx + sg * (rx * 0.5 + dx), hy + ry * 0.55 - dx * 1.5, rx * 3, anchor=(0.5, 0.8),
                                         rot=-6 * sg), body, step=(0.012, 0), masks=('letter',))
    return dict(held=[held], handover=(side,))


def backpack(body):
    """pieces.backpack, with the straps tucked around the torso: below the shoulder tops (where they come over
    from behind) a strap never shows past the torso edge (tall / bean: they rode on the outline)."""
    L = PC.backpack(body, 'white')
    lm = LMS[body]
    pr = masks(body)
    keep = ndimage.binary_dilation(pr['torso'], iterations=int(0.008 * U))
    keep[:int(P(lm['shoulderTop']['y'] + 0.06))] = True
    soft_ = ndimage.gaussian_filter(keep.astype(np.float32), 1.0)
    front = []
    for im in L['front']:
        a = np.asarray(im).copy()
        a[..., 3] = (a[..., 3] * soft_).astype(np.uint8)
        front.append(Image.fromarray(a, 'RGBA'))
    return dict(L, front=front)


def chain(body):
    c = PC.cut('chain')
    W, H = c.size
    link = light_match(trim(c.crop((int(W * 0.40), int(H * 0.80), int(W * 0.60), H))), 0.08)
    return dict(front=[PC.drape_chain(body, link)], handover=())


def belt(body):
    lm = LMS[body]
    A = masks(body)['A']
    wa = lm['waist']
    if wa['underLetter']:
        yc, th = P(wa['y']), 0.05 * U
    else:
        yc, th = P(wa['y']), min(wa['room'], 0.06) * U
    crotch = lm['hips'].get('crotch')
    if crotch and not wa['underLetter']:     # the belt (+ its 0.012 sag) stays above the gap between the legs …
        yc = min(yc, P(crotch) - th / 2 - 0.016 * U)
        if yc - th / 2 < P(lm['letter']['ink'][1] + lm['letter']['ink'][3]) + 0.004 * U:
            wa = dict(wa, underLetter=True)  # … and when that leaves no room under the letter it goes under it
            yc, th = P(lm['letter']['box'][1] + lm['letter']['box'][3] * 0.8), 0.05 * U
    row = np.nonzero(A[int(yc)])[0]
    x0, x1 = row.min(), row.max()
    n = x1 - x0 + 1
    u = (np.arange(n) - n / 2) / (n / 2)
    sag = 0.012 * U * (1 - u ** 2)
    top, bot = yc - th / 2 + sag, yc + th / 2 + sag
    band = PC.warp_to_band(light_match(NP.piece('belt-strip'), 0.05), x0, x1, top, bot, A)
    bkx = ((x0 + x1) / 2 - M) / U
    lb = lm['letter']['box']
    if wa['underLetter']:
        bkx = min((x1 - M) / U - th / U, lb[0] + lb[2] + th / U * 0.9)
    bk = place(light_match(NP.piece('belt-buckle'), 0.05), bkx, (yc + 0.012 * U * 0.9 - M) / U, th / U * 1.45, anchor=(0.5, 0.5))
    if wa['underLetter']:
        return dict(under=[band], front=[bk], handover=(), seat_min=0.45)
    return dict(front=[band, bk], handover=(), seat_min=0.45)


def apron(body, color='red'):
    lm = LMS[body]
    A = masks(body)['A']
    xs, ys, us = PC.drape_path(body, half=0.012)
    xb, yb = PC.drape_bottom(body, (xs, ys, us))
    tw, tc = torso_at(body, yb + 0.03)
    w = tw * 0.82
    hgt = lm['hips']['y'] - (yb + 0.01)
    panel = light_match(tint(NP.piece('apron-panel'), color), 0.06).resize((int(w * U), int(hgt * U)), Image.LANCZOS)
    lay = place(panel, tc, yb + 0.01, w, anchor=(0.5, 0.0))
    a = np.asarray(lay).copy()
    a[..., 3] = a[..., 3] * ndimage.binary_dilation(A, iterations=2)
    strap = PC.drape_cord(body, '#c03535', width=0.02, path=(xs, ys, us))
    return dict(under=[Image.fromarray(a, 'RGBA')], front=[strap], handover=('L', 'R'), seat_min=0.45)


def shoes(name, body):
    lm = LMS[body]
    A = masks(body)['A']
    pair = NP.piece(name)
    a = np.asarray(pair.getchannel('A')) > 40
    cols = a.any(0)
    mid = len(cols) // 2
    gap = [x for x in range(len(cols)) if not cols[x] and abs(x - mid) < len(cols) * 0.25]
    cut_x = int(np.median(gap)) if gap else mid
    Ls, Rs = trim(pair.crop((0, 0, cut_x, pair.height))), trim(pair.crop((cut_x, 0, pair.width, pair.height)))
    lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    vis = lm['floor'] - max(lm['feet']['L'][1], lm['hips'].get('crotch') or 0)    # the foot below the torso
    for (fx0, fy0, fx1, fy1), s in zip((lm['feet']['L'], lm['feet']['R']), (Ls, Rs)):
        s = s.crop((0, int(s.height * (1 - SI.SHOE_KEEP[name])), s.width, s.height))
        fw = (fx1 - fx0) * U * (1.36 if name == 'boots' else 1.25)
        fh = max(vis * U * 1.2, 0.05 * U)
        fh = min(fh, fw * s.height / s.width)
        s = light_match(SI.despill(s.resize((max(1, int(fw)), max(1, int(fh))), Image.LANCZOS)), 0.05)
        lay.alpha_composite(s, (int(P((fx0 + fx1) / 2) - fw / 2), int(P(fy1) + 0.014 * U - fh)))
    a = np.asarray(lay).copy()
    torso = A & (np.arange(CW)[:, None] < P(lm['hips']['y']) - 0.01 * U)
    a[..., 3] = np.where(torso, 0, a[..., 3])
    return dict(shoes=[Image.fromarray(a, 'RGBA')], handover=())


def tail(pid, body):
    """Behind the body: the base tucks behind the lower back just inside the TORSO's right edge (arms excluded), a
    little above the hip line; height = body height × 0.62 (≤ 0.56), curling up beside the body."""
    lm = LMS[body]
    im = light_match(SS.src('halloween', 'pieces/cat-tail.png'), 0.05).transpose(Image.FLIP_LEFT_RIGHT)
    y = lm['hips']['y'] - 0.06
    tw, tc = torso_at(body, y)
    r = tc + tw / 2
    h = min(0.56, body_h(body) * 0.62)
    w = h * im.width / im.height
    return dict(back=[place(im, r + w * 0.62 - 0.055, y + h * 0.08, w, anchor=(0.62, 0.95))], handover=())


SEASON_PET = {'bat': 'props/bat.png', 'ghost': 'props/ghost.png', 'blackcat': 'props/black-cat.png'}


def buddy(pid, body):
    p = RULES[f'acc:{pid}']['params']
    lm = LMS[body]
    b = MAN['bodies'][body]
    im = light_match(SS.src('halloween', SEASON_PET[pid]) if pid in SEASON_PET else NP.piece(pid), 0.05)
    w = p['k'] * h_ratio(body)
    tc = top_curve(body)
    where = p['where']
    if where == 'head':
        x = lm['headTop']['x'] + lm['headTop']['w'] * 0.32
        y = (tc[int(P(x))] - M) / U + 0.012
        lay = place(im, x, y, w, anchor=(0.5, 0.95))
    elif where == 'shoulder':
        x = lm['shoulderTop']['R'][0] - 0.03
        y = (tc[int(P(x))] - M) / U + 0.01
        lay = place(im, x, y, w, anchor=(0.5, 0.92))
    elif where == 'floor':
        fx = lm['feet']['R'][2]
        lay = place(im, fx + w * 0.5, lm['floor'] + 0.005, w, anchor=(0.5, 1.0))
    elif where == 'fly':
        wE, cE = width_at(body, b['eyeY'])
        l = cE - wE / 2
        lay = PC.avoid(lambda dx, dy: place(im, l - w * 0.12 - dx, lm['headTop']['peak'][1] + 0.06, w, anchor=(0.5, 0.5), rot=8),
                       body, step=(0.012, 0), tries=12)
    else:
        wM, cM = width_at(body, b['mouthY'])
        r = cM + wM / 2
        lay = PC.avoid(lambda dx, dy: place(im, r + w * 0.18 + dx, b['eyeY'] + 0.02, w, anchor=(0.5, 0.5), rot=-6),
                       body, step=(0.012, 0), tries=12)
    return dict(beside=[lay], handover=())


def build(key, body):
    """The builder layers for an item on a body, from its rule. {'unsupported': why} when the rule's zone has no room."""
    pid = key.split(':')[1]
    r = RULES[key]
    kind, p = r['kind'], r['params']
    if kind == 'held':
        b_ = p.get('builder')
        pref = 'R' if b_ != 'np' else NP.HELD[pid]['side']
        side = pick_side(body, pref, p.get('tall'))
        if b_ == 'np':
            return held_np(pid, body, side)
        if b_ == 'guitar':
            return guitar(body, side)
        if b_ == 'bubbletea':
            return bubbletea(body, side)
        return SS.SEASONAL[pid][3](body)
    if kind == 'necklace':
        return chain(body)
    if kind == 'drape':
        if pid == 'scarf':
            return PC.scarf(body)
        if pid == 'bandana':
            return NP.band_wrap('bandana-band', body, thick=0.08, knot='bandana-knot')
        return NP.band_wrap('lei', body, thick=0.1, margin=0.012)
    if kind == 'cape':
        if pid == 'cape':
            return PC.cape(body)
        if pid == 'supercape':
            return PC.cape(body, white=True, acc='white')
        if pid == 'cape-drape':
            return NP.cape_drape(body)
        return SS.SEASONAL[pid][3](body)
    if kind == 'backpack':
        return backpack(body)
    if kind == 'wings':
        return SS.SEASONAL[pid][3](body)
    if kind == 'tail':
        return tail(pid, body)
    if kind == 'belt':
        return belt(body)
    if kind == 'apron':
        return apron(body)
    if kind == 'shoes':
        return shoes(pid, body)
    if kind == 'buddy':
        return buddy(pid, body)
    if kind == 'brows':
        return NP.brows(pid, body)
    if kind == 'extra':
        return NP.extra(pid, body)
    raise KeyError(kind)


def field_of(key):
    """The config field the item ships under (ship-integrated / ship-seasonal), which picks today's fit check."""
    pid = key.split(':')[1]
    if key.startswith('brows:'):
        return 'brows'
    if pid in SS.SEASONAL:
        return SS.SEASONAL[pid][0]
    items = SI.ITEMS()
    if pid in items:
        return items[pid][0]
    k = RULES[key]['kind']
    return {'buddy': 'pet', 'extra': 'extra', 'held': 'held', 'shoes': 'feet'}.get(k, 'neck' if k in ('cape', 'backpack', 'wings', 'tail', 'necklace') else 'wrap')


def fit_check(key, body, L):
    """Today's fit check (fitcheck.check / build_new.check_new, the seasonal tail floor) on the builder layers."""
    pid = key.split(':')[1]
    field = field_of(key)
    if field == 'neck':
        m, f = SI.check(body, L)
        if pid in SS.BACK_HIDDEN_MIN:
            f = [x for x in f if not (x.startswith('not behind') and m.get('back_hidden', 0) >= SS.BACK_HIDDEN_MIN[pid])]
        return m, f
    return SI.check_new(body, L)


def render(key, body):
    """→ dict(layers={layer: canvas RGBA}, rect=…|None, fails=[…], unsupported=str|None)."""
    r = RULES[key]
    pid = key.split(':')[1]
    if r['kind'] in ANCHORED and not r['params'].get('pieces'):
        out = shipped_rect(key, body) if OVERRIDES.get(key, {}).get('keep') == 'shipped' else ANCHORED[r['kind']](key, body)
        rect, layer = out if isinstance(out[1], str) else (out, MAN['items'][key]['layer'])
        if rect is None:
            return dict(layers={}, rect=None, fails=[], unsupported=layer)
        rect = [round(float(v), 4) for v in rect]
        im = load(os.path.join(PARTS, f'art-av-acc-{pid}.png'))
        return dict(layers={layer: place_rect(im, rect)}, rect={layer: rect}, fails=[], unsupported=None)
    L = build(key, body)
    if L.get('unsupported'):
        return dict(layers={}, rect=None, fails=[], unsupported=L['unsupported'])
    _, fails = fit_check(key, body, L)
    if fails and r['kind'] in ('cape', 'apron') and all('cover' in f for f in fails):
        # no room for the cord + clasp / the apron's neck strap between the mouth and the letter (wide, cloud): the
        # cape still hangs behind, the apron panel still sits under the letter (it is drawn before it, so the letter
        # shows on top: exempt from letter coverage)
        L = dict(L, front=[])
        _, fails = fit_check(key, body, L)
    layers = SI.ship_layers(body, field_of(key), L)
    return dict(layers=layers, rect=None, fails=fails, unsupported=None)


def crop_pieces(layers):
    """{layer: canvas} → [[layer, x, y, w, h]] + {layer: cropped art at the shipped 400 px / body unit}."""
    rows, arts = [], {}
    for layer, im in layers.items():
        box = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
        if not box:
            continue
        crop = im.crop(box)
        arts[layer] = crop.resize((max(1, round(crop.width * SI.PX)), max(1, round(crop.height * SI.PX))), Image.LANCZOS)
        rows.append([layer, round((box[0] - M) / U, 4), round((box[1] - M) / U, 4), round((box[2] - box[0]) / U, 4),
                     round((box[3] - box[1]) / U, 4)])
    return rows, arts


def table():
    out = []
    for key, r in RULES.items():
        out.append(f"{key:22s} {r['kind']:9s} anchor: {r['anchor']} | scale: {r['scale']} | split: {r['split']} | "
                   f"zone: {r['zone']}" + (f" | curve: {r['curve']}" if r['curve'] else ''))
    return '\n'.join(out)


def _worker(args):
    body, keys, save = args
    setup()
    res = {}
    for key in keys:
        try:
            o = render(key, body)
        except Exception as e:  # noqa: BLE001
            res[key] = dict(error=repr(e))
            continue
        ent = dict(fails=o['fails'], unsupported=o['unsupported'])
        if o['rect']:
            ent['rect'] = o['rect']
        elif o['layers'] and not o['fails']:
            rows, arts = crop_pieces(o['layers'])
            ent['pieces'] = rows
            if save:
                d = os.path.join(LAYERS_OUT, body)
                os.makedirs(d, exist_ok=True)
                kind = key.split(':')[0]
                for layer, im in arts.items():
                    im.save(os.path.join(d, f"art-av-{kind}-{key.split(':')[1]}-{body}-{layer}.webp"), 'WEBP', quality=88)
        res[key] = ent
    return body, res


def main(argv):
    if '--table' in argv:
        print(table())
        return
    from concurrent.futures import ProcessPoolExecutor
    bodies = [b for b in json.load(open(LM.JSON))['bodies'] if not [a for a in argv if not a.startswith('-')] or b in argv]
    keys = list(RULES)
    out = {}
    with ProcessPoolExecutor(max_workers=4) as ex:
        for body, res in ex.map(_worker, [(b, keys, True) for b in bodies]):
            out[body] = res
            print(body, 'unsupported', [k for k, v in res.items() if v.get('unsupported')], 'fit fails',
                  {k: v['fails'] for k, v in res.items() if v.get('fails')}, 'errors', {k: v['error'] for k, v in res.items() if v.get('error')})
    items = {}
    for body, res in out.items():
        for key, ent in res.items():
            it = items.setdefault(key, dict(rule={k: v for k, v in RULES[key].items() if k != 'params'}, pieces={}, rects={}, withheld={}))
            if ent.get('rect'):
                it['rects'][body] = ent['rect']
            elif ent.get('pieces'):
                it['pieces'][body] = ent['pieces']
            else:
                it['withheld'][body] = ent.get('unsupported') or ent.get('fails') or ent.get('error')
    with open(os.path.join(HERE, 'rule-pieces.json'), 'w') as f:
        json.dump(dict(note='Rule-driven fits (rules.py) on the measured landmarks. pieces = the ship-integrated.py '
                            'format [[layer, x, y, w, h]] (art in out/landmarks/_layers, not committed); rects = '
                            'one-art items placed per body.', items=items), f, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
