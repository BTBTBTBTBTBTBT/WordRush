#!/usr/bin/env python3
"""Ship the integrated mascot-maker parts (founder 10-05: "make sure the new items … are inclusive in the new build
so long as they don't look bolted on"). Builds every rebuilt + new part with the integration rig on all 12 bodies,
fit-checks it, and ships it as PER-BODY LAYER ART:

    art-av-<kind>-<id>-<body>-<layer>.{webp,png}  at [x, y, w, h] body units
    → avatar-parts.json items[key].pieces[body] = [[layer, x, y, w, h], …]   (core avatarLayout draws them)

Everything the INTEGRATION.md rules need is baked into the per-body layers, so every renderer only draws rects:
  back    the bulk behind the body, clipped OUTSIDE the silhouette, ambient-occluded
  under   garments the letter sits on (apron, sash, belt on short bodies) + their contact shadow
  wrap    straps / scarves / cords / collars ON the body + their contact shadow (never over the face or letter)
  held    the held item + its contact shadow; the body's own hand shows through (the item is cut away inside the
          hand ellipse, which is exactly the hand-over layer: the fist covers the handle, straps tuck under arms)
  feet / pet / extra / brows   shoes over the feet, companions, face extras, code-drawn brows
Also writes the per-body anchors (hands, shoulder line, wrap line, floor) into bodies.<id>, the tile icons
(art-av-acc-<id>, art-av-brows-<id>), eyes inkTop (brows clear tall eyes), and bumps the manifest to v3.

  python3 docs/design/brand/avatar/integration/ship-integrated.py [ids…]
Dropped (visual review 10-05, contact sheets via contact-integrated.py):
  tie   the letter fills the belly, so the blade can only hide behind it (a knot) or swing sideways (a 2nd bow tie)
  sash  the face guard pushes it down to the letter band on every body: a short pink stripe across the letter
Fixed: sneakers (whole upper + laces, squashed to the stubby foot, not white soles), boots (wider: no foot peeks
out), shoe keying fringe removed, sleepy brows (relaxed + droopy instead of slanting in like angry brows).

10-06: the per-body layer art + overrides of every item now come from ship-rules.py (the rule-based fit on the measured
landmarks, the app-size letter guard). Re-running this script's item builders would put the 10-05 hand fits back;
see REPORT-RESHIP.md. It still owns what ship-rules.py does not touch (tile icons, tags, eyes inkTop, body anchors).
"""
import json, os, sys
from concurrent.futures import ProcessPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from scipy import ndimage  # noqa: E402
from rig import (U, M, CW, MAN, REPO, rig, alpha, back_ao, contact_shadow, mask_out, place_part, draw_letter, trim,  # noqa: E402
                 light_match, tint, soft)
import new_pieces as NP  # noqa: E402
from new_pieces import piece, feet  # noqa: E402
from pieces import REBUILT, strap_path, neck_band, guards  # noqa: E402
from fitcheck import check  # noqa: E402
from build_new import check_new  # noqa: E402

WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
MANIFESTS = [os.path.join(REPO, p) for p in ('packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
                                             'apps/android/app/src/main/assets/avatar-parts.json')]
PX = 400 / U          # shipped resolution: 400 px per body unit
ICON = 192            # tile icon, longest side


# ── shoes, fixed (10-05 review): the sneakers read as white soles because only the lower 45% was kept. Keep the
#    upper + laces and squash the shoe to the stubby foot instead; the torso still stays in front of the tops.
SHOE_KEEP = {'sneakers': 0.72, 'boots': 0.62, 'slippers': 0.8, 'skates': 0.82}


def despill(im):
    """Drop the cyan keying fringe (semi-transparent cyan-ish edge pixels) left from the ChatGPT sheet."""
    a = np.asarray(im).astype(np.int16)
    fringe = (a[..., 3] < 240) & ((np.minimum(a[..., 1], a[..., 2]) - a[..., 0]) > 30)
    a[..., 3] = np.where(fringe, 0, a[..., 3])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def shoes(name, body):
    R = rig(body)
    A = R['A']
    pair = piece(name)
    a = np.asarray(pair.getchannel('A')) > 40
    cols = a.any(0)
    xs = np.arange(len(cols))
    mid = len(cols) // 2
    gap = [x for x in xs if not cols[x] and abs(x - mid) < len(cols) * 0.25]
    cut_x = int(np.median(gap)) if gap else mid
    L, Rr = trim(pair.crop((0, 0, cut_x, pair.height))), trim(pair.crop((cut_x, 0, pair.width, pair.height)))
    lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    fy = R['feet_y']
    for (fx0, fx1, fy0, fy1), s in zip(feet(body), (L, Rr)):
        s = s.crop((0, int(s.height * (1 - SHOE_KEEP[name])), s.width, s.height))
        fw = (fx1 - fx0) * (1.36 if name == 'boots' else 1.25)
        fh = max((fy1 - fy0) * 1.45, 0.05 * U)
        fh = min(fh, fw * s.height / s.width)
        s = light_match(despill(s.resize((max(1, int(fw)), max(1, int(fh))), Image.LANCZOS)), 0.05)
        lay.alpha_composite(s, (int((fx0 + fx1) / 2 - fw / 2), int(fy1 + 0.014 * U - fh)))
    a = np.asarray(lay).copy()
    torso = A & (np.arange(CW)[:, None] < fy - 0.01 * U)
    a[..., 3] = np.where(torso, 0, a[..., 3])
    return dict(shoes=[Image.fromarray(a, 'RGBA')], handover=())


def white_backpack(b):
    from pieces import backpack
    return backpack(b, 'white')


def white_supercape(b):
    from pieces import cape
    return cape(b, white=True, acc='white')


# id → (config field, art kind, builder, label, out-layer for shoes/beside)
def ITEMS():
    out = {}
    out['backpack'] = ('neck', 'acc', white_backpack)
    out['chain'] = ('neck', 'acc', REBUILT['chain'])
    out['bubbletea'] = ('neck', 'acc', REBUILT['bubbletea'])
    out['guitar'] = ('neck', 'acc', REBUILT['guitar'])
    out['cape'] = ('neck', 'acc', REBUILT['cape'])
    out['supercape'] = ('neck', 'acc', white_supercape)
    for k in NP.HELD:
        out[k] = ('held', 'acc', (lambda b, k=k: NP.held(k, b)))
    out['bandana'] = ('wrap', 'acc', lambda b: NP.band_wrap('bandana-band', b, thick=0.08, knot='bandana-knot'))
    out['belt'] = ('wrap', 'acc', NP.belt)
    out['apron'] = ('wrap', 'acc', NP.apron)
    out['lei'] = ('wrap', 'acc', lambda b: NP.band_wrap('lei', b, thick=0.1, margin=0.012))
    out['cape-drape'] = ('wrap', 'acc', NP.cape_drape)
    for k in SHOE_KEEP:
        out[k] = ('feet', 'acc', (lambda b, k=k: shoes(k, b)))
    for k in ('bird', 'kitten', 'puppy', 'snail'):
        out[k] = ('pet', 'acc', (lambda b, k=k: NP.companion(k, b)))
    for k in NP.BROWS:
        out['brows:' + k] = ('brows', 'brows', (lambda b, k=k: NP.brows(k, b)))
    for k in NP.EXTRA:
        out[k] = ('extra', 'acc', (lambda b, k=k: NP.extra(k, b)))
    return out


# 10-05 review: the shipped 'sleepy' slanted in toward the nose (reads angry; founder: no angry brows). Relaxed
# and droopy instead: low, nearly flat, the outer end dipping.
NP.BROWS['sleepy'] = [(-0.5, 0.26), (0, 0.12), (0.5, 0.14)]

BESIDE_LAYER = {'pet': 'pet', 'extra': 'extra', 'brows': 'brows'}


from functools import lru_cache  # noqa: E402


@lru_cache(None)
def any_letter_mask(body):
    """Every initial a player can have (A–Z, 0–9), dilated: shadows never darken the letter."""
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
        draw_letter(c, b, ch, fill=(255, 255, 255, 255))
    return ndimage.binary_dilation(np.asarray(c.getchannel('A')) > 30, iterations=int(0.008 * U))


def hand_mask(body, sides):
    R = rig(body)
    hm = np.zeros((CW, CW), np.float32)
    for s in sides:
        if s in R['arms']:
            hm = np.maximum(hm, soft(R['arms'][s]['mask'], 1.2) * R['arms'][s]['mask'])
    return hm


def shadow_img(darken):
    a = np.zeros((CW, CW, 4), np.uint8)
    a[..., 3] = np.clip(darken * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


def ship_layers(body, field, L):
    """The builder's rig layers → {out layer: canvas RGBA}, with shadows, AO and the hand-over baked in."""
    R = rig(body)
    A = R['A']
    Af = A.astype(np.float32)
    face, _ = guards(body)
    guard = ndimage.binary_dilation(face, iterations=int(0.012 * U)) | any_letter_mask(body)
    hm = hand_mask(body, L.get('handover', ()))
    out = {}

    def stack(key, pieces, guarded):
        if not pieces:
            return
        darken = np.zeros((CW, CW), np.float32)
        for p in pieces:
            darken = np.maximum(darken, contact_shadow(Af, alpha(p)))
        if guarded:
            darken *= ~guard
        lay = shadow_img(darken)
        for p in pieces:
            if guarded:
                p = mask_out(p, 1 - guard)
            lay.alpha_composite(mask_out(p, 1 - hm) if hm.any() else p)
        out[key] = lay

    if L.get('back'):
        lay = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
        for p in L['back']:
            lay.alpha_composite(back_ao(p, A))
        out['back'] = lay
    stack('under', L.get('under', ()), False)
    stack('wrap', L.get('front', ()), True)
    stack('held', L.get('held', ()), False)
    for k in ('shoes', 'beside'):
        for p in L.get(k, ()):
            key = 'feet' if k == 'shoes' else BESIDE_LAYER[field]
            out.setdefault(key, Image.new('RGBA', (CW, CW), (0, 0, 0, 0))).alpha_composite(p)
    return out


def art_name(kind, pid, body, layer):
    return f'art-av-{kind}-{pid}-{body}-{layer}'


def save_art(name, im):
    im.save(os.path.join(WEB, name + '.webp'), 'WEBP', quality=90, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=90, method=6)
    iset = os.path.join(IOS, name + '.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, name + '.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': name + '.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


def build_one(key):
    field, kind, fn = ITEMS()[key]
    pid = key.split(':')[-1]
    pieces, fails, sizes = {}, {}, {}
    for body in MAN['bodies']:
        L = fn(body)
        if L.get('unsupported'):
            continue
        _, f = check_new(body, L) if field not in ('neck',) else check(body, L)
        if f:
            fails[body] = f
            continue
        rows = []
        for layer, im in ship_layers(body, field, L).items():
            box = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
            if not box:
                continue
            crop = im.crop(box)
            crop = crop.resize((max(1, round(crop.width * PX)), max(1, round(crop.height * PX))), Image.LANCZOS)
            name = art_name(kind, pid, body, layer)
            save_art(name, crop)
            sizes[name] = list(crop.size)
            rows.append([layer, round((box[0] - M) / U, 4), round((box[1] - M) / U, 4), round((box[2] - box[0]) / U, 4), round((box[3] - box[1]) / U, 4)])
        pieces[body] = rows
    return key, field, kind, pieces, fails, sizes


def icon(key, field, kind):
    pid = key.split(':')[-1]
    if kind == 'brows':
        L = NP.brows(pid, 'classic')
        im = trim(L['beside'][0])
    elif key in REBUILT or key in ('backpack', 'supercape'):
        return None   # the shipped art-av-acc-<id> stays the tile icon
    elif pid in SHOE_KEEP:
        im = trim(piece(pid))
    elif pid == 'bandana':
        im = trim(piece('bandana-knot'))
    elif pid == 'belt':
        im = trim(piece('belt-buckle'))
    elif pid == 'apron':
        im = trim(piece('apron-panel'))
    elif pid == 'cape-drape':
        im = trim(piece('cape-drape'))
    else:
        im = trim(piece(pid))
    s = ICON / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    name = f'art-av-{kind}-{pid}'
    save_art(name, im)
    return name, list(im.size)


def body_anchors(body):
    R = rig(body)
    b = MAN['bodies'][body]
    hands = {s: [round(v, 4) for v in R['arms'][s]['cu']] + [R['arms'][s]['rx'], R['arms'][s]['ry']] for s in ('L', 'R')}
    (p0, _, _), _ = strap_path(body, 'L')
    x0, x1, top, bot = neck_band(body, thick=0.085)
    n = len(top)
    idx = [int(i * (n - 1) / 8) for i in range(9)]
    wrap = [[round((x0 + i - M) / U, 4), round((top[i] - M) / U, 4), round((bot[i] - M) / U, 4)] for i in idx]
    return dict(hands=hands, shoulderY=round(p0[1] + 0.035, 4), wrap=wrap, floor=round((R['bot'] - M) / U, 4))


def eyes_ink_top():
    """Each eyes part's visible top as a fraction of its art canvas (brows clear tall eyes)."""
    out = {}
    parts = os.path.join(os.path.dirname(HERE), 'parts')
    for key in MAN['items']:
        if not key.startswith('eyes:'):
            continue
        p = os.path.join(parts, f'art-av-eyes-{key[5:]}.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        bb = im.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
        if bb:
            out[key] = round(bb[1] / im.height, 4)
    return out


def main(only):
    print('NOTE: the shipped per-body fits come from ship-rules.py (10-06); this re-ships the 10-05 hand fits '
          'for the ids given', file=sys.stderr)
    keys = [k for k in ITEMS() if not only or k.split(':')[-1] in only or k in only]
    with ProcessPoolExecutor(max_workers=int(os.environ.get('AV_WORKERS', '1'))) as ex:
        results = list(ex.map(build_one, keys))
    report = {}
    sizes = {}
    for key, field, kind, pieces, fails, sz in results:
        report[key] = dict(field=field, bodies=sorted(pieces), fails=fails)
        sizes.update(sz)
        print(f'{key:16s} {field:6s} bodies {len(pieces):2d}  fails {fails}')
    icons = {}
    for key, field, kind, *_ in results:
        r = icon(key, field, kind)
        if r:
            icons[r[0]] = r[1]
    anchors = {b: body_anchors(b) for b in MAN['bodies']}
    ink = eyes_ink_top()
    for p in MANIFESTS:
        d = json.load(open(p))
        d['version'] = 3
        d['layerOrder'] = ['back', 'body', 'pattern', 'under', 'cheeks', 'eyes', 'brows', 'nose', 'mouth', 'face', 'wrap',
                           'held', 'head', 'neckFront', 'feet', 'pet', 'extra']
        for b, a in anchors.items():
            d['bodies'][b].update(a)
        for k, v in ink.items():
            d['items'][k]['inkTop'] = v
        for key, field, kind, pieces, fails, _ in results:
            pid = key.split(':')[-1]
            ikey = f'{kind}:{pid}'
            meta = d['items'].get(ikey) or {'w': 1, 'anchor': [0.5, 0.5], 'aspect': 1}
            meta['slot'] = meta.get('slot', 'back')
            meta['layer'] = meta.get('layer') if ikey in d['items'] else {'held': 'held', 'wrap': 'wrap', 'feet': 'feet', 'pet': 'pet', 'extra': 'extra', 'brows': 'brows'}[field]
            meta['pieces'] = pieces
            d['items'][ikey] = meta
        art = set(d['art']) | set(icons) | {n for n in sizes}
        d['art'] = sorted(art)
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    # partial runs (ids on the command line) merge into the previous size + fit reports
    sp, fp = os.path.join(HERE, 'ship-integrated-sizes.json'), os.path.join(HERE, 'fit-shipped.json')
    old_s = json.load(open(sp)) if os.path.exists(sp) and only else {}
    old_f = json.load(open(fp)) if os.path.exists(fp) and only else {}
    with open(sp, 'w') as f:
        json.dump(dict(sorted({**old_s, **sizes, **icons}.items())), f, indent=0)
    with open(fp, 'w') as f:
        json.dump({**old_f, **report}, f, indent=1)
    write_web_sizes(json.load(open(sp)))


def write_web_sizes(sizes):
    """apps/web/lib/art-av-pieces.ts (spread into ART_SIZE): every shipped piece + new icon not already listed."""
    art = open(os.path.join(REPO, 'apps', 'web', 'lib', 'art.ts')).read()
    lines = ['// GENERATED by docs/design/brand/avatar/integration/ship-integrated.py (10-05): the integrated mascot parts —',
             '// per-body layer art art-av-<kind>-<id>-<body>-<layer> (avatar-parts.json `pieces`) + the new tile icons.',
             '// Spread into ART_SIZE (lib/art.ts). Do not edit by hand.',
             'export const AVATAR_PIECE_SIZE: Record<`art-av-${string}`, readonly [number, number]> = {']
    for k, v in sorted(sizes.items()):
        if f"'{k}'" not in art:
            lines.append(f"  '{k}': [{v[0]}, {v[1]}],")
    lines.append('};\n')
    with open(os.path.join(REPO, 'apps', 'web', 'lib', 'art-av-pieces.ts'), 'w') as f:
        f.write('\n'.join(lines))


if __name__ == '__main__':
    main(sys.argv[1:])
