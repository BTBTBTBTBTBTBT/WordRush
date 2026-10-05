#!/usr/bin/env python3
"""Seasonal mascot-maker items (founder 10-05: "some seasonal mascot options too, available should any user want to
make their mascot fit the season"). Same rig + rules as ship-integrated.py (per-body layer art, front/back split,
contact shadows, hand-over, face/letter guards, fit check), plus a `season` field on every item it writes.

    python3 docs/design/brand/avatar/integration/ship-seasonal.py [ids…]

Hats ship like every other hat (one art at the head slot, the core layout keeps them clear of the eyes); everything
else ships PER BODY (avatar-parts.json items[key].pieces). The core decides when a seasonal item shows
(isPartAvailable in packages/core/src/avatar-season.ts): in its season window, under the admin Season preview, or
when the player already wears it. A body the part can't fit gets no pieces (it draws nothing there).

Adding a season: art in seasons/<season>/extras|pieces|props, a row in SEASONAL below (field, source, builder),
the id appended to its catalog in avatar-config.ts (+ Swift / Kotlin twins), run this script. See seasons/README.md.
"""
import json, os, sys
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from rig import U, M, CW, MAN, REPO, rig, trim, load, place, light_match, P, alpha  # noqa: E402
import new_pieces as NP  # noqa: E402
from pieces import neck_band, guards, draw_strap, avoid, main_width  # noqa: E402
from fitcheck import check  # noqa: E402
import importlib.util as _ilu  # noqa: E402
_spec = _ilu.spec_from_file_location('ship_integrated', os.path.join(HERE, 'ship-integrated.py'))
SI = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(SI)

SEASONS = os.path.join(REPO, 'docs', 'design', 'brand', 'seasons')
PARTS = os.path.join(os.path.dirname(HERE), 'parts')


@lru_cache(None)
def src(season, rel):
    im = trim(load(os.path.join(SEASONS, season, rel)))
    return SI.despill(im)


# ── builders ──────────────────────────────────────────────────────────────────
def held_item(season, rel, grip, w, rot=0, side='R', grip_range=(0.003, 0.5)):
    """A held item in the fist (NP.held with a seasonal source image)."""
    def build(body):
        name = f'{season}/{rel}'
        NP.HELD[name] = dict(grip=grip, w=w, rot=rot, side=side, set='', label='')
        old = NP.piece
        NP.piece = lambda n: src(season, rel) if n == name else old(n)
        try:
            L = NP.held(name, body)
        finally:
            NP.piece = old
        L['grip_range'] = grip_range
        return L
    return build


def back_wings(season, rel, wmul=2.25, ymul=0.0):
    """Wings behind the body, centered on the back point, clipped outside the silhouette (rig back_ao)."""
    def build(body):
        R = rig(body)
        b = R['b']
        im = light_match(src(season, rel), 0.06)
        w_eye, cx = main_width(body)
        w = min(max(w_eye * wmul, 0.95), 1.45)
        y = b['eyeY'] + 0.04 + ymul
        return dict(back=[place(im, (cx - M) / U, y, w, anchor=(0.5, 0.42))], handover=())
    return build


def tail(season, rel):
    """A tail behind the body: its base tucked behind the lower back on the viewer's right, curling up beside it."""
    def build(body):
        R = rig(body)
        A = R['A']
        im = light_match(src(season, rel), 0.05).transpose(Image.FLIP_LEFT_RIGHT)
        fy = R['feet_y']
        y = fy - 0.12 * U
        l, r = R['span'](y)
        h = min(0.56, (R['bot'] - R['top']) / U * 0.62)
        w = h * im.width / im.height
        # base (bottom-right of the flipped art) sits inside the body's right edge
        return dict(back=[place(im, (r - M) / U + w * 0.62 - 0.06, (y - M) / U + h * 0.08, w, anchor=(0.62, 0.95))], handover=())
    return build


def collar(season, rel):
    """A stand-up cape collar: the tall back flares out behind the head + shoulders (back layer, clipped outside the
    silhouette); in front only a thin cord along the wrap line and the clasp (never over the face or letter)."""
    def build(body):
        R = rig(body)
        A = R['A']
        im = src(season, rel)
        x0, x1, top, bot = neck_band(body, thick=0.05)
        yc = float(((top + bot) / 2).mean())
        cw = min(max((x1 - x0) / U * 1.08 + 0.06, 0.66), 1.0)
        back = place(light_match(im, 0.06), ((x0 + x1) / 2 - M) / U, (yc - M) / U + 0.02, cw, anchor=(0.5, 0.78))
        xa, xb, xm = (x0 - M) / U + 0.01, (x1 - M) / U - 0.01, ((x0 + x1) / 2 - M) / U
        midb = (top + bot) / 2
        thick = float((bot - top)[len(top) // 2])
        yat = lambda xu: (midb[int(np.clip(xu * U + M - x0, 0, len(midb) - 1))] - M) / U
        ym = yat(xm)
        cord = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
        for p in ([(xa, yat(xa) - 0.02), ((xa + xm) / 2, yat((xa + xm) / 2)), (xm, ym)],
                  [(xb, yat(xb) - 0.02), ((xb + xm) / 2, yat((xb + xm) / 2)), (xm, ym)]):
            cord.alpha_composite(draw_strap(p, min(0.024, thick / U * 0.75), '#2b1a33', buckle=False))
        from scipy import ndimage
        ca = np.asarray(cord).copy()
        ca[..., 3] = ca[..., 3] * ndimage.binary_dilation(A, iterations=int(0.008 * U))
        cord = Image.fromarray(ca, 'RGBA')
        W, H = im.size
        clasp = trim(im.crop((int(W * 0.38), int(H * 0.5), int(W * 0.62), int(H * 0.82))))
        cl = avoid(lambda dx, dy: place(clasp, xm, ym + dy, min(0.11, thick / U * 1.25), anchor=(0.5, 0.5)), body,
                   step=(0, -0.006), tries=8)
        return dict(back=[back], front=[cord, cl], handover=(), seat_min=0.45)
    return build


def buddy(season, rel, where, w=0.26):
    """A companion: 'floor' beside the feet (like the kitten), 'fly' beside the head on the viewer's left, 'float'
    beside the shoulder on the viewer's right. Never over the face or letter."""
    def build(body):
        R = rig(body)
        b = R['b']
        A = R['A']
        im = light_match(src(season, rel), 0.05)
        if where == 'floor':
            fx = NP.feet(body)[-1][1]
            floor = (R['bot'] - M) / U
            lay = place(im, (fx - M) / U + w * 0.5, floor + 0.005, w, anchor=(0.5, 1.0))
        elif where == 'fly':
            l, r = R['span'](P(b['eyeY']))
            lay = avoid(lambda dx, dy: place(im, (l - M) / U - w * 0.12 - dx, b['headTop']['y'] + 0.06, w, anchor=(0.5, 0.5), rot=8), body, step=(0.012, 0), tries=12)
        else:
            l, r = R['span'](P(b['mouthY']))
            lay = avoid(lambda dx, dy: place(im, (r - M) / U + w * 0.18 + dx, b['eyeY'] + 0.02, w, anchor=(0.5, 0.5), rot=-6), body, step=(0.012, 0), tries=12)
        return dict(beside=[lay], handover=())
    return build


H = 'halloween'
# id -> (field, season, source, builder or hat spec). Hats: (anchor y of the head line in the art, width × headTop.w)
SEASONAL = {
    'pumpkinhat':    ('head', H, 'extras/av-pumpkin-hat.png', dict(anchor=0.86, w=1.02)),
    'candycornhat':  ('head', H, 'extras/av-candycorn-hat.png', dict(anchor=0.9, w=0.72)),
    'witchnight':    ('head', H, 'extras/av-witch-hat.png', dict(anchor=0.86, w=1.0)),
    'batears':       ('head', H, 'extras/av-bat-ears.png', dict(anchor=0.85, w=1.04)),
    'mummywrap':     ('head', H, 'extras/av-mummy-wrap.png', dict(anchor=0.72, w=1.0)),
    'ghosthood':     ('head', H, 'pieces/ghost-hood.png', dict(anchor=0.62, w=1.12)),
    'batwings':      ('neck', H, 'pieces/bat-wings.png', back_wings(H, 'pieces/bat-wings.png')),
    'cattail':       ('neck', H, 'pieces/cat-tail.png', tail(H, 'pieces/cat-tail.png')),
    'vampirecollar': ('wrap', H, 'extras/av-vampire-collar.png', collar(H, 'extras/av-vampire-collar.png')),
    'candypail':     ('held', H, 'pieces/candy-pail.png', held_item(H, 'pieces/candy-pail.png', grip=(0.5, 0.06), w=1.7, rot=4)),
    'bat':           ('pet', H, 'props/bat.png', buddy(H, 'props/bat.png', 'fly', 0.4)),
    'ghost':         ('pet', H, 'props/ghost.png', buddy(H, 'props/ghost.png', 'float', 0.32)),
    'blackcat':      ('pet', H, 'props/black-cat.png', buddy(H, 'props/black-cat.png', 'floor', 0.3)),
}
# The tail is a back piece that is mostly BESIDE the body by design (only its base tucks behind): its "behind" floor
# is the seat floor INTEGRATION.md gives tails (15%), not the wings/capes 25%.
BACK_HIDDEN_MIN = {'cattail': 0.12}


def checked(pid, body, field, L):
    if field == 'neck':
        m, f = check(body, L)
        if pid in BACK_HIDDEN_MIN:
            f = [x for x in f if not (x.startswith('not behind') and m.get('back_hidden', 0) >= BACK_HIDDEN_MIN[pid])]
        return m, f
    return SI.check_new(body, L)


def build_one(pid):
    field, season, rel, spec = SEASONAL[pid]
    pieces, fails, sizes, metrics = {}, {}, {}, {}
    for body in MAN['bodies']:
        L = spec(body)
        m, f = checked(pid, body, field, L)
        metrics[body] = m
        if f:
            fails[body] = f
            continue
        rows = []
        for layer, im in SI.ship_layers(body, field, L).items():
            box = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
            if not box:
                continue
            crop = im.crop(box)
            crop = crop.resize((max(1, round(crop.width * SI.PX)), max(1, round(crop.height * SI.PX))), Image.LANCZOS)
            name = SI.art_name('acc', pid, body, layer)
            SI.save_art(name, crop)
            sizes[name] = list(crop.size)
            rows.append([layer, round((box[0] - M) / U, 4), round((box[1] - M) / U, 4), round((box[2] - box[0]) / U, 4), round((box[3] - box[1]) / U, 4)])
        pieces[body] = rows
    return pid, pieces, fails, sizes, metrics


def ship_hat(pid):
    field, season, rel, spec = SEASONAL[pid]
    im = light_match(src(season, rel), 0.04)
    s = 384 / im.width
    im = im.resize((384, max(1, round(im.height * s))), Image.LANCZOS)
    im.save(os.path.join(PARTS, f'art-av-acc-{pid}.png'), optimize=True)
    SI.save_art(f'art-av-acc-{pid}', im)
    meta = {'w': spec['w'], 'anchor': [0.5, spec['anchor']], 'slot': 'head', 'layer': 'head', 'overlap': round(1 - spec['anchor'], 2),
            'aspect': round(im.height / im.width, 4), 'season': season}
    return meta, {f'art-av-acc-{pid}': list(im.size)}


def icon(pid):
    field, season, rel, _ = SEASONAL[pid]
    im = src(season, rel)
    s = SI.ICON / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    SI.save_art(f'art-av-acc-{pid}', im)
    return {f'art-av-acc-{pid}': list(im.size)}


# 13 built → 11 shipped after the 10-05 contact-sheet review (all 12 bodies through the core layout):
DROPPED = {
    'mummywrap': 'the bandage sits on top of the head like a loose strip (no wrap around a head the body art has no '
                 'separate shape for): pasted on',
    'ghosthood': 'the face guard lifts it above the eyes, so the sheet reads as a white cap / doily on top: pasted on',
}


# The shelf tile tag per season (the NEW / PRO tag family: the glossy pill + gold rim of art-dress-tag-new, its pink
# turned to the season color, the season's name in puffy white): art-dress-tag-<season>.
TAG_HUE = {'halloween': 24}       # target hue (degrees) of the pill body


def season_tag(season):
    import colorsys
    from PIL import ImageDraw, ImageFilter, ImageFont
    src = Image.open(os.path.join(SI.IOS, 'art-dress-tag-new.imageset', 'art-dress-tag-new.png')).convert('RGBA')
    S = 4
    src = src.resize((src.width * S, src.height * S), Image.LANCZOS)
    W, Hh = src.size
    cap = int(W * 0.14)
    text = season.replace('-', ' ').upper()
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf', int(Hh * 0.36))
    tw = ImageDraw.Draw(src).textlength(text, font=font)
    mid_w = int(tw + Hh * 0.62 - 2 * cap)
    out = Image.new('RGBA', (2 * cap + max(mid_w, 8), Hh), (0, 0, 0, 0))
    out.alpha_composite(src.crop((0, 0, cap, Hh)), (0, 0))
    col = src.crop((cap - S, 0, cap, Hh)).resize((max(mid_w, 8), Hh))
    out.alpha_composite(col, (cap, 0))
    out.alpha_composite(src.crop((W - cap, 0, W, Hh)), (cap + max(mid_w, 8), 0))
    a = np.asarray(out).astype(np.float32) / 255
    hue = TAG_HUE.get(season, 24) / 360
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b, al = a[y, x]
            h, l, sat = colorsys.rgb_to_hls(r, g, b)
            if al > 0 and sat > 0.35 and (h > 0.80 or h < 0.02):      # the pink body (the gold rim stays gold)
                a[y, x, :3] = colorsys.hls_to_rgb(hue, l * 0.96, sat)
    out = Image.fromarray((a * 255).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(out)
    cx, cy = out.width / 2, Hh * 0.47
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((cx, cy + S * 1.5), text, font=font, fill=(150, 52, 8, 200), anchor='mm')
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S * 0.8)))
    d.text((cx, cy), text, font=font, fill=(255, 251, 246, 255), anchor='mm')
    out = out.resize((round(out.width / S * 2), round(Hh / S * 2)), Image.LANCZOS)
    name = f'art-dress-tag-{season}'
    SI.save_art(name, out)
    return {name: list(out.size)}


def main(only):
    ids = [k for k in SEASONAL if (not only or k in only) and k not in DROPPED]
    report, sizes, metas = {}, {}, {}
    for pid in ids:
        field = SEASONAL[pid][0]
        if field == 'head':
            meta, sz = ship_hat(pid)
            metas[f'acc:{pid}'] = meta
            sizes.update(sz)
            report[pid] = dict(field=field, season=SEASONAL[pid][1], bodies='all (head slot)', fails={})
            print(f'{pid:14s} head   shipped (hat)')
            continue
        _, pieces, fails, sz, metrics = build_one(pid)
        sizes.update(sz)
        sizes.update(icon(pid))
        metas[f'acc:{pid}'] = {'w': 1, 'anchor': [0.5, 0.5], 'aspect': 1, 'slot': 'back',
                               'layer': {'held': 'held', 'wrap': 'wrap', 'pet': 'pet', 'neck': 'back'}[field],
                               'season': SEASONAL[pid][1], 'pieces': pieces}
        report[pid] = dict(field=field, season=SEASONAL[pid][1], bodies=sorted(pieces), fails=fails, metrics=metrics)
        print(f'{pid:14s} {field:5s} bodies {len(pieces):2d}  fails {fails}')
    for season in sorted({v[1] for v in SEASONAL.values()}):
        tag = season_tag(season)
        print('tag', tag)
    for p in SI.MANIFESTS:
        d = json.load(open(p))
        for k in [k for k, v in d['items'].items() if v.get('season') and k.split(':')[1] in DROPPED]:
            del d['items'][k]
        d['items'].update(metas)
        # the stand-up collar fills the wrap line + the back of the neck: no scarf / chain / bow tie / medal / cape /
        # backpack with it (wings and the bat wings are fine: a vampire bat)
        conf = {'a': 'wrap', 'aIds': ['vampirecollar'], 'b': 'neck', 'bIds': ['scarf', 'chain', 'bowtie', 'medal', 'cape', 'supercape', 'backpack']}
        d['conflicts'] = [c for c in d['conflicts'] if c.get('aIds') != ['vampirecollar']] + [conf]
        d['art'] = sorted((set(d['art']) - {a for a in d['art'] if any(a.startswith(f'art-av-acc-{x}') for x in DROPPED)}) | set(sizes))
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    sp = os.path.join(HERE, 'ship-integrated-sizes.json')
    old = json.load(open(sp))
    old = {k: v for k, v in old.items() if not any(k.startswith(f'art-av-acc-{x}') for x in DROPPED)}
    with open(sp, 'w') as f:
        json.dump(dict(sorted({**old, **sizes}.items())), f, indent=0)
    SI.write_web_sizes(json.load(open(sp)))
    fp = os.path.join(HERE, 'fit-seasonal.json')
    prev = json.load(open(fp)) if os.path.exists(fp) and only else {}
    with open(fp, 'w') as f:
        json.dump({**prev, **report}, f, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
