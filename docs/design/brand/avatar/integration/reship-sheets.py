#!/usr/bin/env python3
"""BEFORE vs AFTER contact sheets of the rule-based re-ship (ship-rules.py), + the landmark guards on the AFTER set.

  BEFORE  the art + manifest of <commit> (default 0d560b2: the 10-05 hand fits as shipped) and that commit's core layouts
  AFTER   the working tree (apps/web/public/art + packages/core avatar-parts.json), laid out by the CURRENT core
          (avatar-layout.ts through dump-layout.ts: the per-body overrides, layer + withheld included)

  python3 integration/reship-sheets.py [commit]   → out/reship/reship-01…NN.jpg (each pair: LEFT before | RIGHT after,
                                                     red frame = a guard fails, — = not drawn), out/reship/guards.json
The letter on the tiles is the one the apps draw (rig.LETTER_MODE = 'app').
"""
import io, json, os, subprocess, sys, tarfile, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from PIL import Image, ImageDraw  # noqa: E402
import landmarks as LM  # noqa: E402  (app letter)
import fits  # noqa: E402
from rig import MAN, REPO  # noqa: E402

OUT = os.path.join(HERE, 'out', 'reship')
T = 92
LETTERS = 'AWMRSOBKEQZH'
GROUPS = [('hats', lambda k, r: r['kind'] == 'hat'),
          ('face + brows + extras', lambda k, r: r['kind'] in ('face', 'brows', 'extra')),
          ('neck + wraps + waist', lambda k, r: r['kind'] in ('pendant', 'necklace', 'drape', 'belt', 'apron')),
          ('back: capes, wings, packs, tails', lambda k, r: r['kind'] in ('cape', 'wings', 'backpack', 'tail')),
          ('held', lambda k, r: r['kind'] == 'held'),
          ('feet + buddies', lambda k, r: r['kind'] in ('shoes', 'buddy'))]


def before_tree(commit):
    tmp = tempfile.mkdtemp()
    raw = subprocess.run(['git', 'archive', commit, 'apps/web/public/art', 'packages/core/src/avatar-parts.json'],
                         capture_output=True, check=True, cwd=REPO).stdout
    tarfile.open(fileobj=io.BytesIO(raw)).extractall(tmp, filter='data')
    return os.path.join(tmp, 'apps/web/public/art'), json.load(open(os.path.join(tmp, 'packages/core/src/avatar-parts.json')))


def worker(args):
    body, j, before, after = args
    import rules
    import audit
    rules.setup()
    lm = LM.measure(body)
    (b_art, b_man, b_lay), (a_art, a_man, a_lay) = before, after
    res = {}
    for key, r in rules.RULES.items():
        pid = key.split(':')[1]
        tiles, guards = [], []
        for art, man, lay in ((b_art, b_man, b_lay), (a_art, a_man, a_lay)):
            layers = fits.shipped(key, body, lay, art=art, manifest=man)
            g = audit.guard(key, body, layers, r['kind'], lm, r['params']) if layers else None
            guards.append(g)
            if layers:
                im = fits.compose(body, fits.COLS[j], layers, pid, LETTERS[j])
                t = fits.fixed_tile(im, body, T, bool(g), {body: rules.LMS[body]})
            else:
                t = fits.blank(T)
            b = io.BytesIO()
            t.convert('RGB').save(b, 'PNG')
            tiles.append(b.getvalue())
        res[key] = dict(tiles=tiles, before=guards[0], after=guards[1])
    return body, res


def main(commit='0d560b2'):
    from concurrent.futures import ProcessPoolExecutor
    import rules
    os.makedirs(OUT, exist_ok=True)
    bodies = [b for b in MAN['bodies'] if '@' not in b]
    b_art, b_man = before_tree(commit)
    b_lay = json.load(open(os.path.join(OUT, '_cache', 'before-layouts.json')))
    fits.LAYOUT_CACHE = os.path.join(OUT, '_cache', 'after-layouts.json')
    if os.path.exists(fits.LAYOUT_CACHE):
        os.remove(fits.LAYOUT_CACHE)
    a_lay = fits.shipped_layouts(bodies)
    a_man = json.load(open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')))
    args = [(b, j, (b_art, b_man, b_lay), (fits.ART, a_man, a_lay)) for j, b in enumerate(bodies)]
    allres = {}
    with ProcessPoolExecutor(max_workers=4) as ex:
        for body, res in ex.map(worker, args):
            allres[body] = res
            print(body, 'after guard fails', {k: [c for c, _ in v['after']] for k, v in res.items() if v['after']}, flush=True)
    keys = list(rules.RULES)
    json.dump({k: {b: dict(before=allres[b][k]['before'], after=allres[b][k]['after']) for b in bodies} for k in keys},
              open(os.path.join(OUT, 'guards.json'), 'w'), indent=0)
    LW, PW = 150, 2 * T + 8
    f, fs = fits.font(14), fits.font(11, bold=False)
    n = 0
    for gname, pred in GROUPS:
        gkeys = [k for k in keys if pred(k, rules.RULES[k])]
        for s in range(0, len(gkeys), 13):
            chunk = gkeys[s:s + 13]
            n += 1
            sheet = Image.new('RGB', (LW + PW * len(bodies), 34 + len(chunk) * (T + 6)), (255, 255, 255))
            d = ImageDraw.Draw(sheet)
            d.text((6, 8), f'{gname} — each pair: LEFT before (10-05 hand fit) | RIGHT after (rule-based re-ship) · red frame = '
                           f'a guard fails · — = not drawn (withheld)', font=fs, fill=(40, 30, 60))
            for j, b in enumerate(bodies):
                d.text((LW + j * PW + PW / 2, 26), b, font=fs, fill=(40, 30, 60), anchor='mm')
            for r_, key in enumerate(chunk):
                y = 34 + r_ * (T + 6)
                d.text((6, y + T / 2 - 8), key.split(':')[1] if key.startswith('acc:') else key, font=f, fill=(40, 20, 60))
                for j, b in enumerate(bodies):
                    t0, t1 = allres[b][key]['tiles']
                    sheet.paste(Image.open(io.BytesIO(t0)), (LW + j * PW, y))
                    sheet.paste(Image.open(io.BytesIO(t1)), (LW + j * PW + T + 2, y))
            sheet.save(os.path.join(OUT, f'reship-{n:02d}.jpg'), quality=84)
    nb = sum(1 for k in keys for b in bodies if allres[b][k]['before'])
    na = sum(1 for k in keys for b in bodies if allres[b][k]['after'])
    print(f'guard failures: before {nb}, after {na}')


if __name__ == '__main__':
    main(*sys.argv[1:])
