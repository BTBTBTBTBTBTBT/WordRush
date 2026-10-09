#!/usr/bin/env python3
"""Today's shipped fit next to the rule-based fit (rules.py), every item × the 12 bodies, + the guards on both.

  python3 integration/compare.py   → out/landmarks/compare-<n>.jpg (per item: 12 × [shipped | rule], red frame = a guard
                                     fails), out/landmarks/compare.json (per item × body: guard failures, overlap IoU)

Each pair: LEFT = shipped today, RIGHT = rule. A grey "—" = not drawn on that body (no room / fit check withheld it).
"""
import io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402
import fits  # noqa: E402
from rig import MAN  # noqa: E402

OUT = os.path.join(HERE, 'out', 'landmarks')
T = 92
LETTERS = 'AWMRSOBKEQZH'
GROUPS = [('hats', lambda k, r: r['kind'] == 'hat'),
          ('face + brows + extras', lambda k, r: r['kind'] in ('face', 'brows', 'extra')),
          ('neck + wraps + waist', lambda k, r: r['kind'] in ('pendant', 'necklace', 'drape', 'belt', 'apron')),
          ('back: capes, wings, packs, tails', lambda k, r: r['kind'] in ('cape', 'wings', 'backpack', 'tail')),
          ('held', lambda k, r: r['kind'] == 'held'),
          ('feet + buddies', lambda k, r: r['kind'] in ('shoes', 'buddy'))]


def _png(im):
    b = io.BytesIO()
    im.convert('RGB').save(b, 'PNG')
    return b.getvalue()


def _alpha(layers):
    from rig import CW
    m = np.zeros((CW, CW), bool)
    for im in layers.values():
        m |= np.asarray(im.getchannel('A')) > 90
    return m


def worker(args):
    body, j, layouts = args
    import rules
    import audit
    import landmarks as LM
    lms = rules.setup()
    lm = LM.measure(body)
    res = {}
    for key, r in rules.RULES.items():
        pid = key.split(':')[1]
        sh = fits.shipped(key, body, layouts)
        try:
            ro = rules.render(key, body)
        except Exception as e:  # noqa: BLE001
            ro = dict(layers={}, fails=[f'error {e!r}'], unsupported=None, rect=None)
        rl = ro['layers'] if not ro['fails'] and not ro['unsupported'] else {}
        g_sh = audit.guard(key, body, sh, r['kind'], lm, r['params']) if sh else None
        g_rl = audit.guard(key, body, rl, r['kind'], lm, r['params']) if rl else None
        a, b = _alpha(sh) if sh else None, _alpha(rl) if rl else None
        iou = float((a & b).sum() / max(1, (a | b).sum())) if a is not None and b is not None else None
        col = fits.COLS[j % len(fits.COLS)]
        lt = LETTERS[j % len(LETTERS)]
        tiles = []
        for lay, g in ((sh, g_sh), (rl, g_rl)):
            if lay:
                tiles.append(_png(fits.fixed_tile(fits.compose(body, col, lay, pid, lt), body, T, bool(g), lms)))
            else:
                tiles.append(_png(fits.blank(T)))
        res[key] = dict(shipped=dict(drawn=bool(sh), guards=g_sh), rule=dict(drawn=bool(rl), guards=g_rl,
                        withheld=ro['unsupported'] or ro['fails'] or None), iou=None if iou is None else round(iou, 3),
                        tiles=tiles)
    return body, res


# The call per item after LOOKING at the side-by-side sheets (compare-*.jpg, 10-06). Default for a kind, then items.
VERDICT_KIND = {
    'hat': ('equal', 'same seat on the head-top curve; within ~10% of today\'s size (a touch bigger on box heads)'),
    'face': ('equal', 'identical: the face anchors ARE the body\'s face'),
    'brows': ('equal', 'identical (eye boxes)'),
    'extra': ('equal', 'identical (eye boxes)'),
    'held': ('equal', 'same grip; on wide ~20% smaller (its measured mitten is narrower than the hand fit)'),
    'shoes': ('equal', 'same; shoe height now from the visible foot (crotch → floor)'),
    'buddy': ('equal', 'same spots; scaled by √(body height), so mini\'s pets are a little smaller'),
    'drape': ('equal', 'same drape; withheld where it would cover the app-size letter (wide; cloud for scarf/bandana) — '
                       'today\'s covers the letter there'),
    'cape': ('equal', 'same cape; on wide (vampire collar: wide + cloud) the front cord + clasp are dropped: no room '
                      'between the mouth and the letter'),
    'wings': ('equal', 'same; a little bigger on the narrow bodies (0.95 min width) — reads fine'),
}
VERDICT_ITEM = {
    'acc:headphones': ('better', 'cups clamp the head above the eyes; today\'s cups cover the eyes on 7 bodies'),
    'acc:bowtie': ('worse → override', 'no room for a readable bow tie between the mouth and the letter on 10 bodies: '
                   'the rule tucks it under the letter (it disappears). Today\'s fit is kept (rules.OVERRIDES); it still '
                   'overlaps the mouth + letter — needs flatter art'),
    'acc:medal': ('better', 'today\'s ribbon covers the mouth on every body; the rule hangs a smaller medal off the '
                  'face + letter (slides beside the letter on drop/pear), withheld on wide + cloud'),
    'acc:chain': ('better', 'same drape; withheld on wide, mini (as today) and cloud (today\'s covers the letter there)'),
    'acc:apron': ('better', 'torso-wide (not arm-to-arm): no longer over the arms on classic/bean/chunky; neck strap on '
                  'the drape; withheld on wide + cloud (no room)'),
    'acc:belt': ('equal', 'same waist line; star\'s belt drops under the letter (no room above the legs)'),
    'acc:backpack': ('equal', 'same pack + straps (from measured hands)'),
    'acc:batwings': ('equal', 'identical rule (it was already measured)'),
    'acc:cattail': ('equal', 'same tail; its base now anchors inside the torso edge above the measured hip line'),
}


def final_verdict(key, kind):
    return VERDICT_ITEM.get(key) or VERDICT_KIND.get(kind) or ('equal', '')


def table(report):
    """The item-by-item markdown table for REPORT-LANDMARKS.md."""
    rows = ['| item | rule | verdict | guard fails today → rule (of 12) | withheld by the rule | note |',
            '|---|---|---|---|---|---|']
    for key, v in report.items():
        per = v['bodies']
        sh = sum(1 for e in per.values() if e['shipped']['guards'])
        rl = sum(1 for e in per.values() if e['rule']['guards'])
        wh = [b for b, e in per.items() if e['rule']['withheld']]
        verdict, note = final_verdict(key, v['kind'])
        if verdict == 'equal' and rl < sh:
            verdict = 'better'
            note = f'looks the same, but no longer covers the face / letter / arms on {sh - rl} bodies; ' + note
        rows.append(f"| {key.split(':')[1] if key.startswith('acc:') else key} | {v['kind']} | {verdict} | {sh} → {rl} | "
                    f"{', '.join(wh) or '—'} | {note} |")
    return '\n'.join(rows)


def verdict(key, per):
    """First pass (the sheets are then looked at; REPORT-LANDMARKS.md has the final call per item)."""
    sh_f = sum(1 for v in per.values() if v['shipped']['guards'])
    rl_f = sum(1 for v in per.values() if v['rule']['guards'])
    sh_n = sum(1 for v in per.values() if v['shipped']['drawn'])
    rl_n = sum(1 for v in per.values() if v['rule']['drawn'])
    ious = [v['iou'] for v in per.values() if v['iou'] is not None]
    miou = float(np.mean(ious)) if ious else 0
    if rl_f < sh_f or (rl_n > sh_n and rl_f <= sh_f):
        return 'better', miou
    if rl_f > sh_f or rl_n < sh_n:
        return 'worse', miou
    return ('equal' if miou >= 0.8 else 'differs'), miou


def main():
    from concurrent.futures import ProcessPoolExecutor
    import rules
    bodies = list(json.load(open(os.path.join(HERE, 'landmarks.json')))['bodies'])
    layouts = fits.shipped_layouts(bodies)
    allres = {}
    with ProcessPoolExecutor(max_workers=int(os.environ.get('AV_WORKERS', '1'))) as ex:
        for body, res in ex.map(worker, [(b, j, layouts) for j, b in enumerate(bodies)]):
            allres[body] = res
            print(body, 'done', flush=True)
    keys = list(rules.RULES)
    report = {}
    for key in keys:
        per = {b: {k: v for k, v in allres[b][key].items() if k != 'tiles'} for b in bodies}
        v, miou = verdict(key, per)
        report[key] = dict(kind=rules.RULES[key]['kind'], auto=v, meanIoU=round(miou, 3), bodies=per)
    json.dump(report, open(os.path.join(OUT, 'compare.json'), 'w'), indent=1)
    # sheets: per group, ≤ 12 items per sheet
    n = 0
    LW = 150
    PW = 2 * T + 8
    f, fs = fits.font(14), fits.font(11, bold=False)
    for gname, pred in GROUPS:
        gkeys = [k for k in keys if pred(k, rules.RULES[k])]
        for s in range(0, len(gkeys), 12):
            chunk = gkeys[s:s + 12]
            n += 1
            sheet = Image.new('RGB', (LW + PW * len(bodies), 34 + len(chunk) * (T + 6)), (255, 255, 255))
            d = ImageDraw.Draw(sheet)
            d.text((6, 8), f'{gname} — each pair: LEFT shipped today | RIGHT rule-based · red frame = a guard fails · '
                           f'— = not drawn', font=fs, fill=(40, 30, 60))
            for j, b in enumerate(bodies):
                d.text((LW + j * PW + PW / 2, 26), b, font=fs, fill=(40, 30, 60), anchor='mm')
            for r_, key in enumerate(chunk):
                y = 34 + r_ * (T + 6)
                d.text((6, y + T / 2 - 16), key.split(':')[1] if key.startswith('acc:') else key, font=f, fill=(40, 20, 60))
                d.text((6, y + T / 2 + 4), f"{report[key]['auto']} · IoU {report[key]['meanIoU']:.2f}", font=fs, fill=(90, 80, 110))
                for j, b in enumerate(bodies):
                    t0, t1 = allres[b][key]['tiles']
                    sheet.paste(Image.open(io.BytesIO(t0)), (LW + j * PW, y))
                    sheet.paste(Image.open(io.BytesIO(t1)), (LW + j * PW + T + 2, y))
            p = os.path.join(OUT, f'compare-{n:02d}.jpg')
            sheet.save(p, quality=84)
            print(p, chunk)
    from collections import Counter
    print(Counter(v['auto'] for v in report.values()))


if __name__ == '__main__':
    if '--table' in sys.argv:
        print(table(json.load(open(os.path.join(OUT, 'compare.json')))))
    else:
        main()
