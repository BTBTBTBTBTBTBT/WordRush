"""Today's SHIPPED fit of every item, as canvas layers (the same frame as rules.render), + the tile composer.

  shipped per-body pieces   apps/web/public/art/art-av-<kind>-<id>-<body>-<layer>.webp at the manifest rect
  shipped per-body scarf    art-av-acc-scarf-<body>.webp at items['acc:scarf'].perBody (neckFront)
  one-art items             the CORE layout (packages/core avatar-layout.ts via dump-layout.ts): hats with the
                            eye clearance, face items, the bow tie / medal / wings at their anchors
"""
import json, os, sys
from functools import lru_cache
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
import rig  # noqa: E402
from rig import U, M, CW, MAN, REPO, tint, draw_letter, place_part, tile  # noqa: E402

ART = os.path.join(REPO, 'apps', 'web', 'public', 'art')
PARTS = os.path.join(os.path.dirname(HERE), 'parts')
ORDER = MAN['layerOrder']
BG = (241, 239, 250, 255)
COLS = ['purple', 'teal', 'amber', 'pink', 'sky', 'green', 'orange', 'red', 'slate', 'blue', 'mint', 'lilac']
TINT = {'backpack': '#f97316', 'supercape': '#2563eb', 'wings': '#38bdf8'}
LAYOUT_CACHE = os.path.join(HERE, 'out', 'landmarks', '_cache', 'shipped-layouts.json')


def field_for(key):
    it = MAN['items'][key]
    return {'head': 'head', 'glasses': 'face', 'mustache': 'face', 'cheeks': 'face'}.get(it['slot'], 'neck')


def anchored_keys():
    return [k for k, it in MAN['items'].items() if k.startswith('acc:') and 'pieces' not in it and 'perBody' not in it]


def shipped_layouts(bodies):
    """{key: {body: [layer, x, y, w, h]}} in body units for the one-art items, from the core layout (cached)."""
    if os.path.exists(LAYOUT_CACHE):
        d = json.load(open(LAYOUT_CACHE))
        if all(b in next(iter(d.values())) for b in bodies):
            return d
    import audit
    keys = anchored_keys()
    cfgs = []
    for k in keys:
        for b in bodies:
            c = dict(body=b, color='purple', head='none', face='none', neck='none', eyes='beady', mouth='smile',
                     held='none', wrap='none', feet='none', pet='none', brows='none', extra='none', cheeks='none', nose='none')
            c[field_for(k)] = k.split(':')[1]
            cfgs.append(c)
    out = audit.dump(cfgs)['out']
    res = {}
    i = 0
    for k in keys:
        for b in bodies:
            lay = out[i]['layout']
            i += 1
            br = lay['body']
            pid = k.split(':')[1]
            for L in lay['layers']:
                if L['id'] == pid and L['field'] != 'body':
                    r = L['rect']
                    res.setdefault(k, {})[b] = [L['layer'], round((r['x'] - br['x']) / br['w'], 4), round((r['y'] - br['y']) / br['h'], 4),
                                                round(r['w'] / br['w'], 4), round(r['h'] / br['h'], 4)]
    os.makedirs(os.path.dirname(LAYOUT_CACHE), exist_ok=True)
    json.dump(res, open(LAYOUT_CACHE, 'w'))
    return res


def rect_layer(im, x, y, w, h):
    s = im.resize((max(1, round(w * U)), max(1, round(h * U))), Image.LANCZOS)
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))
    rig._clip_paste(c, s, round(M + x * U), round(M + y * U))
    return c


@lru_cache(None)
def _img(path):
    return Image.open(path).convert('RGBA')


def shipped(key, body, layouts, art=ART, manifest=None):
    """{layer: canvas RGBA} of today's shipped fit ({} = not shipped on that body)."""
    man = manifest or MAN
    it = man['items'][key]
    kind, pid = key.split(':')
    out = {}
    if 'pieces' in it:
        for layer, x, y, w, h in it['pieces'].get(body, []):
            out[layer] = rect_layer(_img(os.path.join(art, f'art-av-{kind}-{pid}-{body}-{layer}.webp')), x, y, w, h)
        return out
    if 'perBody' in it:
        if body in it['perBody']:
            out[it['layer']] = rect_layer(_img(os.path.join(art, f'art-av-{kind}-{pid}-{body}.webp')), *it['perBody'][body])
        return out
    lay = layouts.get(key, {}).get(body)
    if lay:
        layer, x, y, w, h = lay
        out[layer] = rect_layer(_img(os.path.join(PARTS, f'art-av-{kind}-{pid}.png')), x, y, w, h)
    return out


def compose(body, color, layers, pid='', letter='A'):
    """The mascot with an item's layers, drawn like the renderers: back, body, under, LETTER, eyes, mouth, the rest
    in layer order."""
    b = MAN['bodies'][body]
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))

    def draw(layer):
        im = layers[layer]
        if pid in TINT:
            im = tint(im, TINT[pid])
        c.alpha_composite(im)
    if 'back' in layers:
        draw('back')
    c.alpha_composite(tint(rig.body_art(body), color))
    if 'under' in layers:
        draw('under')
    draw_letter(c, b, letter)
    place_part(c, 'eyes:beady', b)
    place_part(c, 'mouth:smile', b)
    for layer in sorted([k for k in layers if k not in ('back', 'under')], key=lambda k: ORDER.index(k) if k in ORDER else 99):
        draw(layer)
    return c


def font(size, bold=True):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
              '/System/Library/Fonts/Supplemental/Arial Bold.ttf'):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def blank(T, text='—'):
    t = Image.new('RGBA', (T, T), (226, 223, 233, 255))
    ImageDraw.Draw(t).text((T / 2, T / 2), text, font=font(max(9, T // 9)), fill=(140, 130, 160, 255), anchor='mm')
    return t


def framed(img, T, fail=False):
    """tile() with a fixed frame per body (so the shipped and the rule tiles are at the same scale)."""
    t = tile(img, T, bg=BG)
    if fail:
        d = ImageDraw.Draw(t)
        d.rectangle([0, 0, T - 1, T - 1], outline=(230, 30, 60, 255), width=max(2, T // 40))
    return t


def fixed_tile(img, body, T, fail=False, lms=None, pad=0.42):
    """Crop a fixed window around the body (its bbox + pad) so tiles of the same body line up exactly."""
    lm = (lms or {}).get(body)
    if lm:
        x0, y0, x1, y1 = lm['bbox']
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        side = max(x1 - x0, y1 - y0) + 2 * pad
        box = tuple(int(M + v * U) for v in (cx - side / 2, cy - side / 2 - 0.04, cx + side / 2, cy + side / 2 - 0.04))
        crop = img.crop(box).resize((T, T), Image.LANCZOS)
        t = Image.new('RGBA', (T, T), BG)
        t.alpha_composite(crop)
    else:
        t = tile(img, T, bg=BG)
    if fail:
        ImageDraw.Draw(t).rectangle([0, 0, T - 1, T - 1], outline=(230, 30, 60, 255), width=max(2, T // 40))
    return t
