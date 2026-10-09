#!/usr/bin/env python3
"""Re-ship today's mascot items through the RULE-BASED fit (step 1 of "What it would take to ship" in
REPORT-LANDMARKS.md; 10-06). Uses the existing ship machinery (ship-integrated.py: ship_layers → contact shadows, AO,
hand-over; save_art → web public/art + Android drawable-nodpi + iOS image sets; write_web_sizes → art-av-pieces.ts)
with the rule renderer (rules.render) on the MEASURED landmarks, and the guards on the letter the apps actually draw
(rig.LETTER_MODE = 'app', set by landmarks.py).

  per-body items (pieces)   re-rendered per body; a body the rule withholds (no room) is dropped from `pieces`
                            (the core draws nothing there) and its old layer art is deleted ×3. The scarf moves from
                            its one-layer `perBody` art to `pieces` like every other wrap.
  one-art items             hats, face items, wings, the medal: the rule's rect becomes bodies.<id>.overrides[key]
                            {dx, dy, scale} relative to the core anchor placement (no new art); `layer: 'under'` where
                            the medal / bow tie would overlap the letter or the face; `withheld: true` where the rule
                            has no room (the medal on wide + cloud)
  bow tie                   today's hand fit (rules.OVERRIDES) — only its layer changes ('under' where it overlaps)

  python3 docs/design/brand/avatar/integration/ship-rules.py      → manifests ×3, art ×3, ship-integrated-sizes.json,
                                                                     apps/web/lib/art-av-pieces.ts, fit-reship.json
"""
import json, os, shutil, sys
from concurrent.futures import ProcessPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
import rules  # noqa: E402
from rig import U, M, MAN, REPO  # noqa: E402

PARTS = os.path.join(os.path.dirname(HERE), 'parts')
# `--only acc:backpack,acc:bow` (env SHIP_ONLY for the pool workers) re-ships just those items; `--bodies a,b` just those
# bodies. Everything else in the manifests / art stays exactly as shipped.
for _i, _a in enumerate(sys.argv):
    if _a == '--only':
        os.environ['SHIP_ONLY'] = sys.argv[_i + 1]
    if _a == '--bodies':
        os.environ['SHIP_BODIES'] = sys.argv[_i + 1]
ONLY = [k for k in os.environ.get('SHIP_ONLY', '').split(',') if k]
ONLY_BODIES = [b for b in os.environ.get('SHIP_BODIES', '').split(',') if b]
OVERLAP = 0.01        # a pendant goes 'under' when it covers more than this of the letter or the face


def _worker(body):
    rules.setup()
    SI = rules.SI
    import landmarks as LM
    lm = LM.measure(body)
    face, letter = lm['_']['face'], lm['_']['letter']
    out = {}
    for key, r in rules.RULES.items():
        if ONLY and key not in ONLY:
            continue
        o = rules.render(key, body)
        ent = dict(kind=r['kind'])
        if r['kind'] in rules.ANCHORED and not r['params'].get('pieces'):
            if o['unsupported']:
                ent['withheld'] = o['unsupported']
            else:
                (layer, rect), = o['rect'].items()
                if key in rules.OVERRIDES:      # today's fit kept: only its layer may change
                    a = np.asarray(o['layers'][layer].getchannel('A')) > 90
                    cover = max((a & letter).sum() / max(1, letter.sum()), (a & face).sum() / max(1, face.sum()))
                    if cover > OVERLAP:
                        layer = 'under'
                ent.update(rect=rect, layer=layer)
        elif o['unsupported'] or o['fails'] or not o['layers']:
            ent['withheld'] = o['unsupported'] or o['fails'] or 'nothing drawn'
        else:
            rows, arts = rules.crop_pieces(o['layers'])
            kind, pid = key.split(':')
            names = {}
            for layer, im in arts.items():
                name = SI.art_name(kind, pid, body, layer)
                SI.save_art(name, im)
                names[name] = list(im.size)
            ent.update(pieces=rows, art=names)
        out[key] = ent
    return body, out


def core_rect(key, body):
    """The core layout's placement WITHOUT a per-body override (avatar-layout.ts)."""
    m = MAN['items'][key]
    b = MAN['bodies'][body]
    import rig
    x, y, base = rig.slot_point(b, m['slot'])
    w = base * m['w']
    h = w * m['aspect']
    return x, y, w, h, m['anchor']


def override_for(key, body, rect):
    x, y, w0, h0, (ax, ay) = core_rect(key, body)
    rx, ry, rw, rh = rect
    s = rw / w0
    w, h = w0 * s, h0 * s
    o = dict(dx=round(rx - (x - ax * w), 4), dy=round(ry - (y - ay * h), 4), scale=round(s, 4))
    # below these it is rounding noise (rects are rounded to 1e-4): no override
    return {k: v for k, v in o.items() if (abs(v - 1) > 2e-3 if k == 'scale' else abs(v) > 6e-4)}


def delete_art(name):
    for p in (os.path.join(SI_WEB, name + '.webp'), os.path.join(SI_DROID, name.replace('-', '_') + '.webp')):
        if os.path.exists(p):
            os.remove(p)
    d = os.path.join(SI_IOS, name + '.imageset')
    if os.path.isdir(d):
        shutil.rmtree(d)


def main():
    global SI_WEB, SI_DROID, SI_IOS
    rules.setup()
    SI = rules.SI
    SI_WEB, SI_DROID, SI_IOS = SI.WEB, SI.DROID, SI.IOS
    bodies = [b for b in MAN['bodies'] if '@' not in b and (not ONLY_BODIES or b in ONLY_BODIES)]
    res = {}
    with ProcessPoolExecutor(max_workers=4) as ex:
        for body, out in ex.map(_worker, bodies):
            res[body] = out
            print(body, 'withheld', sorted(k for k, v in out.items() if v.get('withheld')), flush=True)
    sp = os.path.join(HERE, 'ship-integrated-sizes.json')
    sizes = json.load(open(sp))
    report, new_art, stale = {}, {}, set()
    for p in SI.MANIFESTS:
        d = json.load(open(p))
        for key in rules.RULES:
            if ONLY and key not in ONLY:
                continue
            it = d['items'][key]
            kind, pid = key.split(':')
            per = {b: res[b][key] for b in bodies}
            r = rules.RULES[key]
            if r['kind'] in rules.ANCHORED and not r['params'].get('pieces'):
                for b, e in per.items():
                    ov = d['bodies'][b].setdefault('overrides', {})
                    ov.pop(key, None)
                    if e.get('withheld'):
                        ov[key] = {'withheld': True}
                    else:
                        o = {} if key in rules.OVERRIDES else override_for(key, b, e['rect'])
                        if e['layer'] != it['layer']:
                            o['layer'] = e['layer']
                        if o:
                            ov[key] = o
                report[key] = {b: ({'withheld': e['withheld']} if e.get('withheld') else
                                   {'override': d['bodies'][b]['overrides'].get(key, {})}) for b, e in per.items()}
                continue
            # per-body pieces
            old = set()
            for b, rows in (it.get('pieces') or {}).items():
                if not ONLY_BODIES or b in ONLY_BODIES:
                    old |= {SI.art_name(kind, pid, b, r[0]) for r in rows}
            for b in (it.get('perBody') or {}):
                if not ONLY_BODIES or b in ONLY_BODIES:
                    old.add(f'art-av-{kind}-{pid}-{b}')
            if not ONLY_BODIES:
                it.pop('perBody', None)
                it['pieces'] = {b: e['pieces'] for b, e in per.items() if e.get('pieces')}
            else:       # --bodies: merge into the existing pieces, leave every other body exactly as shipped
                merged = dict(it.get('pieces') or {})
                for b, e in per.items():
                    if e.get('pieces'):
                        merged[b] = e['pieces']
                    else:
                        merged.pop(b, None)
                it['pieces'] = merged
            now = {n for e in per.values() for n in (e.get('art') or {})}
            stale |= old - now
            for e in per.values():
                new_art.update(e.get('art') or {})
            report[key] = {b: ({'withheld': e['withheld']} if e.get('withheld') else {'pieces': e['pieces']}) for b, e in per.items()}
        # hand overrides of items that now ship per body (`pieces` ignore anchors): dead data, removed
        for b in bodies:
            ov = d['bodies'][b].get('overrides') or {}
            for k in [k for k in ov if k in d['items'] and d['items'][k].get('pieces')]:
                del ov[k]
        d['art'] = sorted((set(d['art']) - stale) | set(new_art))
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    for name in sorted(stale):
        delete_art(name)
        sizes.pop(name, None)
    sizes.update(new_art)
    with open(sp, 'w') as f:
        json.dump(dict(sorted(sizes.items())), f, indent=0)
    SI.write_web_sizes(sizes)
    json.dump(dict(note='ship-rules.py (10-06): the shipped rule-based fit per item × body (withheld = no room).',
                   stale_removed=sorted(stale), items=report), open(os.path.join(HERE, 'fit-reship.json'), 'w'), indent=1)
    print('art written', len(new_art), 'stale removed', len(stale))


if __name__ == '__main__':
    main()
