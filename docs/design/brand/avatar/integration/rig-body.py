#!/usr/bin/env python3
"""Rig ANY player body for poses + the living mascot (10-06, docs/cloud-prompts/06). ONE command, no per-body tuning:

    python3 integration/rig-body.py <bodyId> [<bodyId> …]      # e.g. classic, or a size variant classic@XL
    python3 integration/rig-body.py --all                       # the 12 shipped bodies
    python3 integration/rig-body.py --sizes classic,star,bean   # prove it on the 6 size variants (sizes.py)
    python3 integration/rig-body.py --all --ship                # + write the layer art to web / iOS / Android

What it does, from the body's art + its landmarks (landmarks.py, PR #41) only:
  1. arms   the two mittens = landmarks.arm_regions (hand ellipse ∪ the outline bulge between its notches), grown a
            little so the cut runs through plain body, never through the mitten's own outline. The layer keeps the
            exact art pixels; it fades in over FEATHER px on the torso side, and the base keeps the art under that
            fade, so the rest pose is exact and a moved arm leaves no hard seam.
  2. base   the art without the mittens: where a mitten lay over the torso the torso is inpainted (Telea, from the
            body's own neighboring pixels); outside the torso it is cleared. The torso's own edge under the mitten
            comes from the landmark torso mask (the silhouette with the arm bulges removed).
  3. feet   everything below the hip line (landmarks hips.y), drawn BEHIND the base; the base fades out over the
            feet tops, the feet layer fades in over the same band, so they tuck under the body when they move.
  4. pivots shoulder = the arm's upper notch (landmarks arms.start) pulled 30% of the mitten width into the torso;
            hand = the hand ellipse center; feet = the middle of the hip line.
  5. check  composite feet → base → arms and diff against the shipped body art (mean |Δ| premultiplied RGB over the
            body pixels, target < 2/255, like the cast rigs) → rigs/<body>/diff.png.
  6. sheet  every pose in packages/core/src/avatar-poses.json, white + tinted → rigs/<body>/sheet.jpg.

The body art is WHITE and tinted at runtime (multiply), so the layers are cut from the white art: tint still works.
Poses are shared data (avatar-poses.json): a new body gets every pose for free. Output (body units, like
avatar-parts.json) goes to rigs/rigs.json, merged into avatar-poses.json `rigs` by --ship.
"""
import argparse, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
import cv2  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from scipy import ndimage  # noqa: E402
import landmarks as LM  # noqa: E402
import rig  # noqa: E402
from rig import U, M, CW, MAN  # noqa: E402

AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
OUT = os.path.join(AV, 'rigs')
POSES_JSON = os.path.join(REPO, 'packages', 'core', 'src', 'avatar-poses.json')
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
GROW = 7          # px (at U = 640) the mitten cut is grown past the mitten outline (into plain body)
FEATHER = 4       # px the arm layer fades in over on the torso side
FEET_BAND = 0.03  # body units: the base fades out / the feet fade in over hips.y ± this
LIMBS = ('feet', 'armL', 'armR')
# Hand overrides: where the automatic cut truly fails on a body (none needed on the 12 bodies; kept for new art).
OVERRIDES = {}


def bu(v):
    return round(float((v - M) / U), 4)


def cut(body):
    """→ dict(layers={name: RGBA float canvas}, rig=body-unit pivots, masks) for one body."""
    lm = LM.measure(body)
    pr = lm['_']
    art = np.asarray(rig.body_art(body)).astype(np.float32)
    a = art[..., 3]
    A = a > 0
    yy, xx = np.mgrid[0:CW, 0:CW]
    torso = pr['torso']
    layers, piv = {}, {}
    base = art.copy()
    # ---- arms
    arm_zone = np.zeros_like(A)
    for s, reg in pr['arms'].items():
        # the mitten reaches further over the torso than the landmark hand ellipse (40% of its protrusion): widen
        # the ellipse inward so the whole thumb comes with the arm
        hx, hy, rx, ry = [v * U for v in lm['arms'][s]['hand']]
        hx += M; hy += M
        sg_ = -1 if s == 'L' else 1
        inner = (((xx - (hx - sg_ * 0.3 * rx)) / (rx * 1.3)) ** 2 + ((yy - hy) / (ry * 1.04)) ** 2 <= 1) & A
        m = ndimage.binary_dilation(reg | inner, iterations=GROW) & A
        # the part of the cut inside the torso fades in over FEATHER px (distance from the cut's edge)
        # distance to the cut's edge INSIDE the body only (the outline next to the background is not a cut)
        d = ndimage.distance_transform_edt(m | ~A)
        ramp = np.clip(d / FEATHER, 0, 1) * m
        L = art.copy()
        L[..., 3] = a * ramp
        layers[f'arm{s}'] = L
        core = m & (ramp >= 1)          # fully the arm: the base under it gets the torso (inpainted) or nothing
        arm_zone |= core
        st = np.array(lm['arms'][s]['start']) * U + M
        hx, hy, rx, ry = lm['arms'][s]['hand']
        sg = -1 if s == 'L' else 1
        px = st[0] - sg * 0.3 * (2 * rx * U)
        piv[f'arm{s}'] = dict(pivot=[bu(px), bu(st[1])], hand=[hx, hy], handR=[rx, ry])
    # the torso under the mittens: continue the body's own silhouette edge through the arm rows (a quadratic through
    # the edge just above and below each arm), so a moved arm leaves the body's real outline, never a flap
    hip = M + lm['hips']['y'] * U
    ta = (A & ~arm_zone).astype(np.float32)
    xsA = np.nonzero(A.any(0))[0]
    cx = (xsA.min() + xsA.max()) / 2
    free = A & ~ndimage.binary_dilation(arm_zone, iterations=3)
    clip_rows = []
    for s in 'LR':
        z = np.zeros_like(A)
        lab = layers[f'arm{s}'][..., 3] > 0
        z |= lab & arm_zone
        if not z.any():
            continue
        ys = np.nonzero(z.any(1))[0]
        y0, y1 = ys.min(), ys.max()
        rows = [y for y in list(range(max(0, y0 - 36), y0 - 2)) + list(range(y1 + 3, int(min(y1 + 36, hip - 4))))
                if (free[y, :int(cx)].any() if s == 'L' else free[y, int(cx):].any())]
        def ex(y):
            r = np.nonzero(free[y])[0]
            r = r[r < cx] if s == 'L' else r[r >= cx]
            return r.min() if s == 'L' else r.max()
        if len(rows) < 4:
            continue
        coef = np.polyfit(rows, [ex(y) for y in rows], 2 if (min(rows) < y0 and max(rows) > y1) else 1)
        for y in range(max(0, y0 - 6), min(int(hip) - 2, y1 + 14) + 1):
            e = float(np.polyval(coef, y))
            if not (y0 <= y <= y1):          # around the arm: only clear what lies outside the continued edge
                xs_ = np.arange(CW)
                cov = np.clip((xs_ - e + 0.5) if s == 'L' else (e + 0.5 - xs_), 0, 1)
                side = (xs_ < cx) if s == 'L' else (xs_ >= cx)
                out_ = side & (cov < 1) & A[y] & ~free[y]
                ta[y, out_] = np.minimum(ta[y, out_], cov[out_])
                clip_rows.append((y, out_))
                continue
            xs_ = np.arange(CW)
            cov = np.clip((xs_ - e + 0.5) if s == 'L' else (e + 0.5 - xs_), 0, 1)   # 1 inside the edge, AA at it
            side = (xs_ < cx) if s == 'L' else (xs_ >= cx)
            row = z[y] | (side & (cov > 0) & ~A[y])
            ta[y, row & side] = np.maximum(ta[y, row & side], cov[row & side])
            ta[y, side & (cov >= 1) & ~A[y]] = 1.0
    tmask = (ta > 0) & arm_zone | ((ta > 0) & ~A)
    rgb = np.clip(art[..., :3], 0, 255).astype(np.uint8)
    rgb = cv2.inpaint(rgb, (tmask & (ta > 0)).astype(np.uint8) * 255, 9, cv2.INPAINT_TELEA).astype(np.float32)
    fillz = arm_zone | tmask
    base[fillz, :3] = rgb[fillz]
    base[fillz, 3] = 255 * ta[fillz]
    for y, o in clip_rows:
        base[y, o, 3] = np.minimum(base[y, o, 3], 255 * ta[y, o])
    # thin slivers the cut left beside an arm (the mitten's own anti-aliased crease running past the cut, 1-2 px):
    # dropped, so a moved arm leaves nothing hanging off the body or the hand (costs ~0.01/255 of rest diff)
    vis = base[..., 3] > 8
    thin = vis & ~ndimage.binary_dilation(ndimage.binary_opening(vis, iterations=2), iterations=1)
    for s in 'LR':
        near = ndimage.binary_dilation(layers[f'arm{s}'][..., 3] > 0, iterations=30)
        base[thin & near, 3] = 0
    # ---- feet (behind the base)
    band = FEET_BAND * U
    up = np.clip((hip + band - yy) / band, 0, 1)            # base: 1 at the hip line, 0 at hip + band
    # the feet: the two biggest parts of the silhouette under the hip line, extended up through the band by their
    # column span (hard-cut: the opaque base covers the band, so the feet never show a fade when they move)
    low = A & (yy > hip + 0.012 * U)
    lab, n = ndimage.label(low)
    feet_m = np.zeros_like(A)
    if n:
        sz = ndimage.sum(low, lab, range(1, n + 1))
        for i in np.argsort(sz)[::-1][:2]:
            c = lab == i + 1
            ys_, xs_ = np.nonzero(c)
            top = ys_.min()
            span = np.nonzero(c[top + 2])[0] if c[top + 2].any() else xs_
            col = np.zeros(CW, bool)
            col[max(0, span.min() - 3):span.max() + 4] = True
            feet_m |= c | (A & (yy >= hip - band) & (yy <= top + 2) & col[None, :])
    feet_m = ndimage.binary_dilation(feet_m, iterations=2) & A & ~ndimage.binary_dilation(arm_zone, iterations=2)
    F = art.copy()
    F[..., 3] = a * feet_m
    layers['feet'] = F
    # the base keeps the torso down to the hip line (it covers the feet tops) and fades out over the band below it
    keep = np.where(feet_m & (yy > hip), up, 1.0)
    base[..., 3] = base[..., 3] * keep
    layers['base'] = base
    fx = [lm['feet'][s] for s in 'LR']
    piv['feet'] = dict(pivot=[round((fx[0][0] + fx[1][2]) / 2, 4), lm['hips']['y']])
    piv['floor'] = lm['floor']
    piv['hips'] = lm['hips']['y']
    piv.update(OVERRIDES.get(body, {}))
    return dict(layers=layers, rig=piv, lm=lm)


def over(dst, src):
    sa = src[..., 3:4] / 255
    out = dst.copy()
    out[..., :3] = src[..., :3] * sa + dst[..., :3] * dst[..., 3:4] / 255 * (1 - sa)
    out[..., 3:4] = src[..., 3:4] + dst[..., 3:4] * (1 - sa)
    al = np.maximum(out[..., 3:4], 1e-3) / 255
    out[..., :3] = np.where(out[..., 3:4] > 0, out[..., :3] / al, 0)
    return out


def rest_diff(body, R, save=None):
    art = np.asarray(rig.body_art(body)).astype(np.float32)
    comp = np.zeros_like(art)
    for n in ('feet', 'base', 'armL', 'armR'):
        comp = over(comp, R['layers'][n])
    pc = comp[..., :3] * comp[..., 3:] / 255
    ph = art[..., :3] * art[..., 3:] / 255
    ch = art[..., 3] > 0
    d = np.abs(pc - ph).mean(2)
    dA = np.abs(comp[..., 3] - art[..., 3])
    if save:
        vis = np.clip(np.maximum(d, dA) * 8, 0, 255).astype(np.uint8)[M:M + U, M:M + U]
        Image.fromarray(vis).save(save)
    return dict(meanAbsRGB=round(float(d[ch].mean()), 3), meanAbsAlpha=round(float(dA[ch].mean()), 3),
                p99RGB=round(float(np.percentile(d[ch], 99)), 1))


# ------------------------------------------------------------------------------------------------ poses (reference)
def load_poses():
    return json.load(open(POSES_JSON))


def mat(a, b, c, d, e, f):
    return np.array([[a, c, e], [b, d, f], [0, 0, 1]], float)


def T(x, y):
    return mat(1, 0, 0, 1, x, y)


def S(x, y):
    return mat(x, 0, 0, y, 0, 0)


def Rd(deg):
    r = np.radians(deg)
    return mat(np.cos(r), np.sin(r), -np.sin(r), np.cos(r), 0, 0)


def pose_mats(rg, p):
    """The reference of core avatar-pose.ts avatarPoseMatrices: body-unit 3×3 matrices for root / armL / armR / feet.
    Arm rot is OUTWARD-positive for both sides (the viewer's-right arm is mirrored), dx outward-positive. The body
    squashes / tilts about the middle of the hip line (so the body never parts from the feet); body dy lifts the
    feet too; the feet squash about the floor."""
    b = p.get('body', {})
    hx, hy = rg['feet']['pivot']
    fl = rg['floor']
    lift = T(0, b.get('dy', 0))
    root = lift @ T(hx, hy) @ Rd(b.get('rot', 0)) @ S(b.get('sx', 1), b.get('sy', 1)) @ T(-hx, -hy)
    out = {'root': root}
    for s in 'LR':
        q = p.get('arms', {}).get(s, {})
        sg = 1 if s == 'L' else -1
        px, py = rg[f'arm{s}']['pivot']
        out[f'arm{s}'] = root @ T(px - sg * q.get('dx', 0), py + q.get('dy', 0)) @ Rd(sg * q.get('rot', 0)) @ T(-px, -py)
    f = p.get('feet', {})
    out['feet'] = lift @ T(hx, fl + f.get('dy', 0)) @ S(f.get('sx', 1), f.get('sy', 1)) @ T(-hx, -fl)
    return out


def to_canvas(m):
    """body-unit matrix → canvas px matrix."""
    k = T(M, M) @ S(U, U)
    return k @ m @ np.linalg.inv(k)


def warp(layer, m):
    mc = to_canvas(m)
    pm = layer.copy()
    pm[..., :3] *= pm[..., 3:] / 255
    w = cv2.warpAffine(pm, mc[:2].astype(np.float32), (CW, CW), flags=cv2.INTER_LINEAR)
    al = np.maximum(w[..., 3:], 1e-3) / 255
    w[..., :3] = np.where(w[..., 3:] > 0, w[..., :3] / al, 0)
    return w


def tint(layer, hexc):
    c = np.array(rig.hexrgb(hexc), np.float32) / 255
    out = layer.copy()
    out[..., :3] *= c
    return out


def render_pose(R, p, color=None):
    mats = pose_mats(R['rig'], p)
    comp = np.zeros((CW, CW, 4), np.float32)
    for n, k in (('feet', 'feet'), ('base', 'root'), ('armL', 'armL'), ('armR', 'armR')):
        L = R['layers'][n] if color is None else tint(R['layers'][n], color)
        comp = over(comp, warp(L, mats[k]))
    return comp


def sheet(body, R, path, colors=('#f8fafc', '#7c3aed')):
    P = load_poses()['poses']
    names = ['rest'] + list(P)
    T_ = 200
    im = Image.new('RGB', (T_ * len(names), T_ * len(colors) + 22), (40, 38, 64))
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype(rig.NUNITO, 15)
    except Exception:  # noqa: BLE001
        f = ImageFont.load_default()
    for i, n in enumerate(names):
        d.text((i * T_ + 6, 3), n, fill=(230, 226, 255), font=f)
        for j, c in enumerate(colors):
            arr = render_pose(R, {} if n == 'rest' else P[n], c)
            t = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA').crop((M - U // 4, M - U // 4, M + U + U // 4, M + U + U // 8))
            t.thumbnail((T_ - 8, T_ - 8), Image.LANCZOS)
            bg = Image.new('RGBA', t.size, (232, 228, 248, 255) if j == 0 else (250, 246, 255, 255))
            bg.alpha_composite(t)
            im.paste(bg.convert('RGB'), (i * T_ + 4, 22 + j * T_ + 4))
    im.save(path, quality=86)


# ------------------------------------------------------------------------------------------------ output
def layer_img(arr):
    """canvas → the body square at U px (the shipped body art's frame)."""
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)[M:M + U, M:M + U], 'RGBA')


def ship_art(name, im):
    im.save(os.path.join(WEB, name + '.webp'), 'WEBP', quality=90, method=6)
    # Android resource names must be lowercase (aapt2); MascotComposer falls back to the lowercased name
    im.save(os.path.join(DROID, name.replace('-', '_').lower() + '.webp'), 'WEBP', quality=90, method=6)
    iset = os.path.join(IOS, name + '.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, name + '.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': name + '.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


def run(body, ship=False, do_sheet=True):
    R = cut(body)
    d = os.path.join(OUT, body.replace('@', '-'))
    os.makedirs(os.path.join(d, 'layers'), exist_ok=True)
    diff = rest_diff(body, R, os.path.join(d, 'diff.png'))
    for n in ('base',) + LIMBS:
        im = layer_img(R['layers'][n])
        im.save(os.path.join(d, 'layers', n + '.png'), optimize=True)
        if ship:
            ship_art(f'art-av-body-{body}-{n}', im)
    R['rig']['restDiff'] = diff
    if do_sheet:
        sheet(body, R, os.path.join(d, 'sheet.jpg'))
    print(body, 'rest diff', diff, flush=True)
    return R


# ------------------------------------------------------------------------------------------------ per-pose guards
GUARD_C = 320                 # content px the guards render at
LAYOUTS = os.path.join(OUT, '_pose-layouts.json')   # written by packages/core/scripts/dump-pose-layouts.ts
_alpha = {}


def art_alpha(name):
    if name not in _alpha:
        p = os.path.join(WEB, name + '.webp')
        _alpha[name] = (np.asarray(Image.open(p).convert('RGBA'))[..., 3].astype(np.float32) / 255) if os.path.exists(p) else None
    return _alpha[name]


def place_alpha(L, C=GUARD_C):
    """A layout layer's alpha in the content square (C px), through its matrix."""
    a = art_alpha(L['art'])
    if a is None:
        return np.zeros((C, C), np.float32)
    r = L['rect']
    h, w = a.shape
    A_ = np.array([[r['w'] * C / w, 0, r['x'] * C], [0, r['h'] * C / h, r['y'] * C], [0, 0, 1]])
    m = L.get('m') or [1, 0, 0, 1, 0, 0]
    Mc = np.array([[m[0], m[2], m[4] * C], [m[1], m[3], m[5] * C], [0, 0, 1]])
    return cv2.warpAffine(a, (Mc @ A_)[:2].astype(np.float32), (C, C), flags=cv2.INTER_LINEAR)


def box_mask(r, m, C=GUARD_C):
    pts = np.array([[r['x'], r['y']], [r['x'] + r['w'], r['y']], [r['x'] + r['w'], r['y'] + r['h']], [r['x'], r['y'] + r['h']]])
    m = m or [1, 0, 0, 1, 0, 0]
    q = np.stack([m[0] * pts[:, 0] + m[2] * pts[:, 1] + m[4], m[1] * pts[:, 0] + m[3] * pts[:, 1] + m[5]], 1) * C
    im = np.zeros((C, C), np.uint8)
    cv2.fillPoly(im, [q.astype(np.int32)], 1)
    return im.astype(np.float32)


def guards():
    """Re-run the fit guards per pose: an item drawn above the arms may not hide a moved arm, a held item may not
    swing over the face or the letter, and nothing may hang upside down. A failing item is withheld in that pose
    on that body (avatar-poses.json `withheld`), and logged to rigs/guards.json."""
    cases = json.load(open(LAYOUTS))
    fails = {}
    for c in cases:
        Ls = c['layers']
        arms = [i for i, L in enumerate(Ls) if L['art'].endswith(('-armL', '-armR'))]
        if not arms:
            continue
        arm_a = sum(place_alpha(Ls[i]) for i in arms)
        top_arm = max(arms)
        face = np.zeros_like(arm_a)
        for L in Ls:
            if L['layer'] in ('eyes', 'mouth'):
                face = np.maximum(face, box_mask(L['rect'], L.get('m')))
        face = np.maximum(face, box_mask(c['letter'], c.get('letterM')))
        why = []
        for i, L in enumerate(Ls):
            if L['field'] != c['field']:
                continue
            ia = place_alpha(L)
            n = ia.sum() + 1e-6
            m = L.get('m') or [1, 0, 0, 1, 0, 0]
            if i > top_arm and L.get('ride') not in ('armL', 'armR', 'handL', 'handR'):
                cover = np.minimum(ia, arm_a).sum() / (arm_a.sum() + 1e-6)
                if cover > 0.15:
                    why.append(f'hides a moved arm ({cover:.0%})')
            if L.get('ride') in ('armL', 'armR', 'handL', 'handR'):
                over_face = np.minimum(ia, face).sum() / n
                ang = abs(np.degrees(np.arctan2(m[1], m[0])))
                if over_face > 0.02:
                    why.append(f'swings over the face / letter ({over_face:.0%})')
                if ang > 100:
                    why.append(f'upside down ({ang:.0f} deg)')
        if why:
            key = f"{'brows' if c['field'] == 'brows' else 'acc'}:{c['id']}"
            fails.setdefault(c['pose'], {}).setdefault(c['body'], {})[key] = sorted(set(why))
    json.dump(fails, open(os.path.join(OUT, 'guards.json'), 'w'), indent=1)
    P = load_poses()
    P['withheld'] = {pose: {b: sorted(v) for b, v in sorted(bs.items())} for pose, bs in sorted(fails.items())}
    json.dump(P, open(POSES_JSON, 'w'), indent=1)
    open(POSES_JSON, 'a').write('\n')
    n = sum(len(v) for bs in fails.values() for v in bs.values())
    print('guards:', len(cases), 'cases,', n, 'withheld', {p: sum(len(v) for v in bs.values()) for p, bs in fails.items()})


def boxes(body):
    """Each rig layer's opaque box in body units [x0, y0, x1, y1] (from the saved layers)."""
    out = {}
    for n in LIMBS:
        a = np.asarray(Image.open(os.path.join(OUT, body.replace('@', '-'), 'layers', n + '.png')))[..., 3] > 8
        ys, xs = np.nonzero(a)
        out[n] = [round(float(xs.min()) / U, 4), round(float(ys.min()) / U, 4), round(float(xs.max() + 1) / U, 4), round(float(ys.max() + 1) / U, 4)]
    return out


def write_rigs(rigs):
    P = load_poses()
    P['rigs'] = {}
    for b, r in rigs.items():
        if '@' in b:
            continue
        r = {k: v for k, v in r.items() if k != 'restDiff'}
        for n, bx in boxes(b).items():
            r[n] = dict(r[n], box=bx)
        P['rigs'][b] = r
    json.dump(P, open(POSES_JSON, 'w'), indent=1)
    open(POSES_JSON, 'a').write('\n')
    # the web art sizes (lib/art.ts spreads them into ART_SIZE)
    with open(os.path.join(REPO, 'apps', 'web', 'lib', 'art-av-rigs.ts'), 'w') as f:
        f.write('// GENERATED by docs/design/brand/avatar/integration/rig-body.py --ship (10-06): the body rig layers\n'
                '// art-av-body-<body>-<base|feet|armL|armR> (the body square, like the body art). Spread into ART_SIZE (lib/art.ts).\n'
                '// Do not edit by hand.\n'
                'export const AVATAR_RIG_SIZE: Record<`art-av-body-${string}`, readonly [number, number]> = {\n')
        for b in P['rigs']:
            for n in ('base',) + LIMBS:
                f.write(f"  'art-av-body-{b}-{n}': [{U}, {U}],\n")
        f.write('};\n')
    # the shipped-art list in avatar-parts.json (renderers only fetch listed art)
    mp = os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')
    raw = open(mp).read()
    man = json.loads(raw)
    names = [f'art-av-body-{b}-{n}' for b in P['rigs'] for n in ('base',) + LIMBS]
    add = [n for n in names if n not in man['art']]
    if add:
        man['art'] = man['art'] + add
        json.dump(man, open(mp, 'w'), indent=1 if '\n "' in raw[:40] else 2, ensure_ascii=False)
        open(mp, 'a').write('\n')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bodies', nargs='*')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--sizes', default='')
    ap.add_argument('--ship', action='store_true')
    ap.add_argument('--no-sheet', action='store_true')
    ap.add_argument('--guards', action='store_true', help='re-run the per-pose guards (after dump-pose-layouts.ts)')
    ap.add_argument('--write-rigs', action='store_true', help='rewrite avatar-poses.json rigs from rigs/rigs.json')
    a = ap.parse_args()
    if a.guards:
        return guards()
    if a.write_rigs:
        return write_rigs(json.load(open(os.path.join(OUT, 'rigs.json'))))
    bodies = list(a.bodies)
    if a.all:
        bodies += [b for b in MAN['bodies'] if '@' not in b]
    if a.sizes:
        import sizes
        sel = a.sizes.split(',')
        sizes.register_all(sel)
        bodies += [sizes.vid(b, s) for b in sel for s in sizes.SIZES]
    os.makedirs(OUT, exist_ok=True)
    idx = os.path.join(OUT, 'rigs.json')
    rigs = json.load(open(idx)) if os.path.exists(idx) else {}
    for b in bodies:
        rigs[b] = run(b, ship=a.ship and '@' not in b, do_sheet=not a.no_sheet)['rig']
    json.dump(rigs, open(idx, 'w'), indent=1)
    if a.ship:
        write_rigs(rigs)


if __name__ == '__main__':
    main()
