#!/usr/bin/env python3
"""Mascot fit check (FINISH_SPEC AN round 2): lays out every body × hat × neck item, every face part
on every body, and a seeded sample of mixed face combos through the CORE layout (dump-layout.ts →
packages/core/src/avatar-layout.ts, the code all three apps run), then checks the PIXELS:

  frame   the union of all layer rects sits inside the padded tile (fit.pad), uniform scale ≥ fit.minBody
  art     every layer's art exists (parts/ — the apps' copies are checked by the art-coverage tests)
  face    eyes / mouth / nose / cheeks sit on the body (≥ 92% of their opaque pixels over body pixels;
          glasses / mustaches ≥ 75%)
  hat     a hat touches the head (≤ 3 px gap at 200 px; the halo floats by design) and covers ≤ 4% of the
          eyes (overFace hats exempt)
  back    a back item tucks behind the body (≥ 6% of it under the body), still shows (≥ 15% visible; a
          guitar ≥ 6% — its neck over the shoulder), and
          the symmetric ones (capes, wings) stay centered on the body (≤ 6% of the tile off)
  neck    a neck-front item sits on the body (≥ 55% over body; a held item ≥ 5%)

Writes fit-worst.png (every back item on every body + the worst-scoring combos) and prints a summary.
  python3 fit-check.py [--sheet fit-worst.png]
"""
import json, os, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
PARTS = os.path.join(HERE, 'parts')
sys.path.insert(0, HERE)
from avatar_draw import render  # noqa: E402

S = 200
# Worn floating by design (a halo hovers over the head).
FLOATING = {'halo'}
# Slung items read from the front by what peeks out (a guitar's neck over the shoulder).
PEEK = {'guitar': 0.06}


def catalogs():
    src = open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-config.ts')).read()
    import re
    def arr(name):
        m = re.search(r'export const ' + name + r' = \[(.*?)\] as const', src, re.S)
        return re.findall(r"'([^']+)'", m.group(1))
    return {k: arr(v) for k, v in dict(bodies='AVATAR_BODIES', eyes='AVATAR_EYES', mouths='AVATAR_MOUTHS', noses='AVATAR_NOSES',
                                      cheeks='AVATAR_CHEEKS', heads='AVATAR_HEADS', faces='AVATAR_FACES', necks='AVATAR_NECKS').items()}


def dump(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(HERE, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


_alpha = {}


def alpha(name, w, h):
    k = (name, w, h)
    if k not in _alpha:
        im = Image.open(os.path.join(PARTS, name + '.png')).getchannel('A').resize((w, h), Image.BILINEAR)
        _alpha[k] = np.asarray(im) > 96
    return _alpha[k]


def masks(layout):
    out = []
    for L in layout['layers']:
        r = L['rect']
        x, y = int(round(r['x'] * S)), int(round(r['y'] * S))
        w, h = max(1, int(round(r['w'] * S))), max(1, int(round(r['h'] * S)))
        m = np.zeros((S, S), bool)
        a = alpha(L['art'], w, h)
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(S, x + w), min(S, y + h)
        if x1 > x0 and y1 > y0:
            m[y0:y1, x0:x1] = a[y0 - y:y1 - y, x0 - x:x1 - x]
        out.append((L, m))
    return out


def check(e, items, fit):
    lay, cfg = e['layout'], e['config']
    issues, score = [], 0.0
    b = lay['bounds']
    pad = fit['pad'] - 1e-3
    if b['x'] < pad or b['y'] < pad or b['x'] + b['w'] > 1 - pad or b['y'] + b['h'] > 1 - pad:
        issues.append('frame')
    if lay['scale'] < fit['minBody'] - 1e-6:
        issues.append('scale %.3f' % lay['scale'])
    for L in lay['layers']:
        if not os.path.exists(os.path.join(PARTS, L['art'] + '.png')):
            issues.append('art ' + L['art'])
    if any(i.startswith('art ') for i in issues):
        return issues, 99
    ms = masks(lay)
    body = next(m for L, m in ms if L['layer'] == 'body')
    bys, bxs = np.nonzero(body)
    bcx = bxs.mean() if len(bxs) else S / 2
    eyes = next((m for L, m in ms if L['layer'] == 'eyes'), None)
    for L, m in ms:
        n = m.sum()
        if n == 0 or L['layer'] == 'body':
            continue
        on = (m & body).sum() / n
        key = ('acc:' if L['field'] in ('head', 'face', 'neck') else {'eyes': 'eyes:', 'mouth': 'mouth:', 'nose': 'nose:', 'cheeks': 'cheeks:'}[L['field']]) + L['id']
        it = items.get(key, {})
        if L['layer'] in ('eyes', 'mouth', 'nose', 'cheeks'):
            if on < 0.92:
                issues.append('%s off-face %.2f' % (L['art'], on)); score += (0.92 - on) * 10
        elif L['layer'] == 'face':
            need = 0.75 if it.get('slot') in ('glasses', 'mustache') else 0.85
            if on < need:
                issues.append('%s off-face %.2f' % (L['art'], on)); score += (need - on) * 10
        elif L['layer'] == 'head':
            ys, xs = np.nonzero(m)
            # gap: hat's lowest opaque row vs the body's top opaque row in the hat's columns
            cols = np.unique(xs)
            bt = [np.nonzero(body[:, c])[0] for c in cols]
            tops = [t[0] for t in bt if len(t)]
            touch = (m & body).any()
            gap = 0 if touch else (min(tops) - ys.max() if tops else 99)
            if gap > 3 and L['id'] not in FLOATING:
                issues.append('%s floats %dpx' % (L['art'], gap)); score += gap
            if eyes is not None and not it.get('overFace') and eyes.sum():
                cov = (m & eyes).sum() / eyes.sum()
                if cov > 0.04:
                    issues.append('%s covers eyes %.2f' % (L['art'], cov)); score += cov * 10
        elif L['layer'] == 'back':
            vis = (m & ~body).sum() / n
            if on < 0.06:
                issues.append('%s detached %.2f' % (L['art'], on)); score += (0.06 - on) * 20
            need = PEEK.get(L['id'], 0.15)
            if vis < need:
                issues.append('%s hidden %.2f' % (L['art'], vis)); score += (need - vis) * 10
            if L['id'] in ('cape', 'supercape', 'wings', 'fairywings'):
                ys, xs = np.nonzero(m)
                off = abs(xs.mean() - bcx) / S
                if off > 0.06:
                    issues.append('%s off-center %.2f' % (L['art'], off)); score += off * 20
        elif L['layer'] == 'neckFront':
            need = 0.05 if it.get('slot') == 'hand' else 0.55
            if on < need:
                issues.append('%s off-body %.2f' % (L['art'], on)); score += (need - on) * 10
    score += max(0, 0.62 - lay['scale']) * 5   # the most shrunk combos read worst
    return issues, score


def main():
    sheet_out = sys.argv[sys.argv.index('--sheet') + 1] if '--sheet' in sys.argv else os.path.join(HERE, 'fit-worst.png')
    C = catalogs()
    cfgs = []
    for body in C['bodies']:
        for head in C['heads']:
            for neck in C['necks']:
                cfgs.append(dict(body=body, head=head, neck=neck, face='none', nose='none', cheeks='none'))
        for f, ids in (('eyes', C['eyes']), ('mouth', C['mouths']), ('nose', C['noses']), ('cheeks', C['cheeks']), ('face', C['faces'])):
            for i in ids:
                cfgs.append(dict(body=body, **{f: i}))
    rnd = random.Random(7)
    for _ in range(1200):   # sampled mixed face combos (conflicts resolve in the core layout)
        cfgs.append(dict(body=rnd.choice(C['bodies']), eyes=rnd.choice(C['eyes']), mouth=rnd.choice(C['mouths']),
                         nose=rnd.choice(C['noses']), cheeks=rnd.choice(C['cheeks']), face=rnd.choice(C['faces']),
                         head=rnd.choice(C['heads']), neck=rnd.choice(C['necks'])))
    small = [dict(c, small=True) for c in cfgs[::5]]
    d = dump(cfgs + small)
    items, fit = d['items'], d['fit']
    fails, scored = [], []
    for i, e in enumerate(d['out']):
        issues, sc = check(e, items, fit)
        if issues:
            fails.append((i, issues))
        scored.append((sc, i))
    n_body_hat_neck = len(C['bodies']) * len(C['heads']) * len(C['necks'])
    print(f'combinations: {len(cfgs)} large + {len(small)} small = {len(d["out"])} '
          f'(body×hat×neck {n_body_hat_neck}, single face parts {len(C["bodies"]) * sum(len(C[k]) for k in ("eyes", "mouths", "noses", "cheeks", "faces"))}, sampled 1200)')
    print(f'failures: {len(fails)}')
    agg = {}
    for i, iss in fails:
        for s in iss:
            k = s.rsplit(' ', 1)[0] if s[-1].isdigit() or s.endswith('px') else s
            agg.setdefault(k, []).append(d['out'][i]['config']['body'])
    for k, v in sorted(agg.items(), key=lambda kv: -len(kv[1]))[:60]:
        print(f'  {len(v):5d}  {k}   bodies: {",".join(sorted(set(v)))}')
    # the worst-case sheet: every back item on every body, then the worst-scoring combos
    backs = [n for n in C['necks'] if items.get('acc:' + n, {}).get('layer') == 'back']
    sheet_cfgs, labels = [], []
    for n in backs:
        for body in C['bodies']:
            sheet_cfgs.append(dict(body=body, neck=n, head='none')); labels.append(f'{body} · {n}')
    worst = [i for sc, i in sorted(scored, reverse=True)[:36]]
    for i in worst:
        c = d['out'][i]['config']
        sheet_cfgs.append({k: c[k] for k in ('body', 'eyes', 'mouth', 'nose', 'cheeks', 'face', 'head', 'neck')})
        labels.append(f"{c['body']} · {c['head']} · {c['neck']}")
    sd = dump(sheet_cfgs)
    cols, T = 12, 150
    rows = (len(sheet_cfgs) + cols - 1) // cols
    img = Image.new('RGB', (cols * (T + 8) + 8, rows * (T + 22) + 8), (255, 255, 255))
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 10)
    except Exception:
        font = ImageFont.load_default()
    dr = ImageDraw.Draw(img)
    for k, e in enumerate(sd['out']):
        im = render(e, T, show_bounds=True, pad_frame=fit['pad']).convert('RGB')
        x, y = 8 + (k % cols) * (T + 8), 8 + (k // cols) * (T + 22)
        img.paste(im, (x, y))
        dr.text((x, y + T + 3), labels[k][:28], fill=(60, 40, 90), font=font)
    img.save(sheet_out, optimize=True)
    print('sheet:', os.path.relpath(sheet_out, REPO), f'({len(backs)} back items × {len(C["bodies"])} bodies + {len(worst)} worst)')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
