# Ship the cast puppets (animation/<id>/rig.json + layers/) to the three apps (2.7.1).
#   python3 docs/design/brand/animation/rig-engine/ship-rigs.py [--check]
#
# One compiled bundle, read by all three players (web lib/cast-rig.ts, iOS WordociousCore
# CastRig.swift, Android core CastRig.kt):
#   Web:     apps/web/public/art/rig/cast-rigs.json + <id>-<layer>.webp
#   Android: res/raw/cast_rigs.json + res/drawable-nodpi/rig_<id>_<layer>.webp (+ raw/keep_rigs.xml)
#   iOS:     Assets.xcassets/cast-rigs.dataset/cast-rigs.json + rig-<id>-<layer>.imageset (PNG)
#   Fixture: packages/../apps/*/ tests read docs/design/brand/animation/rig-engine/rig-golden.json
#            (draw ops from THIS reference evaluator; each platform must match them).
#
# What the compile step adds on top of the mock-board rigs (founder 10-05: "the open and
# close is kind of sudden"):
#   * every layer is cropped to its alpha box and scaled to LAYER_SCALE (hero 1024 -> 384);
#     the rig keeps hero-pixel coordinates, so the players draw each image into its
#     hero-space rect at any size.
#   * `warp`: the signature move plays on its own clock, time-warped so the move eases
#     in from rest and settles back (half speed at the edges, smoothstep to full speed
#     over 0.7 s). All of a rig's gesture tracks share the warped clock, so the hand-offs
#     (W's fist tuck -> arm swing, S's pump) stay in sync.
#   * a few `in` (accelerate-into-rest) segments that end on a visible part become `inOut`.
#   * `tap`: one shared tap curve (crouch, hop, land, settle; continuous squash with no
#     jump) and the laugh face's 150 ms fade in / 180 ms fade out (was a hard swap).
#   * `mascot`: hero px -> the shipped 512 px `mascot-<id>` square (mascot = hero*s + o),
#     so each platform maps its header figure box onto the rig.
import io
import json
import math
import os
import sys

from PIL import Image

ENGINE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.dirname(ENGINE)
BRAND = os.path.dirname(ANIM)
REPO = os.path.abspath(os.path.join(BRAND, '..', '..', '..'))
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
LAYER_SCALE = 0.375
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art', 'rig')
DROID_RES = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
MASCOT = os.path.join(IOS, 'mascot-{id}.imageset', 'mascot-{id}.png')
GOLDEN = os.path.join(ENGINE, 'rig-golden.json')

TAP = {
    'dur': 1.0,
    'hop': 110,
    'hopT': [0.10, 0.52],
    'sq': [[0, 0], [0.10, -0.05, 'sine'], [0.22, 0.035, 'inOut'], [0.40, 0, 'inOut'],
           [0.52, -0.045, 'in'], [0.66, 0.012, 'inOut'], [0.82, 0, 'inOut']],
    'laugh': [[0, 0], [0.15, 1, 'inOut'], [0.80, 1], [0.98, 0, 'inOut']],
}
WARP = {'lo': 0.5, 'ramp': 0.7}
# Visible segments that used to accelerate into rest (a snap) -> ease in-out.
SOFTEN = {'o2': ['bob', 'glassDy']}

# ---------------------------------------------------------------- reference evaluator
EASE = {
    'linear': lambda x: x, 'in': lambda x: x * x, 'out': lambda x: 1 - (1 - x) * (1 - x),
    'inOut': lambda x: 2 * x * x if x < .5 else 1 - (-2 * x + 2) ** 2 / 2,
    'sine': lambda x: .5 - .5 * math.cos(math.pi * x),
    'inCubic': lambda x: x ** 3, 'outCubic': lambda x: 1 - (1 - x) ** 3,
    'outBack': lambda x: 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2,
    'outBackSoft': lambda x: 1 + 1.9 * (x - 1) ** 3 + 0.9 * (x - 1) ** 2,
    'step': lambda x: 0 if x < 1 else 1,
}


def kf_val(kf, t):
    if t <= kf[0][0]:
        return kf[0][1]
    for i in range(1, len(kf)):
        if t < kf[i][0]:
            a, b = kf[i - 1], kf[i]
            p = (t - a[0]) / (b[0] - a[0])
            e = EASE.get(b[2] if len(b) > 2 else 'inOut', EASE['inOut'])
            return a[1] + (b[1] - a[1]) * e(p)
    return kf[-1][1]


def is_free(R, tr):
    """Free-running tracks (idle sways, S's speed lines) run on the wall clock; the rest
    belong to the signature move and run on the gesture clock (rest when no move plays)."""
    if 'kf' in tr:
        return bool(tr.get('period')) and abs(tr['period'] - R['cycle']) > 1e-6
    return 'env' not in tr


def track_val(R, name, t, g):
    tr = R['tracks'].get(name)
    if not tr:
        return 0.0
    free = is_free(R, tr)
    c = t if free else g
    v = 0.0
    if 'kf' in tr:
        P = tr.get('period') or R['cycle']
        o = tr.get('offset') or 0
        v += kf_val(tr['kf'], ((c - o) % P + P) % P if free else min(c, P))
    if 'osc' in tr:
        amp, per = tr['osc'][0], tr['osc'][1]
        t0 = tr['osc'][2] if len(tr['osc']) > 2 else 0
        bounce = tr['osc'][3] if len(tr['osc']) > 3 else 0
        if bounce:
            o = -abs(amp * math.sin(math.pi * (c - t0) / per))
        else:
            o = amp * math.sin(2 * math.pi * (c - t0) / per)
        if 'env' in tr:
            o *= kf_val(tr['env'], min(c, R['cycle']))
        v += o
    return v


def rest_val(R, name):
    tr = R['tracks'].get(name)
    return tr['kf'][0][1] if tr and 'kf' in tr else 0.0


def val(R, spec, t, g, still, dflt):
    if spec is None:
        return dflt
    if isinstance(spec, (int, float)):
        return float(spec)
    if isinstance(spec, str):
        return rest_val(R, spec) if still else track_val(R, spec, t, g)
    return sum(val(R, x, t, g, still, 0.0) for x in spec)


def mul(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f]


def T(x, y):
    return [1, 0, 0, 1, x, y]


def S(x, y):
    return [x, 0, 0, y, 0, 0]


def Rd(deg):
    r = deg * math.pi / 180
    return [math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0]


def blink_times(seed, start):
    out, t, s = [], start, seed
    while t < 900:
        out.append(t)
        s = (s * 9301 + 49297) % 233280
        t += 3 + 2 * (s / 233280)
    return out


def blink_state(R, t):
    tt = t % 900.0
    for b in R['_blinks']:
        if b > tt:
            break
        d = tt - b
        if d < 0.16:
            return 'half' if d < 0.04 or d > 0.12 else 'closed'
    return None


def warp_g(R, r):
    w = R['warp']
    if r <= w[0][0]:
        return w[0][1]
    for i in range(1, len(w)):
        if r < w[i][0]:
            a, b = w[i - 1], w[i]
            return a[1] + (b[1] - a[1]) * (r - a[0]) / (b[0] - a[0])
    return w[-1][1]


def evaluate(B, R, t, gr, tap, still, laugh_ok=True):
    """Draw ops for one frame: [(layer, [a,b,c,d,e,f] hero px, alpha)], back to front.
    t: wall clock (s). gr: seconds since the signature move started (None = at rest).
    tap: seconds since a tap (None = none). still: Reduce Motion."""
    TP = B['tap']
    g = 0.0 if (gr is None or still or gr >= R['warp'][-1][0]) else warp_g(R, gr)
    hop, sq, la = 0.0, 0.0, 0.0
    if tap is not None and 0 <= tap < TP['dur']:
        la = kf_val(TP['laugh'], tap) if laugh_ok else 0.0
        if not still:
            h0, h1 = TP['hopT']
            if h0 <= tap < h1:
                hop = -TP['hop'] * math.sin((tap - h0) / (h1 - h0) * math.pi)
            sq = kf_val(TP['sq'], tap)
    ops = []
    lay = R['lay']
    for L in R['layers']:
        if not L.get('shadow'):
            continue
        l = lay[L['img']]
        f = min(1, max(0, -hop / TP['hop']))
        cx, cy = l['x'] + l['w'] / 2, l['y'] + l['h'] / 2
        fl = 0.0 if still else val(R, (R.get('root') or {}).get('dy'), t, g, still, 0.0)
        gg = min(1.2, max(0.5, 1 - 0.35 * f + min(0, fl) * 0.004))
        m = mul(mul(mul(T(cx, cy), S(gg, gg)), T(-cx, -cy)), T(l['x'], l['y']))
        ops.append((L['img'], m, 1 - 0.45 * f))
    Br = R.get('breath') or {'origin': [512, 960], 'period': 3.4, 'sy': 0.012, 'sx': 0.006}
    br = 0.0 if still else math.sin(t / Br['period'] * math.pi * 2)
    sy = 1 + Br['sy'] * br + sq
    sx = 1 - Br['sx'] * br - sq * 0.6
    RT = R.get('root') or {}
    o = RT.get('origin') or Br['origin']
    rdx = val(R, RT.get('dx'), t, g, still, 0.0)
    rdy = val(R, RT.get('dy'), t, g, still, 0.0)
    rrot = val(R, RT.get('rot'), t, g, still, 0.0)
    rsx = val(R, RT.get('sx'), t, g, still, 1.0)
    rsy = val(R, RT.get('sy'), t, g, still, 1.0)
    root = mul(mul(mul(mul(T(rdx, rdy + hop), T(o[0], o[1])), Rd(rrot)), S(sx * rsx, sy * rsy)), T(-o[0], -o[1]))

    def patches():
        if la > 0.002:
            for p in R.get('laugh') or []:
                l = lay[p]
                ops.append((p, mul(root, T(l['x'], l['y'])), la))
        if la >= 0.998 or still or not R.get('blink'):
            return
        e = blink_state(R, t)
        if R.get('eyesTrack'):
            v = track_val(R, R['eyesTrack'], t, g)
            if v >= 1.5:
                e = 'closed'
            elif v >= 0.5 and e != 'closed':
                e = 'half'
        p = e and R['blink'].get(e)
        if p:
            l = lay[p]
            ops.append((p, mul(root, T(l['x'], l['y'])), 1 - la))

    patched = False
    for L in R['layers']:
        if L.get('shadow'):
            continue
        a_mul = 1.0
        if L.get('when') == 'laugh':
            a_mul = la
        elif L.get('when') == 'nolaugh':
            a_mul = 1 - la
        l = lay[L['img']]
        piv = L.get('pivot') or [l['x'], l['y']]
        at = L.get('at') or piv
        pin = L.get('pivotInImg') or [piv[0] - l['x'], piv[1] - l['y']]
        rot = val(R, L.get('rot'), t, g, still, 0.0)
        dx = val(R, L.get('dx'), t, g, still, 0.0)
        dy = val(R, L.get('dy'), t, g, still, 0.0)
        s = val(R, L.get('s'), t, g, still, 1.0)
        lsx = val(R, L.get('sx'), t, g, still, 1.0) * s
        lsy = val(R, L.get('sy'), t, g, still, 1.0) * s
        alpha = 1.0 if L.get('alpha') is None else min(1, max(0, val(R, L.get('alpha'), t, g, still, 1.0)))
        alpha *= a_mul
        at_rest = abs(rot) < 0.01 and abs(dx) < 0.05 and abs(dy) < 0.05 and abs(lsx - 1) < 1e-3 and abs(lsy - 1) < 1e-3
        if alpha > 0.002 and not (L.get('when') == 'active' and at_rest):
            m = mul(mul(mul(mul(root, T(at[0] + dx, at[1] + dy)), Rd(rot)), S(lsx, lsy)), T(-pin[0], -pin[1]))
            ops.append((L['img'], m, alpha))
        if R.get('patchAfter') and L['img'] == R['patchAfter']:
            patches()
            patched = True
    if not patched:
        patches()
    return ops


# ---------------------------------------------------------------- compile
def smooth(x):
    x = min(1, max(0, x))
    return x * x * (3 - 2 * x)


def gesture_window(R):
    """[first, last] gesture-clock time at which any gesture track leaves its rest value."""
    names = [n for n, tr in R['tracks'].items() if not is_free(R, tr)]
    if not names:
        return None
    rest = {n: track_val(R, n, 0, 0) for n in names}
    hits = []
    n = int(R['cycle'] * 200)
    for i in range(n + 1):
        g = i / 200
        if any(abs(track_val(R, k, 0, g) - rest[k]) > 1e-3 for k in names):
            hits.append(g)
    return [hits[0], hits[-1]] if hits else None


def build_warp(R):
    """[[real s, gesture s], ...]: the move starts just before its first motion and ends
    just after its last, at half speed at both edges, smoothstepping to full speed."""
    win = gesture_window(R)
    cyc = R['cycle']
    if not win:
        return [[0, 0], [cyc, cyc]], None
    gs, ge = max(0.0, win[0] - 0.05), min(cyc, win[1] + 0.05)
    lo, L = WARP['lo'], WARP['ramp']
    pts, r, g, dg = [[0.0, round(gs, 4)]], 0.0, gs, 0.01
    while g < ge - 1e-9:
        gm = g + dg / 2
        v = lo + (1 - lo) * smooth((gm - gs) / L) * smooth((ge - gm) / L)
        r += dg / v
        g = min(ge, g + dg)
        pts.append([round(r, 4), round(g, 4)])
    # thin the table: keep every 5th point (50 ms of gesture time) + the last
    thin = pts[::5]
    if thin[-1] != pts[-1]:
        thin.append(pts[-1])
    return thin, [round(gs, 3), round(ge, 3)]


def crop(path):
    im = Image.open(path).convert('RGBA')
    bb = im.getchannel('A').getbbox()
    c = im.crop(bb)
    small = c.resize((max(1, round(c.width * LAYER_SCALE)), max(1, round(c.height * LAYER_SCALE))), Image.LANCZOS)
    return small, dict(x=bb[0], y=bb[1], w=c.width, h=c.height)


def mascot_map(cid, hero_path):
    h = Image.open(hero_path).convert('RGBA')
    m = Image.open(MASCOT.format(id=cid)).convert('RGBA')
    thr = lambda im: im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    hb, mb = thr(h), thr(m)
    s = ((mb[2] - mb[0]) / (hb[2] - hb[0]) + (mb[3] - mb[1]) / (hb[3] - hb[1])) / 2
    return {'size': m.width, 's': round(s, 5), 'ox': round(mb[0] - hb[0] * s, 2), 'oy': round(mb[1] - hb[1] * s, 2)}


def compile_rig(cid):
    d = os.path.join(ANIM, cid)
    rig = json.load(open(os.path.join(d, 'rig.json')))
    used = sorted({L['img'] for L in rig['layers']} | set(rig.get('laugh', [])) | set((rig.get('blink') or {}).values()))
    lay, imgs = {}, {}
    for n in used:
        small, box = crop(os.path.join(d, 'layers', n + '.png'))
        lay[n], imgs[n] = box, small
    layers = []
    for L in rig['layers']:
        L = dict(L)
        if 'pivotInImg' in L:   # given in the uncropped layer image: shift by the crop
            L['pivotInImg'] = [L['pivotInImg'][0] - lay[L['img']]['x'], L['pivotInImg'][1] - lay[L['img']]['y']]
        layers.append(L)
    tracks = json.loads(json.dumps(rig['tracks']))
    for name in SOFTEN.get(cid, []):
        kf = tracks[name]['kf']
        if len(kf[-1]) > 2 and kf[-1][2] == 'in':
            kf[-1][2] = 'inOut'
    out = {
        'id': cid, 'name': rig['name'], 'gesture': rig['gesture'], 'cycle': rig['cycle'],
        'breath': rig.get('breath'), 'root': rig.get('root'), 'blink': rig.get('blink'),
        'eyesTrack': rig.get('eyesTrack'), 'laugh': rig.get('laugh', []), 'patchAfter': rig.get('patchAfter'),
        # the header shows all ten at once: stagger each one's blink schedule
        'blinkSeed': rig.get('blinkSeed', 7 + 13 * CAST.index(cid)), 'blinkStart': rig.get('blinkStart', 1.3 + 0.37 * CAST.index(cid)),
        'tracks': tracks, 'layers': layers, 'lay': lay,
        'mascot': mascot_map(cid, os.path.join(BRAND, rig['source'])),
        'restDiff': rig.get('restDiff', {}).get('meanAbsRGB'),
    }
    out = {k: v for k, v in out.items() if v is not None}
    out['warp'], win = build_warp(out)
    out['gestureWindow'] = win
    out['_blinks'] = blink_times(out['blinkSeed'], out['blinkStart'])
    return out, imgs


def rest_check(B, R, imgs):
    """Composite the rest pose (translation-only ops) at the mascot's 512 px framing and
    diff it against the shipped mascot-<id>. Returns (mean abs RGB premultiplied, image)."""
    import numpy as np
    M = R['mascot']
    size = M['size']
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for name, m, a in evaluate(B, R, 0.0, None, None, True):
        assert abs(m[1]) < 1e-6 and abs(m[2]) < 1e-6, (R['id'], name, m)
        l = R['lay'][name]
        w = max(1, round(l['w'] * m[0] * M['s']))
        h = max(1, round(l['h'] * m[3] * M['s']))
        im = imgs[name].resize((w, h), Image.LANCZOS)
        if a < 1:
            im.putalpha(im.getchannel('A').point(lambda v: round(v * a)))
        layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        layer.paste(im, (round(m[4] * M['s'] + M['ox']), round(m[5] * M['s'] + M['oy'])))
        canvas = Image.alpha_composite(canvas, layer)
    ref = Image.open(MASCOT.format(id=R['id'])).convert('RGBA')
    pa = lambda im: (lambda x: np.concatenate([x[..., :3] * x[..., 3:] / 255, x[..., 3:]], -1))(np.asarray(im).astype(float))
    A, Bm = pa(canvas), pa(ref)
    mask = (A[..., 3] > 0) | (Bm[..., 3] > 0)
    return float(np.abs(A[..., :3] - Bm[..., :3])[mask].mean()), canvas


def public(R):
    return {k: v for k, v in R.items() if not k.startswith('_')}


def main():
    check = '--check' in sys.argv
    B = {'version': 1, 'layerScale': LAYER_SCALE, 'tap': TAP, 'warp': WARP, 'cast': CAST, 'rigs': {}}
    compiled = {}
    for cid in CAST:
        R, imgs = compile_rig(cid)
        compiled[cid] = (R, imgs)
        B['rigs'][cid] = public(R)
    scratch = os.environ.get('RIG_SCRATCH')
    for cid in CAST:
        R, imgs = compiled[cid]
        d, canvas = rest_check(B, R, imgs)
        print(f'{cid:3s} layers={len(imgs):2d} window={R["gestureWindow"]} warp={R["warp"][-1][0]:.2f}s  rest vs mascot-{cid}: {d:.2f}/255')
        if scratch:
            canvas.save(os.path.join(scratch, f'rest-{cid}.png'))
    if check:
        return
    data = json.dumps(B, separators=(',', ':'), sort_keys=True)
    # web
    os.makedirs(WEB, exist_ok=True)
    for f in os.listdir(WEB):
        os.remove(os.path.join(WEB, f))
    open(os.path.join(WEB, 'cast-rigs.json'), 'w').write(data)
    # android
    droid_draw = os.path.join(DROID_RES, 'drawable-nodpi')
    for f in os.listdir(droid_draw):
        if f.startswith('rig_'):
            os.remove(os.path.join(droid_draw, f))
    open(os.path.join(DROID_RES, 'raw', 'cast_rigs.json'), 'w').write(data)
    keep = []
    # ios
    for f in os.listdir(IOS):
        if f.startswith('rig-') and f.endswith('.imageset'):
            for g in os.listdir(os.path.join(IOS, f)):
                os.remove(os.path.join(IOS, f, g))
            os.rmdir(os.path.join(IOS, f))
    ds = os.path.join(IOS, 'cast-rigs.dataset')
    os.makedirs(ds, exist_ok=True)
    open(os.path.join(ds, 'cast-rigs.json'), 'w').write(data)
    json.dump({'data': [{'filename': 'cast-rigs.json', 'idiom': 'universal', 'universal-type-identifier': 'public.json'}],
               'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(ds, 'Contents.json'), 'w'), indent=2)
    for cid in CAST:
        R, imgs = compiled[cid]
        for n, im in imgs.items():
            im.save(os.path.join(WEB, f'{cid}-{n}.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
            dn = f'rig_{cid}_{n}'.replace('-', '_')
            im.save(os.path.join(droid_draw, dn + '.webp'), 'WEBP', quality=90, method=6, alpha_quality=100)
            keep.append(f'@drawable/{dn}')
            iset = os.path.join(IOS, f'rig-{cid}-{n}.imageset')
            os.makedirs(iset, exist_ok=True)
            im.save(os.path.join(iset, f'rig-{cid}-{n}.png'), optimize=True)
            json.dump({'images': [{'filename': f'rig-{cid}-{n}.png', 'idiom': 'universal'}],
                       'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(iset, 'Contents.json'), 'w'), indent=2)
    open(os.path.join(DROID_RES, 'raw', 'keep_rigs.xml'), 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n<!-- The cast puppet layers are looked up by name (CastPuppet.kt): keep them from resource shrinking. -->\n'
        f'<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="{",".join(keep)}" />\n')
    # golden fixture: a handful of frames per rig through idle, gesture, tap and Reduce Motion
    golden = []
    for cid in CAST:
        R = compiled[cid][0]
        for (t, gr, tap, still) in [(0.0, None, None, False), (1.31, None, None, False), (2.0, 1.2, None, False),
                                    (3.3, 2.6, 0.3, False), (5.0, R['warp'][-1][0] * 0.8, 0.12, False),
                                    (7.77, None, 0.9, False), (2.0, 1.0, 0.4, True)]:
            ops = evaluate(B, R, t, gr, tap, still)
            golden.append({'id': cid, 't': t, 'g': gr, 'tap': tap, 'still': still,
                           'ops': [[n, [round(x, 4) for x in m], round(a, 4)] for n, m, a in ops]})
    json.dump(golden, open(GOLDEN, 'w'), separators=(',', ':'))
    print('shipped', sum(len(c[1]) for c in compiled.values()), 'layers; bundle', len(data), 'bytes; golden', len(golden), 'frames')


if __name__ == '__main__':
    main()
