#!/usr/bin/env python3
"""Body SIZES from the same art (prototype 10-06, not shipped): XS, S, L, XL, chunky (wider), lanky (taller) for each
of the 12 bodies, then the landmarks re-measured, every item re-fitted by its rule (rules.py) and the guards run.

How a size is made from one body's art (landmarks.json gives the pieces):
  torso   the body without its mittens (the mitten zone over the torso is inpainted), scaled by (sx, sy) about the
          middle of the hip line: the hips stay on the feet
  arms    each mitten keeps its size and re-attaches at the scaled torso edge, at the same relative height
  feet    keep their size, move apart with the torso (sx)
  face    eyes / mouth / letter positions move with the torso; the face scales by (sx·sy)^¼ (features grow less than
          the body), the letter box by min(sx, sy)
Then the whole body is normalized back into the body square (same height or width as the source, feet on the floor).

  python3 integration/sizes.py            → landmarks-sizes.json, out/landmarks/sizes-bodies.jpg (+ overlays),
                                            out/landmarks/sizes-<size>-<group>.jpg (every item × 12 bodies),
                                            out/landmarks/sizes.json (guards + withheld per item × body × size)
"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
import cv2  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
from scipy import ndimage  # noqa: E402
import landmarks as LM  # noqa: E402
from rig import U, M, CW, MAN, PARTS  # noqa: E402

SIZES = {'XS': (0.80, 0.80), 'S': (0.90, 0.90), 'L': (1.12, 1.12), 'XL': (1.25, 1.25), 'chunky': (1.28, 1.0),
         'lanky': (0.94, 1.3)}
OUT = os.path.join(HERE, 'out', 'landmarks')
CACHE = os.path.join(OUT, '_cache', 'sizes')
N = 1024           # source art px per body unit


def vid(body, size):
    return f'{body}@{size}'


def _to_art(mask_canvas):
    """canvas-frame bool mask → the 1024 art frame."""
    m = mask_canvas[M:M + U, M:M + U].astype(np.uint8) * 255
    return cv2.resize(m, (N, N), interpolation=cv2.INTER_LINEAR) > 127


def make(body, size):
    """→ (RGBA art N×N, anchors dict) of the size variant."""
    sx, sy = SIZES[size]
    lm = LM.measure(body)
    pr = lm['_']
    art = np.asarray(Image.open(os.path.join(PARTS, f'art-av-body-{body}.png')).convert('RGBA')).astype(np.float32)
    A = art[..., 3] > 128
    hip = lm['hips']['y'] * N
    xs = np.nonzero(A.any(0))[0]
    cx = (xs.min() + xs.max()) / 2
    # the mitten masks (ellipse ∪ bulge, grown a little), feathered
    arms = {s: ndimage.binary_dilation(_to_art(m), iterations=6) & A for s, m in pr['arms'].items()}
    feet_m = A.copy()
    feet_m[:int(hip - 0.03 * N)] = False
    # torso: no mittens (inpaint where a mitten covers the torso), no feet below the hip line
    tor_alpha = _to_art(pr['torso'])
    zone = np.zeros_like(A)
    for m in arms.values():
        zone |= m
    rgb = art[..., :3].astype(np.uint8)
    rgb = cv2.inpaint(rgb, (zone & tor_alpha).astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA)
    yy_ = np.arange(N, dtype=np.float32)[:, None]
    ramp_t = np.clip((hip + 0.03 * N - yy_) / (0.02 * N), 0, 1)          # the torso fades out over the feet tops
    ta = cv2.GaussianBlur(tor_alpha.astype(np.float32) * 255, (0, 0), 1.2) * ramp_t
    torso = np.dstack([rgb.astype(np.float32), np.minimum(ta, art[..., 3])])

    # big working canvas (the scaled torso can be wider/taller than the square)
    W = 2 * N
    off = N // 2
    canvas = np.zeros((W, W, 4), np.float32)

    def over(dst, src):
        a = src[..., 3:4] / 255
        dst[..., :3] = src[..., :3] * a + dst[..., :3] * (1 - a)
        dst[..., 3:4] = src[..., 3:4] + dst[..., 3:4] * (1 - a)
    # transform: about (cx, hip) in source px → working canvas
    def T(x, y):
        return off + cx + (x - cx) * sx, off + hip - (hip - y) * sy
    # feet (behind the torso): each foot moves with the torso horizontally, keeps its size
    lab, n = ndimage.label(feet_m)
    if n >= 2:
        sz = ndimage.sum(feet_m, lab, range(1, n + 1))
        comps = [lab == i + 1 for i in np.argsort(sz)[::-1][:2]]
    else:
        xx = np.arange(N)[None, :]
        comps = [feet_m & (xx < cx), feet_m & (xx >= cx)]
    for c in comps:
        yy, xx = np.nonzero(c)
        fx = (xx.min() + xx.max()) / 2
        dx = off + cx + (fx - cx) * sx - fx
        dy = off + hip - hip
        spr = art.copy()
        ramp_f = np.clip((np.arange(N, dtype=np.float32)[:, None] - (hip - 0.03 * N)) / (0.02 * N), 0, 1)
        spr[..., 3] *= ndimage.binary_dilation(c, iterations=2) * ramp_f
        Mx = np.float32([[1, 0, dx], [0, 1, dy]])
        over(canvas, cv2.warpAffine(spr, Mx, (W, W), flags=cv2.INTER_LINEAR))
    # torso, scaled
    Mt = np.float32([[sx, 0, off + cx - cx * sx], [0, sy, off + hip - hip * sy]])
    over(canvas, cv2.warpAffine(torso, Mt, (W, W), flags=cv2.INTER_LINEAR))
    # mittens: same size, re-attached at the scaled torso edge (same relative height)
    mv = {}
    for s, m in arms.items():
        hx, hy = lm['arms'][s]['hand'][0] * N, lm['arms'][s]['hand'][1] * N
        st = lm['arms'][s]['start']
        ex = st[0] * N                      # the torso edge at the arm root
        nx = off + cx + (ex - cx) * sx - ex
        ny = off + hip - (hip - hy) * sy - hy
        mv[s] = (nx, ny)
        spr = art.copy()
        spr[..., 3] *= cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.5)
        over(canvas, cv2.warpAffine(spr, np.float32([[1, 0, nx], [0, 1, ny]]), (W, W), flags=cv2.INTER_LINEAR))

    # normalize into the square: same max extent as the source, feet on the source floor, centered
    a = canvas[..., 3] > 128
    ys_, xs_ = np.nonzero(a)
    bx0, bx1, by0, by1 = xs_.min(), xs_.max(), ys_.min(), ys_.max()
    sx0, sx1, sy0, sy1 = xs.min(), xs.max(), np.nonzero(A.any(1))[0].min(), np.nonzero(A.any(1))[0].max()
    k = max(sx1 - sx0, sy1 - sy0) / max(bx1 - bx0, by1 - by0)
    # (x, y) working → normalized source px
    tx = (sx0 + sx1) / 2 - k * (bx0 + bx1) / 2
    ty = sy1 - k * by1
    out = cv2.warpAffine(canvas, np.float32([[k, 0, tx], [0, k, ty]]), (N, N), flags=cv2.INTER_AREA)
    out = np.clip(out, 0, 255).astype(np.uint8)

    def pt(x, y):     # source body units → variant body units
        X, Y = T(x * N, y * N)
        return (k * X + tx) / N, (k * Y + ty) / N
    b = MAN['bodies'][body]
    f = (sx * sy) ** 0.25 * k
    an = json.loads(json.dumps(b))
    fx_, ey = pt(b['face']['x'], b['eyeY'])
    an['face'] = {'x': fx_, 'w': b['face']['w'] * f}
    for key in ('eyeY', 'mouthY', 'cheekY', 'mustacheY', 'neckY'):
        an[key] = pt(b['face']['x'], b[key])[1]
    an['faceCenter'] = list(pt(*b['faceCenter']))
    lx, ly, lw, lh = b['letterBox']
    lcx, lcy = pt(lx + lw / 2, ly + lh / 2)
    ls = min(sx, sy) * k
    an['letterBox'] = [lcx - lw * ls / 2, lcy - lh * ls / 2, lw * ls, lh * ls]
    hx, hy = pt(b['headTop']['x'], b['headTop']['y'])
    an['headTop'] = {'x': hx, 'y': hy, 'w': b['headTop']['w'] * sx * k}
    bx, by = pt(b['back']['x'], b['back']['y'])
    an['back'] = {'x': bx, 'y': by, 'w': b['back']['w'] * sx * k}
    an['cape'] = {'y': pt(0.5, b['cape']['y'])[1]}
    an['shoulderW'] = b['shoulderW'] * sx * k
    an['bounds'] = [round(float(v) / N, 4) for v in (bx0 * k + tx, by0 * k + ty, bx1 * k + tx, by1 * k + ty)]
    an['overrides'] = {}
    for key in ('hands', 'wrap', 'shoulderY', 'floor', 'hand'):
        an.pop(key, None)
    an['hand'] = {'x': 0.9, 'y': 0.6}
    # where the mittens were re-attached: the measurement's prior (the arm search picks the bulge nearest to it)
    an['handsPrior'] = {s: [round(float(((lm['arms'][s]['hand'][0] * N + mv[s][0]) * k + tx) / N), 4),
                            round(float(((lm['arms'][s]['hand'][1] * N + mv[s][1]) * k + ty) / N), 4)] for s in mv}
    an = {k_: (round(v, 4) if isinstance(v, float) else v) for k_, v in an.items()}
    return Image.fromarray(out, 'RGBA'), an


def register_all(bodies=None, sizes=None):
    """Make (or load from the cache) every variant and register it with the rig. → {vid: anchors}."""
    os.makedirs(CACHE, exist_ok=True)
    idx = os.path.join(CACHE, 'anchors.json')
    anchors = json.load(open(idx)) if os.path.exists(idx) else {}
    bodies = bodies or [b for b in MAN['bodies'] if '@' not in b]
    changed = False
    for body in bodies:
        for size in (sizes or SIZES):
            v = vid(body, size)
            p = os.path.join(CACHE, f'{v}.png')
            if v not in anchors or not os.path.exists(p):
                art, an = make(body, size)
                art.save(p)
                anchors[v] = an
                changed = True
            LM.register_body(v, Image.open(p).convert('RGBA'), anchors[v])
    if changed:     # only the run that builds variants writes the cache (parallel workers only read it)
        tmp = idx + f'.{os.getpid()}'
        json.dump(anchors, open(tmp, 'w'))
        os.replace(tmp, idx)
    return anchors


# ── the run ──────────────────────────────────────────────────────────────────────────────────────────────────────
T = 84
GROUPS = [('hats', ('hat',)), ('face-neck-back', ('face', 'brows', 'extra', 'pendant', 'necklace', 'drape', 'belt',
                                                   'apron', 'cape', 'wings', 'backpack', 'tail')),
          ('held-feet-buddies', ('held', 'shoes', 'buddy'))]


def _measure_all(vids):
    out, bad = {}, {}
    for v in vids:
        try:
            lm = LM.measure(v)
            out[v] = LM.public(lm)
        except Exception as e:  # noqa: BLE001
            bad[v] = repr(e)
    return out, bad


def _worker(v):
    import fits
    import audit
    register_all()
    base = LM.load()
    sz = json.load(open(os.path.join(HERE, 'landmarks-sizes.json')))['bodies']
    import rules
    rules.setup({**base, **sz})
    lm = LM.measure(v)
    body, size = v.split('@')
    j = list(base).index(body)
    res = {}
    for key, r in rules.RULES.items():
        pid = key.split(':')[1]
        try:
            o = rules.render(key, v)
        except Exception as e:  # noqa: BLE001
            o = dict(layers={}, fails=[f'error {e!r}'], unsupported=None, rect=None)
        layers = o['layers'] if not o['fails'] and not o['unsupported'] else {}
        g = audit.guard(key, v, layers, r['kind'], lm, r['params']) if layers else None
        if layers:
            t = fits.fixed_tile(fits.compose(v, fits.COLS[j], layers, pid, 'AWMRSOBKEQZH'[j]), v, T, bool(g), {v: sz[v]})
        else:
            t = fits.blank(T)
        b = io.BytesIO()
        t.convert('RGB').save(b, 'PNG')
        res[key] = dict(guards=g, withheld=o['unsupported'] or o['fails'] or None, tile=b.getvalue(),
                        layer=list(o['rect']) if o.get('rect') else None)
    return v, res


def main(argv):
    from concurrent.futures import ProcessPoolExecutor
    import fits
    os.makedirs(OUT, exist_ok=True)
    anchors = register_all()
    base = LM.load()
    vids = [vid(b, s) for s in SIZES for b in base]
    lms, bad = _measure_all(vids)
    print('measured', len(lms), 'failed', bad)
    json.dump(dict(version=1, units='body', sizes={k: list(v) for k, v in SIZES.items()},
                   source='integration/sizes.py (variants of the 12 bodies, prototype — not shipped)',
                   bodies=lms, anchors=anchors), open(os.path.join(HERE, 'landmarks-sizes.json'), 'w'), indent=1)
    # the bodies + their overlays, one row per size
    BT = 150
    sheet = Image.new('RGB', (110 + BT * len(base), BT * (len(SIZES) + 1)), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    ov = Image.new('RGB', (110 + BT * len(base), BT * (len(SIZES) + 1)), (255, 255, 255))
    do = ImageDraw.Draw(ov)
    import rules
    rules.setup({**base, **lms})
    for r_, size in enumerate(['base'] + list(SIZES)):
        d.text((8, r_ * BT + BT / 2), size, font=fits.font(16), fill=(40, 20, 60))
        do.text((8, r_ * BT + BT / 2), size, font=fits.font(16), fill=(40, 20, 60))
        for j, body in enumerate(base):
            v = body if size == 'base' else vid(body, size)
            c = fits.compose(v, fits.COLS[j], {}, '', 'AWMRSOBKEQZH'[j])
            sheet.paste(fits.fixed_tile(c, v, BT, False, {v: (base if size == 'base' else lms)[v]}).convert('RGB'), (110 + j * BT, r_ * BT))
            if v in lms or size == 'base':
                lmv = LM.measure(v)
                lmv['vsFit'] = {}
                ov.paste(LM.overlay(v, lmv, size=BT * 0.8).resize((BT, BT)), (110 + j * BT, r_ * BT))
    for j, body in enumerate(base):
        d.text((110 + j * BT + BT / 2, 4), body, font=fits.font(12), fill=(40, 20, 60), anchor='mt')
    sheet.save(os.path.join(OUT, 'sizes-bodies.jpg'), quality=86)
    ov.save(os.path.join(OUT, 'sizes-overlays.jpg'), quality=86)
    # every item × body × size
    allres = {}
    with ProcessPoolExecutor(max_workers=int(os.environ.get('AV_WORKERS', '1'))) as ex:
        for v, res in ex.map(_worker, [v for v in vids if v in lms]):
            allres[v] = res
            print(v, 'guard fails', sum(1 for x in res.values() if x['guards']), 'withheld',
                  sum(1 for x in res.values() if x['withheld']), flush=True)
    summary = {}
    for v, res in allres.items():
        for key, x in res.items():
            summary.setdefault(key, {})[v] = dict(guards=x['guards'], withheld=x['withheld'])
    json.dump(summary, open(os.path.join(OUT, 'sizes.json'), 'w'), indent=0)
    f, fs = fits.font(13), fits.font(10, bold=False)
    for size in SIZES:
        for gname, kinds in GROUPS:
            keys = [k for k, r in rules.RULES.items() if r['kind'] in kinds]
            sh = Image.new('RGB', (130 + (T + 2) * len(base), 30 + len(keys) * (T + 2)), (255, 255, 255))
            dd = ImageDraw.Draw(sh)
            dd.text((6, 6), f'size {size} ({SIZES[size][0]}× wide, {SIZES[size][1]}× tall torso) — {gname} — red = a guard '
                            f'fails · — = withheld by its rule', font=fs, fill=(40, 30, 60))
            for j, body in enumerate(base):
                dd.text((130 + j * (T + 2) + T / 2, 20), body, font=fs, fill=(40, 30, 60), anchor='mm')
            for r_, key in enumerate(keys):
                y = 30 + r_ * (T + 2)
                dd.text((6, y + T / 2 - 8), key.split(':')[1] if key.startswith('acc:') else key, font=f, fill=(40, 20, 60))
                for j, body in enumerate(base):
                    v = vid(body, size)
                    if v in allres:
                        sh.paste(Image.open(io.BytesIO(allres[v][key]['tile'])), (130 + j * (T + 2), y))
            sh.save(os.path.join(OUT, f'sizes-{size}-{gname}.jpg'), quality=82)
            print('sheet', size, gname)


if __name__ == '__main__':
    main(sys.argv[1:])
