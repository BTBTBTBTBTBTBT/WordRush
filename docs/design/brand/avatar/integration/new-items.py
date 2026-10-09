#!/usr/bin/env python3
"""Ingest the 2.8 item packs (FRIDAY-QUEUE 5b / 51) from integration/new-items-spec.json.

  python3 integration/new-items.py [--packs goth,emo]     (default: every pack in the spec)

For each spec entry (hires/<piece>.png wins over out/<piece>.png in docs/design/brand/2.8/items/<pack>/):
  1. trims the art (keyed-cyan fringe despilled) to <= 384 px wide, writes parts/art-av-acc-<id>.png + new/pieces/<id>.png
     (what the rule builders load) and ships the tile art art-av-acc-<id> ×3 (web webp, Android drawable, iOS imageset)
  2. adds items['acc:<id>'] to the three avatar-parts.json (w / anchor / slot / layer from the spec, aspect measured,
     `pro` flag, `pack`), + the art name, + apps/web/lib/art.ts ART_SIZE
  3. inserts the id into the field's option list ×3 (TS core, Swift, Kotlin) right AFTER its `near` id: new items sit
     beside their like items in the tab (wings with wings, caps with caps), never appended at the end
Then: python3 integration/ship-rules.py --only <keys> (the rule + guards per body; withheld where no room), the access
table (access/make-access-table.py), dump-pose-layouts + gen-parity-fixtures, and the tests.
"""
import importlib.util, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, AV)
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

ITEMS = os.path.join(REPO, 'docs', 'design', 'brand', '2.8', 'items')
PARTS = os.path.join(AV, 'parts')
NEWP = os.path.join(AV, 'new', 'pieces')
MANIFESTS = [os.path.join(REPO, p) for p in ('packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
                                             'apps/android/app/src/main/assets/avatar-parts.json')]
ART_TS = os.path.join(REPO, 'apps/web/lib/art.ts')
TS_CFG = os.path.join(REPO, 'packages/core/src/avatar-config.ts')
SWIFT_CFG = os.path.join(REPO, 'apps/ios/Sources/Core/AvatarConfig.swift')
KT_CFG = os.path.join(REPO, 'apps/android/core/src/main/kotlin/com/wordocious/core/AvatarConfig.kt')
LISTS = {  # field -> (TS const, Swift let, Kotlin val)
    'head': ('AVATAR_HEADS', 'heads', 'HEADS'), 'face': ('AVATAR_FACES', 'faces', 'FACES'), 'neck': ('AVATAR_NECKS', 'necks', 'NECKS'),
    'held': ('AVATAR_HELD', 'held', 'HELD'), 'wrap': ('AVATAR_WRAPS', 'wraps', 'WRAPS'), 'feet': ('AVATAR_FEET', 'feet', 'FEET'),
    'pet': ('AVATAR_PETS', 'pets', 'PETS'), 'extra': ('AVATAR_EXTRAS', 'extras', 'EXTRAS'),
}
MAX_W = 384
IOS_SETS = os.path.join(REPO, 'apps/ios/Wordocious/Resources/Assets.xcassets')


def _si():
    spec = importlib.util.spec_from_file_location('ship_integrated', os.path.join(HERE, 'ship-integrated.py'))
    mod = importlib.util.module_from_spec(spec)
    sys.modules['ship_integrated'] = mod
    spec.loader.exec_module(mod)
    return mod


def source_art(pack, piece):
    for sub in ('hires', 'out'):
        p = os.path.join(ITEMS, pack, sub, piece + '.png')
        if os.path.exists(p):
            return p, sub
    raise FileNotFoundError(f'{pack}/{piece}')


def prepare(path, si):
    im = Image.open(path).convert('RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(box)
    try:
        im = si.despill(im)       # the cyan key's fringe
    except Exception:             # noqa: BLE001
        pass
    if im.width > MAX_W:
        im = im.resize((MAX_W, max(1, round(im.height * MAX_W / im.width))), Image.LANCZOS)
    return im


def insert_after(text, decl, near, new, quote):
    """Insert `new` after `near` inside the first list that follows `decl` (or at its end)."""
    i = text.index(decl)
    close = {'"': ']', "'": ']'}[quote] if 'listOf(' not in text[i:i + 200] else ')'
    j = text.index(close, i + len(decl))
    block = text[i:j]
    if f'{quote}{new}{quote}' in block:
        return text
    tok = f'{quote}{near}{quote}'
    if tok in block:
        block = block.replace(tok, f'{tok}, {quote}{new}{quote}', 1)
    else:
        block = block.rstrip() + f', {quote}{new}{quote}'
    return text[:i] + block + text[j:]


def prune(spec, packs):
    """Remove every shipped item of the given packs that is no longer in the spec (a piece withheld after a look)."""
    import shutil
    keep = {'acc:' + s['id'] for s in spec['items']}
    gone = set()
    for p in MANIFESTS:
        d = json.load(open(p))
        for key in [k for k, it in d['items'].items() if it.get('pack') in packs and k not in keep]:
            gone.add(key)
            del d['items'][key]
            pre = 'art-av-' + key.replace(':', '-')
            d['art'] = [a for a in d['art'] if not (a == pre or a.startswith(pre + '-'))]
            for b in d['bodies'].values():
                (b.get('overrides') or {}).pop(key, None)
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    ts, sw, kt = open(TS_CFG).read(), open(SWIFT_CFG).read(), open(KT_CFG).read()
    art = open(ART_TS).read()
    for key in gone:
        pid = key.split(':')[1]
        ts = re.sub(rf"'{re.escape(pid)}', ?", '', ts)
        sw = re.sub(rf'"{re.escape(pid)}", ?', '', sw)
        kt = re.sub(rf'"{re.escape(pid)}", ?', '', kt)
        art = re.sub(rf"  'art-av-acc-{re.escape(pid)}[^']*': \[[0-9]+, [0-9]+\],\n", '', art)
        web = os.path.join(REPO, 'apps/web/public/art')
        for f in os.listdir(web):
            if f.startswith(f'art-av-acc-{pid}-') or f == f'art-av-acc-{pid}.webp':
                os.remove(os.path.join(web, f))
                dr = os.path.join(REPO, 'apps/android/app/src/main/res/drawable-nodpi', f.replace('-', '_'))
                if os.path.exists(dr):
                    os.remove(dr)
                shutil.rmtree(os.path.join(IOS_SETS, f[:-5] + '.imageset'), ignore_errors=True)
    open(TS_CFG, 'w').write(ts); open(SWIFT_CFG, 'w').write(sw); open(KT_CFG, 'w').write(kt); open(ART_TS, 'w').write(art)
    print('pruned', sorted(gone))


def main():
    args = sys.argv[1:]
    packs = args[args.index('--packs') + 1].split(',') if '--packs' in args else None
    spec = json.load(open(os.path.join(HERE, 'new-items-spec.json')))
    todo = [s for s in spec['items'] if not packs or s['pack'] in packs]
    prune(spec, packs or sorted({s['pack'] for s in spec['items']}))
    si = _si()
    os.makedirs(NEWP, exist_ok=True)
    sizes = {}
    for s in todo:
        path, sub = source_art(s['pack'], s['piece'])
        im = prepare(path, si)
        name = f"art-av-acc-{s['id']}"
        im.save(os.path.join(PARTS, name + '.png'))
        im.save(os.path.join(NEWP, s['id'] + '.png'))
        si.save_art(name, im)
        sizes[name] = [im.width, im.height]
        s['_aspect'] = round(im.height / im.width, 4)
        print(f"{s['id']:24s} {sub:5s} {im.width}x{im.height}")
    for p in MANIFESTS:
        d = json.load(open(p))
        for s in todo:
            m = dict(s['manifest'])
            m['aspect'] = m['aspect'] if m.get('aspect') else s['_aspect']
            if s['kind'] in ('held', 'shoes', 'buddy'):
                m['aspect'] = 1                      # per-body pieces ship their own art; the base entry is a placeholder
            m['pro'] = bool(s['pro'])
            m['pack'] = s['pack']
            old = d['items'].get('acc:' + s['id'], {})
            keep = {k: v for k, v in old.items() if k in ('pieces', 'perBody')}
            d['items']['acc:' + s['id']] = {**m, **keep}
        d['art'] = sorted(set(d['art']) | {f"art-av-acc-{s['id']}" for s in todo})
        d['collections'] = spec.get('collections', {})
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    # lib/art.ts ART_SIZE
    src = open(ART_TS).read()
    for name, (w, h) in sizes.items():
        line = f"  '{name}': [{w}, {h}],\n"
        if f"'{name}'" in src:
            src = re.sub(rf"  '{re.escape(name)}': \[[0-9]+, [0-9]+\],\n", line, src)
            continue
        keys = [(m.start(), m.group(1)) for m in re.finditer(r"  '(art-av-acc-[^']+)': \[", src)]
        pos = next((p for p, k in keys if k > name), None)
        src = src[:pos] + line + src[pos:] if pos is not None else src.replace("  'art-av-body-bean'", line + "  'art-av-body-bean'", 1)
    open(ART_TS, 'w').write(src)
    # option lists ×3
    ts, sw, kt = open(TS_CFG).read(), open(SWIFT_CFG).read(), open(KT_CFG).read()
    for s in todo:
        t, w_, k_ = LISTS[s['field']]
        ts = insert_after(ts, f'export const {t} = [', s['near'], s['id'], "'")
        sw = insert_after(sw, f'public static let {w_} = [', s['near'], s['id'], '"')
        kt = insert_after(kt, f'val {k_}: List<String> = listOf(', s['near'], s['id'], '"')
    open(TS_CFG, 'w').write(ts); open(SWIFT_CFG, 'w').write(sw); open(KT_CFG, 'w').write(kt)
    print('keys:', ','.join('acc:' + s['id'] for s in todo))


if __name__ == '__main__':
    main()
