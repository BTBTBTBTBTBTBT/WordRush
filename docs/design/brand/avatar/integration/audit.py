#!/usr/bin/env python3
"""Bolt-on audit (10-04): every shipped accessory on 4 bodies, through the CORE layout (dump-layout.ts),
rendered with the apps' recipe (avatar_draw.render). Writes audit-<group>.png.
  python3 integration/audit.py            sheets + the wrap-line hoop check
  python3 integration/audit.py --wraps    only the hoop check (exit 1 on a failure)
  python3 integration/audit.py --guards [shipped|rule] [bodies…]
                                          the landmark guards (below) on every item × body: today's shipped art or
                                          the rule-based fit (rules.py); exit 1 on a failure
  python3 integration/audit.py --hoop-regression [commit]
                                          the guards on the neck items as shipped at <commit> (default c08582d^, the
                                          10-05 "hula hoop" chain): they must FAIL there

Wrap-line hoop check (10-05: the chain "went around his arms like a hula hoop", and the cape cords ran straight
across the belly; the face/letter fit check passed them): every SHIPPED wrap-line layer (pieces `wrap`, plus the
per-body scarf art) is drawn at its manifest rect on its body, and FAILS when its opaque pixels
  - sit on the body's arms > ARM_MAX of the body square (10-06: the MEASURED arm regions of landmarks.py — the same
    mittens the re-shipped hand-over cut uses; it was the hand-fit ellipses of pieces.arm_mask), or
  - form a hoop: on some row at arm height the layer covers >= HOOP_SPAN of the body's width (a straight band).
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
sys.path.insert(0, AV)
from avatar_draw import render  # noqa: E402

BODIES = [('classic', 'purple'), ('tall', 'teal'), ('blob', 'amber'), ('star', 'pink')]


def label_font(size):
    for p in ('/System/Library/Fonts/Supplemental/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def catalogs():
    src = open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-config.ts')).read()
    def arr(name):
        m = re.search(r'export const ' + name + r' = \[(.*?)\] as const', src, re.S)
        return [x for x in re.findall(r"'([^']+)'", m.group(1)) if x != 'none']
    return {k: arr(v) for k, v in dict(heads='AVATAR_HEADS', faces='AVATAR_FACES', necks='AVATAR_NECKS').items()}


def tsx():
    """The repo's tsx, else npx (cloud runs without node_modules)."""
    local = REPO + '/apps/server/node_modules/.bin/tsx'
    return [local] if os.path.exists(local) else ['npx', '-y', 'tsx']


def dump(cfgs):
    r = subprocess.run(tsx() + [os.path.join(AV, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True, cwd=REPO)
    return json.loads(r.stdout)


def sheet(field, ids, out, T=170):
    cfgs, labels = [], []
    for i in ids:
        for b, c in BODIES:
            cfg = dict(body=b, color=c, head='none', face='none', neck='none', eyes='beady', mouth='smile')
            cfg[field] = i
            cfgs.append(cfg); labels.append(f'{i} / {b}')
    d = dump(cfgs)
    cols = 8
    rows = (len(cfgs) + cols - 1) // cols
    img = Image.new('RGB', (cols * (T + 6) + 6, rows * (T + 20) + 6), (250, 250, 252))
    f = label_font(11)
    dr = ImageDraw.Draw(img)
    for k, e in enumerate(d['out']):
        im = render(e, T, bg=(241, 239, 250, 255), letter='A').convert('RGB')
        x, y = 6 + (k % cols) * (T + 6), 6 + (k // cols) * (T + 20)
        img.paste(im, (x, y)); dr.text((x + 2, y + T + 3), labels[k], fill=(50, 40, 80), font=f)
    img.save(out, optimize=True)
    print(out, len(cfgs))


ARM_MAX = 0.0006     # of the body square's area (~250 px at U=640): an anti-aliased edge, never a band
HOOP_SPAN = 0.7      # a straight band: one row of the layer covers >= 70% of the body's width at arm height
WAIST = {'acc:apron', 'acc:belt'}   # waist garments: they DO go around the body, under the hands (hand-over)


def wrap_hoops(verbose=True, art=None, manifest=None):
    """The hoop check over every shipped wrap-line layer. Returns [(item, body, reason)].
    art / manifest: check another copy (e.g. a `git archive` of an older commit) instead of the working tree."""
    import numpy as np
    sys.path.insert(0, HERE)
    from rig import U, M, CW, MAN as RMAN
    from pieces import arm_mask
    from rig import rig
    art = art or os.path.join(REPO, 'apps', 'web', 'public', 'art')
    man = json.load(open(manifest or os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')))
    fails, n = [], 0
    for key, it in man['items'].items():
        kind, pid = key.split(':', 1)
        rects = {}
        for body, rows in (it.get('pieces') or {}).items():
            for layer, x, y, w, h in rows:
                if layer == 'wrap':
                    rects.setdefault(body, []).append((f'art-av-{kind}-{pid}-{body}-{layer}.webp', x, y, w, h))
        for body, r in (it.get('perBody') or {}).items():
            if it.get('layer') in ('neckFront', 'wrap'):
                rects.setdefault(body, []).append((f'art-av-{kind}-{pid}-{body}.webp', *r))
        for body, lst in rects.items():
            pr = _lm_masks(body)['_']
            A, arms = pr['A'], pr['arm_any']
            arm_rows = np.nonzero(arms.any(1))[0]
            m = np.zeros((CW, CW), bool)
            for name, x, y, w, h in lst:
                im = Image.open(os.path.join(art, name)).convert('RGBA').resize((max(1, round(w * U)), max(1, round(h * U))))
                a = np.asarray(im.getchannel('A')) > 128
                X, Y = round(M + x * U), round(M + y * U)
                m[Y:Y + a.shape[0], X:X + a.shape[1]] |= a[:max(0, CW - Y), :max(0, CW - X)]
            n += 1
            if key in WAIST:
                continue
            on_arm = int((m & arms).sum())
            if on_arm > ARM_MAX * U * U:
                fails.append((key, body, f'over the arms ({on_arm} px)'))
                continue
            for yy in arm_rows:
                row = A[yy]
                if row.sum() and (m[yy] & row).sum() >= HOOP_SPAN * row.sum():
                    fails.append((key, body, f'straight band across the body at arm height (y={(yy - M) / U:.3f})'))
                    break
    if verbose:
        print(f'wrap hoop check: {n} wrap layers, {len(fails)} failures')
        for f in fails:
            print('  FAIL', *f)
    return fails


# ── Landmark guards (10-06, landmarks.py + rules.py) ─────────────────────────────────────────────────────────────
# Every item on every body, from its drawn layers (canvas RGBA at U px / body unit), against the body's MEASURED
# landmarks. An item FAILS when it
#   arm      crosses an arm region (front layers over the mitten / arm bulge)            > ARM_MAX of U²
#   torso    is wider than the torso at its height (front layers past the torso edge)    > TORSO_TOL on ≥ TORSO_ROWS rows
#            (waist garments exempt: they go around the body under the hands)
#   outline  leaves the body outline (front + face layers outside the silhouette + OVERHANG) > OUTLINE_MAX of its px
#   face     covers the eyes / mouth (beady + smile) beyond 1% (face items exempt)
#   letter   covers the letter (W ∪ M ink) beyond 1%
#   float    floats off its anchor (per rule kind: the hat sits on the head-top curve, a held item touches the hand,
#            a back piece touches the outline, shoes sit on the feet, a floor buddy stands on the floor, …)
# Layers drawn BEHIND (back) or under the letter (under) never count as covering the face / letter.
ARM_MAX_G = 0.0006
TORSO_TOL, TORSO_ROWS = 0.012, 6
OVERHANG, OUTLINE_MAX = 0.012, 0.03
FACE_MAX, LETTER_MAX = 0.01, 0.01
FLOAT_GAP = 0.025
FRONT = ('wrap', 'neckFront', 'under')
WAIST_KINDS = ('belt', 'apron')
NO_TORSO = ('held', 'hat', 'buddy', 'extra', 'brows', 'wings', 'tail', 'shoes')


def _lm_masks(body):
    sys.path.insert(0, HERE)
    import landmarks as LM
    return LM.measure(body)


def _a(im, t=128):
    import numpy as np
    return np.asarray(im.getchannel('A')) > t


def guard(key, body, layers, kind, lm=None, params=None):
    """[(check, detail)] failures of one item on one body. layers: {layer: canvas RGBA}, kind: its rule kind."""
    import numpy as np
    from scipy import ndimage
    sys.path.insert(0, HERE)
    from rig import U, M, CW
    lm = lm or _lm_masks(body)
    pr = lm['_']
    A, torso, arm_any, face = pr['A'], pr['torso'], pr['arm_any'], pr['face']
    letter = pr['letter']
    params = params or {}
    fails = []
    front = np.zeros((CW, CW), bool)
    for k in FRONT:
        if k in layers:
            front |= _a(layers[k])
    over = np.zeros((CW, CW), bool)              # everything drawn over the face + letter
    for k, im in layers.items():
        if k not in ('back', 'under'):
            over |= _a(im, 90)
    if kind == 'face':
        front |= _a(layers.get('face', next(iter(layers.values()))))
    if kind == 'backpack':
        # the straps come over the shoulder tops from behind: the rows above the shoulder-top line + 0.06 are exempt
        y_ok = int(M + (lm['shoulderTop']['y'] + 0.06) * U)
        front[:y_ok] = False
    # arm
    if kind not in ('held',):
        n = int((front & arm_any).sum())
        if n > ARM_MAX_G * U * U:
            fails.append(('arm', f'{n} px over the arms'))
    # torso width
    if kind not in WAIST_KINDS + NO_TORSO + ('face',) and front.any():
        bad = 0
        tol = TORSO_TOL * U
        for y in np.nonzero(front.any(1))[0]:
            t = np.nonzero(torso[y])[0]
            f = np.nonzero(front[y])[0]
            if not len(t) or f.min() < t.min() - tol or f.max() > t.max() + tol:
                bad += 1
        if bad >= TORSO_ROWS:
            fails.append(('torso', f'wider than the torso on {bad} rows'))
    # outline
    if front.any() and kind not in ('held', 'hat'):
        grow = ndimage.binary_dilation(A, iterations=int(OVERHANG * U))
        out = (front & ~grow).sum() / front.sum()
        if out > OUTLINE_MAX:
            fails.append(('outline', f'{out:.0%} outside the body'))
    # face / letter
    if kind != 'face':
        f = (over & face).sum() / max(1, face.sum())
        if f > FACE_MAX:
            fails.append(('face', f'covers {f:.1%} of the face'))
    lt = (over & letter).sum() / max(1, letter.sum())
    if lt > LETTER_MAX:
        fails.append(('letter', f'covers {lt:.1%} of the letter'))
    # float
    fl = _floats(kind, layers, lm, params)
    if fl:
        fails.append(('float', fl))
    return fails


def _floats(kind, layers, lm, params):
    import numpy as np
    from scipy import ndimage
    from rig import U, M, CW
    pr = lm['_']
    A = pr['A']
    allm = np.zeros((CW, CW), bool)
    for im in layers.values():
        allm |= _a(im)
    if not allm.any():
        return None
    near = lambda m, d: (m & ndimage.binary_dilation(A, iterations=max(1, int(d * U)))).any()
    if kind == 'hat':
        if params.get('floats_ok'):
            return None
        m = allm
        xs = np.nonzero(m.any(0))[0]
        x0, x1 = xs.min(), xs.max()
        cols = range(x0, x1 + 1)          # ears / a bow touch the head at some column, not necessarily the middle
        gaps = []
        for x in cols:
            col = np.nonzero(m[:, x])[0]
            body = np.nonzero(A[:, x])[0]
            if len(col) and len(body):
                gaps.append(body.min() - col.max())
        if gaps and min(gaps) > FLOAT_GAP * U:
            return f'hovers {min(gaps) / U:.3f} above the head'
        return None
    if kind == 'held':
        hands = np.zeros((CW, CW), bool)
        yy, xx = np.mgrid[0:CW, 0:CW]
        for s, a in lm['arms'].items():
            hx, hy, rx, ry = a['hand']
            hands |= ((xx - (M + hx * U)) / (rx * U * 1.25)) ** 2 + ((yy - (M + hy * U)) / (ry * U * 1.25)) ** 2 <= 1
        return None if (allm & hands).any() else 'does not touch a hand'
    if kind == 'shoes':
        feet = np.zeros((CW, CW), bool)
        for x0, y0, x1, y1 in lm['feet'].values():
            feet[int(M + y0 * U):int(M + y1 * U) + 1, int(M + x0 * U):int(M + x1 * U) + 1] = True
        f = (allm & feet).sum() / allm.sum()
        return None if f >= 0.4 else f'only {f:.0%} on the feet'
    if kind == 'buddy':
        ys = np.nonzero(allm.any(1))[0]
        if params.get('where') == 'floor':
            d = abs((ys.max() - M) / U - lm['floor'])
            return None if d <= FLOAT_GAP else f'{d:.3f} off the floor'
        return None if near(allm, 0.03 if params.get('where') in ('head', 'shoulder') else 0.15) else 'far from the body'
    if kind == 'extra':
        return None if near(allm, 0.15) else 'far from the face'
    if kind == 'brows':
        x, y, w, h = lm['face']['box']
        box = np.zeros((CW, CW), bool)
        pad = 0.12
        box[int(M + (y - pad) * U):int(M + (y + h + pad) * U), int(M + (x - pad) * U):int(M + (x + w + pad) * U)] = True
        return None if (allm & box).any() else 'away from the face'
    if 'back' in layers and kind in ('cape', 'wings', 'tail', 'backpack'):
        if not near(_a(layers['back']), 0.01):
            return 'the back piece does not touch the body'
    front = np.zeros((CW, CW), bool)
    for k in FRONT + ('face',):
        if k in layers:
            front |= _a(layers[k])
    if front.any():
        seat = (front & A).sum() / front.sum()
        if seat < 0.5:
            return f'only {seat:.0%} on the body'
    return None


def run_guards(source='shipped', bodies=None, verbose=True):
    """The landmark guards over every item × body. source: 'shipped' (today's art) or 'rule' (rules.py)."""
    sys.path.insert(0, HERE)
    import landmarks as LM
    import fits
    import rules as RU
    bodies = bodies or list(LM.load())
    if source == 'rule':
        RU.setup()
    layouts = fits.shipped_layouts(list(LM.load()))
    fails, n = [], 0
    for body in bodies:
        lm = LM.measure(body)
        for key, r in RU.RULES.items():
            if source == 'rule':
                o = RU.render(key, body)
                layers = o['layers'] if not o['fails'] and not o['unsupported'] else {}
            else:
                layers = fits.shipped(key, body, layouts)
            if not layers:
                continue
            n += 1
            for check, detail in guard(key, body, layers, r['kind'], lm, r['params']):
                fails.append((key, body, check, detail))
    if verbose:
        print(f'landmark guards ({source}): {n} item × body fits, {len(fails)} failures')
        for f in fails:
            print('  FAIL', *f)
    return fails


def hoop_regression(commit='c08582d^'):
    """The guards on the neck / wrap items exactly as shipped at <commit> (git archive of its art + manifest)."""
    import tarfile, tempfile, io
    sys.path.insert(0, HERE)
    import landmarks as LM
    import fits
    import rules as RU
    tmp = tempfile.mkdtemp()
    raw = subprocess.run(['git', 'archive', commit, 'apps/web/public/art', 'packages/core/src/avatar-parts.json'],
                         capture_output=True, check=True, cwd=REPO).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(tmp, filter='data')
    man = json.load(open(os.path.join(tmp, 'packages/core/src/avatar-parts.json')))
    art = os.path.join(tmp, 'apps/web/public/art')
    keys = ['acc:chain', 'acc:cape', 'acc:supercape', 'acc:vampirecollar', 'acc:scarf', 'acc:bandana', 'acc:lei']
    res = {}
    for body in LM.load():
        lm = LM.measure(body)
        for key in keys:
            if key not in man['items']:
                continue
            layers = fits.shipped(key, body, {}, art=art, manifest=man)
            if layers:
                f = guard(key, body, layers, RU.RULES[key]['kind'], lm, RU.RULES[key]['params'])
                res.setdefault(key, {})[body] = [c for c, _ in f]
    print(f'hoop regression at {commit}:')
    for key, per in res.items():
        nf = sum(1 for v in per.values() if v)
        print(f'  {key:20s} fails on {nf}/{len(per)} bodies', {b: v for b, v in per.items() if v})
    return res


if __name__ == '__main__':
    if '--guards' in sys.argv:
        rest = [a for a in sys.argv[1:] if not a.startswith('--')]
        src = rest.pop(0) if rest and rest[0] in ('shipped', 'rule') else 'shipped'
        sys.exit(1 if run_guards(src, rest or None) else 0)
    if '--hoop-regression' in sys.argv:
        rest = [a for a in sys.argv[1:] if not a.startswith('--')]
        hoop_regression(*(rest[:1]))
        sys.exit(0)
    if '--wraps' in sys.argv:
        sys.exit(1 if wrap_hoops() else 0)
    wrap_hoops()
    C = catalogs()
    sheet('neck', C['necks'], os.path.join(HERE, 'audit-neck.png'))
    sheet('face', C['faces'], os.path.join(HERE, 'audit-face.png'))
    sheet('head', C['heads'], os.path.join(HERE, 'audit-head.png'), T=130)
