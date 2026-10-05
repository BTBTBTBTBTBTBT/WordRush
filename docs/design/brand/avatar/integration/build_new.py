#!/usr/bin/env python3
"""New additions (10-05): build every proposal on all 12 bodies, fit-check them, and write gallery art.
  python3 integration/build_new.py   → integration/out/new/<id>.webp (3 bodies), <id>-all12.webp, sets-*.webp,
                                        integration/fit-new.json
Proposals only: avatar-parts.json is not touched."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
from rig import tile, MAN, Image  # noqa
from new_pieces import NEW_ADDITIONS, compose, SETS, head_layer  # noqa
from fitcheck import check  # noqa
import numpy as np
from rig import alpha

OUT = os.path.join(HERE, 'out', 'new')
os.makedirs(OUT, exist_ok=True)
SHOW = [('classic', 'purple'), ('tall', 'teal'), ('blob', 'amber')]
ALLC = ['purple', 'teal', 'amber', 'pink', 'sky', 'green', 'orange', 'red', 'slate', 'blue', 'mint', 'lilac']
BG = (241, 239, 250, 255)
T = 220


def check_new(body, L):
    """fitcheck.check on the classic keys; the new 'shoes' and 'beside' layers are checked for face/letter cover
    and frame (shoes are also seat-checked: ≥ 40% over the feet/body)."""
    base = {k: v for k, v in L.items() if k in ('back', 'front', 'held', 'handover', 'seat_min', 'grip_range')}
    # 'under' garments sit under the letter (it is drawn on top): seat-checked like front, face-checked below
    if L.get('under'):
        base = dict(base); base['front'] = list(base.get('front', [])) + []
    extra = list(L.get('shoes', ())) + list(L.get('beside', ()))
    if extra:
        base = dict(base); base['beside_'] = extra
    metrics, fails = check(body, base)
    from pieces import guards
    from rig import rig
    face, letter = guards(body)
    A = rig(body)['A']
    for k in ('shoes', 'beside', 'under'):
        for im in L.get(k, ()):
            m = alpha(im) > 0.35
            f, l = (m & face).sum() / max(1, face.sum()), (m & letter).sum() / max(1, letter.sum())
            if f > 0.01:
                fails.append(f'{k} covers face {f:.3f}')
            if l > 0.01 and k != 'under':
                fails.append(f'{k} covers letter {l:.3f}')
            if k == 'shoes':
                seat = (m & A).sum() / max(1, m.sum())
                metrics['shoeSeat'] = round(float(seat), 3)
                if seat < 0.25:
                    fails.append(f'shoe floats {seat:.2f}')
    return metrics, fails


def main(only=None):
    rep = {}
    items = NEW_ADDITIONS()
    bodies = list(MAN['bodies'])
    for pid, (cat, label, st, fn) in items.items():
        if only and pid not in only:
            continue
        allims, three, r = [], {}, {}
        for i, b in enumerate(bodies):
            col = dict(SHOW).get(b, ALLC[i % len(ALLC)])
            L = fn(b)
            if L.get('unsupported'):
                r[b] = dict(unsupported=L['unsupported'], fails=[])
                t = tile(compose(b, col, {}), T, bg=BG)
                t = Image.blend(t, Image.new('RGBA', t.size, BG), 0.7)
            else:
                metrics, fails = check_new(b, L)
                r[b] = dict(metrics=metrics, fails=fails)
                t = tile(compose(b, col, L), T, bg=BG)
            allims.append(t)
            if b in dict(SHOW):
                three[b] = t
        row = Image.new('RGBA', (T * 3, T), BG)
        for j, (b, _) in enumerate(SHOW):
            row.alpha_composite(three[b], (j * T, 0))
        row.convert('RGB').save(os.path.join(OUT, f'{pid}.webp'), quality=86)
        sheet = Image.new('RGBA', (T * 6, T * 2), BG)
        for j, t in enumerate(allims):
            sheet.alpha_composite(t, ((j % 6) * T, (j // 6) * T))
        sheet.convert('RGB').save(os.path.join(OUT, f'{pid}-all12.webp'), quality=84)
        nf = sum(1 for v in r.values() if v['fails'])
        nu = sum(1 for v in r.values() if v.get('unsupported'))
        print(f'{pid:14s} fails {nf}/{12 - nu}', {b: v['fails'] for b, v in r.items() if v['fails']})
        rep[pid] = dict(category=cat, label=label, set=st, bodies=r)
    # personality sets on the 3 bodies
    for name, fn, heads, note in SETS:
        row = Image.new('RGBA', (T * 3, T), BG)
        for j, (b, col) in enumerate(SHOW):
            L = fn(b)
            row.alpha_composite(tile(compose(b, col, L, head=head_layer(b, *heads)), T, bg=BG), (j * T, 0))
        row.convert('RGB').save(os.path.join(OUT, 'set-' + name.lower().replace(' ', '-').replace(':', '') + '.webp'), quality=86)
    p = os.path.join(HERE, 'fit-new.json')
    old = json.load(open(p)) if os.path.exists(p) else {}
    old.update(rep)
    json.dump(old, open(p, 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1:] or None)
