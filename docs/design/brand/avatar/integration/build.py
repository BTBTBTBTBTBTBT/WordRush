#!/usr/bin/env python3
"""Rebuild the bolt-on offenders with the integration rig, fit-check them on all 12 bodies, and write the
before/after art for the gallery.
  python3 integration/build.py            → integration/out/*.webp + integration/fit-integrated.json
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
from rig import compose, tile, MAN, REPO, AV, Image  # noqa: E402
from pieces import REBUILT  # noqa: E402
from fitcheck import check  # noqa: E402
from avatar_draw import render  # noqa: E402

OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
SHOW = [('classic', 'purple'), ('tall', 'teal'), ('blob', 'amber'), ('star', 'pink')]
ALLC = ['purple', 'teal', 'amber', 'pink', 'sky', 'green', 'orange', 'red', 'slate', 'blue', 'mint', 'lilac']
BG = (241, 239, 250, 255)
T = 240


def dump(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(AV, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)['out']


def comp(body, color, L):
    return compose(body, color, back=L.get('back', ()), front=L.get('front', ()), held=L.get('held', ()),
                   handover=L.get('handover', ()))


def row(ims, T=T):
    s = Image.new('RGBA', (T * len(ims), T), BG)
    for i, im in enumerate(ims):
        s.alpha_composite(im, (i * T, 0))
    return s


def main(only=None):
    report = {}
    for part, fn in REBUILT.items():
        if only and part not in only:
            continue
        before = dump([dict(body=b, color=c, neck=part, head='none', face='none', eyes='beady', mouth='smile') for b, c in SHOW])
        bims = [render(e, T, bg=BG, letter='A') for e in before]
        aims, allims, rep = [], [], {}
        bodies = list(MAN['bodies'])
        for i, b in enumerate(bodies):
            L = fn(b)
            if L.get('unsupported'):
                rep[b] = dict(unsupported=L['unsupported'], fails=[])
                t = tile(comp(b, dict(SHOW).get(b, ALLC[i % len(ALLC)]), {}), T, bg=BG)
                allims.append(Image.blend(t, Image.new('RGBA', t.size, BG), 0.7))
                if b in dict(SHOW):
                    aims.append((b, allims[-1]))
                continue
            metrics, fails = check(b, L)
            rep[b] = dict(metrics=metrics, fails=fails)
            col = dict(SHOW).get(b, ALLC[i % len(ALLC)])
            t = tile(comp(b, col, L), T, bg=BG)
            allims.append(t)
            if b in dict(SHOW):
                aims.append((b, t))
        aims = [t for b, t in sorted(aims, key=lambda bt: [s[0] for s in SHOW].index(bt[0]))]
        row(bims).convert('RGB').save(os.path.join(OUT, f'{part}-before.webp'), quality=88)
        row(aims).convert('RGB').save(os.path.join(OUT, f'{part}-after.webp'), quality=88)
        sheet = Image.new('RGBA', (T * 6, T * 2), BG)
        for i, t in enumerate(allims):
            sheet.alpha_composite(t, ((i % 6) * T, (i // 6) * T))
        sheet.convert('RGB').save(os.path.join(OUT, f'{part}-all12.webp'), quality=86)
        nf = sum(1 for v in rep.values() if v['fails'])
        print(f'{part:10s} fails on {nf}/12', {b: v['fails'] for b, v in rep.items() if v['fails']})
        report[part] = rep
    p = os.path.join(HERE, 'fit-integrated.json')
    old = json.load(open(p)) if os.path.exists(p) else {}
    old.update(report)
    json.dump(old, open(p, 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1:] or None)
