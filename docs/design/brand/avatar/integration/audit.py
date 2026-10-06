#!/usr/bin/env python3
"""Bolt-on audit (10-04): every shipped accessory on 4 bodies, through the CORE layout (dump-layout.ts),
rendered with the apps' recipe (avatar_draw.render). Writes audit-<group>.png.
  python3 integration/audit.py            sheets + the wrap-line hoop check
  python3 integration/audit.py --wraps    only the hoop check (exit 1 on a failure)

Wrap-line hoop check (10-05: the chain "went around his arms like a hula hoop", and the cape cords ran straight
across the belly; the face/letter fit check passed them): every SHIPPED wrap-line layer (pieces `wrap`, plus the
per-body scarf art) is drawn at its manifest rect on its body, and FAILS when its opaque pixels
  - sit on the body's arms (integration/pieces.arm_mask: the hand ellipses) > ARM_MAX of the body square, or
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


def catalogs():
    src = open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-config.ts')).read()
    def arr(name):
        m = re.search(r'export const ' + name + r' = \[(.*?)\] as const', src, re.S)
        return [x for x in re.findall(r"'([^']+)'", m.group(1)) if x != 'none']
    return {k: arr(v) for k, v in dict(heads='AVATAR_HEADS', faces='AVATAR_FACES', necks='AVATAR_NECKS').items()}


def dump(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(AV, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
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
    f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 11)
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
            R = rig(body)
            A, arms = R['A'], arm_mask(body, grow=1.0)
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


if __name__ == '__main__':
    if '--wraps' in sys.argv:
        sys.exit(1 if wrap_hoops() else 0)
    wrap_hoops()
    C = catalogs()
    sheet('neck', C['necks'], os.path.join(HERE, 'audit-neck.png'))
    sheet('face', C['faces'], os.path.join(HERE, 'audit-face.png'))
    sheet('head', C['heads'], os.path.join(HERE, 'audit-head.png'), T=130)
