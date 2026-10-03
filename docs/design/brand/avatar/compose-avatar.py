# Avatar maker parts + the fit manifest (FINISH_SPEC AN2; night art 10-03, round 2 10-03 day).
#
# ChatGPT sheets (sheets/*.png, keyed) are split into cut/<kind>-<id>.png (split-grid-api.py); bodies come from
# src/body-<id>.png. This script writes parts/art-av-<kind>-<id>.png and the manifest
# packages/core/src/avatar-parts.json (+ the iOS and Android copies). Manifest v2 = the FIT SYSTEM:
#
#   Body square: every body is drawn in a u×u square (its art canvas), bottom-aligned on a shared floor.
#   All coordinates below are fractions of that square ("body units").
#   bodies.<id>:  faceCenter/eyeY/mouthY/cheekY/headTop/neckY/letterBox (v1 keys, kept)
#                 face {x, w}        the face box: center x + usable width at eye level (face parts scale by w)
#                 mustacheY          between nose and mouth
#                 shoulderW          body width at the neck line (front neck items scale by it)
#                 back {x, y, w}     back point + full silhouette width incl. arms (back items scale by w)
#                 cape {y}           shoulder line a cape hangs from
#                 hand {x, y}        the viewer's-right hand (held items)
#                 overrides          {"acc:<id>": {dx, dy, scale}} per-body seat fixes
#   items.<kind>:<id>:  w (width as a fraction of the slot's base width), aspect (canvas h/w),
#                 anchor [ax, ay] (the point of the canvas that lands on the slot point), slot, layer,
#                 overlap (hats: fraction of the hat's height that sits over the head), tint (white art that
#                 takes the accessory color)
#   slots: base width + point per slot (see SLOT_BASE / slot points in packages/core/src/avatar-layout.ts).
#   fit: {pad, maxBody, minBody}: the composed avatar (every layer) is scaled uniformly to fit the tile with
#        `pad` on every side, never larger than maxBody (body square side as a fraction of the tile).
#   python3 compose-avatar.py
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CUT, SRC, OUT = (os.path.join(HERE, d) for d in ('cut', 'src', 'parts'))
os.makedirs(OUT, exist_ok=True)
U = 1024          # body square
PMAX = 384        # part canvas: longest side


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def r4(v):
    return round(float(v), 4)


# ── Bodies ───────────────────────────────────────────────────────────────────
BODIES = ['classic', 'tall', 'wide', 'blob', 'bean', 'star', 'drop', 'pear', 'cloud', 'chunky', 'mini', 'hex']
SIZE = {'mini': 0.70}     # mini stays small in its square (everything else fills 94%)
# eye, cheek, mouth, letter top, letter height — fractions of the main body height (top → above the feet)
FACE = {
    'classic': (0.33, 0.47, 0.53, 0.60, 0.34), 'tall': (0.26, 0.37, 0.42, 0.50, 0.40),
    'wide': (0.33, 0.48, 0.55, 0.62, 0.32), 'blob': (0.35, 0.49, 0.55, 0.62, 0.32),
    'bean': (0.30, 0.42, 0.47, 0.55, 0.36), 'star': (0.40, 0.50, 0.555, 0.61, 0.24),
    'drop': (0.47, 0.585, 0.635, 0.69, 0.24), 'pear': (0.38, 0.50, 0.555, 0.63, 0.30),
    'cloud': (0.38, 0.52, 0.58, 0.65, 0.27), 'chunky': (0.30, 0.44, 0.50, 0.58, 0.34),
    'mini': (0.33, 0.48, 0.55, 0.62, 0.30), 'hex': (0.33, 0.47, 0.53, 0.60, 0.32),
}
HEADF = {'star': 0.22, 'drop': 0.4}   # pointy tops: the head line is where the top is this wide
bodies = {}
body_alpha = {}
for b in BODIES:
    art = trim(Image.open(os.path.join(SRC, f'body-{b}.png')).convert('RGBA'))
    fill = SIZE.get(b, 0.94)
    s = min(fill * U / art.width, fill * U / art.height)
    art = art.resize((round(art.width * s), round(art.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (U, U), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((U - art.width) // 2, round(0.97 * U) - art.height))
    canvas.save(os.path.join(OUT, f'art-av-body-{b}.png'))
    a = np.asarray(canvas.getchannel('A')) > 128
    body_alpha[b] = a
    ys, xs = np.nonzero(a)
    top, bot = ys.min() / U, ys.max() / U
    H = bot - top
    mb = bot - H * (0.09 if b == 'star' else 0.115)          # main body bottom (above the feet)
    mh = mb - top

    def span(fy):
        r = a[min(U - 1, max(0, int(fy * U)))]
        xx = np.nonzero(r)[0]
        return (xx.min() / U, xx.max() / U) if len(xx) else (0.5, 0.5)

    widths = [(span(top + mh * f)[1] - span(top + mh * f)[0]) for f in np.linspace(0.02, 0.4, 20)]
    mainW = max(widths)
    ey, chy, my, lt, lh = FACE[b]
    el, er = span(top + mh * ey)
    fx = (el + er) / 2
    faceW = (er - el) * {'star': 0.5, 'drop': 0.86}.get(b, 0.80)
    # head line: the first row at least half the main width (pointy tops seat hats lower)
    hy = top
    for f in np.linspace(0, 0.5, 120):
        l, r = span(top + mh * f)
        if r - l >= HEADF.get(b, 0.5) * mainW:
            hy = top + mh * f
            break
    hl, hr = span(hy + mh * 0.04)
    nl, nr = span(top + mh * (lt - 0.015))
    # full silhouette width incl. arms (rows 35–80% of the height)
    full = [span(top + H * f) for f in np.linspace(0.35, 0.8, 30)]
    bl, br = min(p[0] for p in full), max(p[1] for p in full)
    # the viewer's-right hand: the row where the silhouette reaches furthest right in 45–85%
    best = max(((span(top + H * f)[1], f) for f in np.linspace(0.45, 0.85, 40)))
    lw = min(0.6 * mainW, 0.42) if b not in ('star', 'drop') else 0.32 * mainW
    bodies[b] = {
        'faceCenter': [r4(fx), r4(top + mh * (ey + my) / 2)],
        'eyeY': r4(top + mh * ey), 'mouthY': r4(top + mh * my), 'cheekY': r4(top + mh * chy),
        'headTop': {'x': r4((hl + hr) / 2), 'y': r4(hy), 'w': r4(hr - hl)},
        'neckY': r4(top + mh * (lt - 0.015)),
        'letterBox': [r4(fx - lw / 2), r4(top + mh * lt), r4(lw), r4(mh * lh)],
        'face': {'x': r4(fx), 'w': r4(faceW)},
        'mustacheY': r4(top + mh * (chy + my) / 2 + mh * 0.01),
        'shoulderW': r4(min(nr - nl, mainW)),
        'back': {'x': r4((bl + br) / 2), 'y': r4(top + mh * 0.38), 'w': r4(br - bl)},
        'cape': {'y': r4(top + mh * 0.18)},
        'hand': {'x': r4(best[0] - 0.03), 'y': r4(top + H * best[1])},
        'bounds': [r4(xs.min() / U), r4(top), r4(xs.max() / U), r4(bot)],
        'overrides': {},
    }

# ── Parts ────────────────────────────────────────────────────────────────────
# kind:id → (w, anchor, slot, extra). w = fraction of the slot's base width.
#   slots: eyes/nose/cheeks/mouth/face/mustache/glasses → base face.w, at the face point;
#          head → headTop.w; neck → shoulderW at neckY; hand → back.w at hand; back/cape → back.w
C = (0.5, 0.5)
ITEMS = {}
for k, w in {'beady': .62, 'happy': .62, 'sparkly': .64, 'sleepy': .64, 'wink': .62, 'hearts': .66, 'stars': .68,
             'glasses': .80, 'cyclops': .36, 'sunglasses': .82, 'determined': .60, 'anime': .66, 'joy': .64,
             'droopy': .64, 'biground': .66, 'sideglance': .66, 'dizzy': .66}.items():
    ITEMS[f'eyes:{k}'] = dict(w=w, anchor=C, slot='eyes', layer='eyes')
for k, w in {'smile': .36, 'grin': .36, 'tongue': .34, 'o': .16, 'cat': .32, 'toothy': .38, 'smirk': .32, 'tiny': .2,
             'gasp': .18, 'laugh': .40, 'whistle': .16, 'fang': .34, 'kissy': .2, 'braces': .40, 'oops': .18,
             'tongueside': .36, 'teeth': .36}.items():
    ITEMS[f'mouth:{k}'] = dict(w=w, anchor=C, slot='mouth', layer='mouth')
for k, w in {'button': .12, 'red': .18, 'pointy': .17, 'bignose': .2, 'cat': .13, 'piggy': .2, 'clownstar': .19}.items():
    ITEMS[f'nose:{k}'] = dict(w=w, anchor=C, slot='nose', layer='nose')
for k, w in {'blush': .92, 'freckles': .82, 'hearts': .86, 'starfreckles': .88, 'sparkle': .92}.items():
    ITEMS[f'cheeks:{k}'] = dict(w=w, anchor=C, slot='cheeks', layer='cheeks')
ITEMS['cheeks:bandage'] = dict(w=.26, anchor=(0.5 - 0.27 / 0.26, 0.5), slot='cheeks', layer='cheeks')
FACEX = {'heart-glasses': (.92, C, 'glasses'), 'starglasses': (.94, C, 'glasses'), 'roundglasses': (.88, C, 'glasses'),
         'mask': (.98, C, 'glasses'), 'eyepatch': (.74, (0.5, 0.45), 'glasses'), 'monocle': (.3, (-0.38, 0.32), 'glasses'),
         'mustache': (.48, C, 'mustache'), 'curlymustache': (.52, C, 'mustache'), 'facepaint': (.86, C, 'cheeks')}
for k, (w, an, slot) in FACEX.items():
    ITEMS[f'acc:{k}'] = dict(w=w, anchor=an, slot=slot, layer='face')
# hats: w of headTop.w and the fraction of the hat that overlaps the head (negative = floats above)
HATS = {'crown': (.74, .12), 'party': (.5, .05), 'beanie': (1.0, .3), 'sprout': (.5, .02), 'nightcap': (1.05, .25),
        'headphones': (1.18, .55), 'bow': (.62, .1), 'wizard': (.9, .12), 'pirate': (1.05, .2), 'cowboy': (1.15, .2),
        'chef': (.85, .15), 'grad': (1.0, .15), 'halo': (.8, -.35), 'flower': (.5, .1), 'tophat': (.75, .12),
        'propeller': (.9, .2), 'catears': (1.0, .15), 'bunnyears': (.85, .1), 'tiara': (.8, .2), 'viking': (1.1, .25),
        'sweatband': (1.02, .9), 'cap': (1.0, .25), 'beret': (1.0, .3), 'minicrown': (.55, .1), 'flowercrown': (1.0, .45),
        'bucket': (1.05, .3), 'santa': (1.05, .25), 'witch': (.95, .15), 'astronaut': (1.1, .3), 'bigbow': (.7, .15),
        'pombeanie': (1.0, .3), 'bearears': (1.05, .2), 'mohawk': (.6, .1)}
for k, (w, ov) in HATS.items():
    ITEMS[f'acc:{k}'] = dict(w=w, anchor=(0.5, 1 - ov), slot='head', layer='head', overlap=ov)
ITEMS['acc:headphones']['overFace'] = True   # its cups sit beside the eyes by design
NECKF = {'bowtie': (.38, C, 'neck'), 'chain': (.7, (0.5, 0.12), 'neck'), 'scarf': (.86, (0.5, 0.28), 'neck'),
         'medal': (.42, (0.5, 0.1), 'neck'), 'bubbletea': (.24, (0.35, 0.62), 'hand')}
for k, (w, an, slot) in NECKF.items():
    ITEMS[f'acc:{k}'] = dict(w=w, anchor=an, slot=slot, layer='neckFront')
BACK = {'cape': (1.32, (0.5, 0.04), 'cape'), 'supercape': (1.32, (0.5, 0.04), 'cape'), 'wings': (1.5, (0.5, 0.5), 'back'),
        'fairywings': (1.42, (0.5, 0.52), 'back'), 'backpack': (1.12, (0.5, 0.62), 'back'), 'guitar': (.92, (0.45, 0.5), 'back')}
for k, (w, an, slot) in BACK.items():
    ITEMS[f'acc:{k}'] = dict(w=w, anchor=an, slot=slot, layer='back')
TINT = ['acc:supercape', 'acc:backpack', 'acc:wings', 'acc:chef', 'acc:astronaut']
for t in TINT:
    ITEMS[t]['tint'] = True
CUTNAME = {'acc:supercape': 'acc-capewhite'}


def cut_for(key):
    kind, pid = key.split(':')
    return CUTNAME.get(key, f'{kind}-{pid}')


for key, meta in ITEMS.items():
    im = trim(Image.open(os.path.join(CUT, cut_for(key) + '.png')).convert('RGBA'))
    s = PMAX / max(im.size) if meta['layer'] != 'back' else 640 / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    kind, pid = key.split(':')
    im.save(os.path.join(OUT, f'art-av-{kind}-{pid}.png'))
    meta['aspect'] = r4(im.height / im.width)
    meta['anchor'] = [r4(meta['anchor'][0]), r4(meta['anchor'][1])]
    meta['w'] = r4(meta['w'])

# stale parts from earlier rounds (blush/freckles moved to cheeks)
for f in os.listdir(OUT):
    if f.startswith('art-av-') and f[:-4] not in {f'art-av-body-{b}' for b in BODIES} | {'art-av-' + k.replace(':', '-') for k in ITEMS}:
        os.remove(os.path.join(OUT, f))

# Mutually exclusive picks (the maker swaps the other side out; the layout drops the lower-priority one).
GLASSES = ['heart-glasses', 'starglasses', 'roundglasses', 'mask', 'monocle', 'eyepatch']
CONFLICTS = [
    {'a': 'eyes', 'aIds': ['glasses', 'sunglasses', 'cyclops'], 'b': 'face', 'bIds': GLASSES},
    {'a': 'mouth', 'aIds': ['whistle', 'kissy', 'laugh', 'braces'], 'b': 'face', 'bIds': ['mustache', 'curlymustache']},
    {'a': 'nose', 'aIds': ['piggy', 'bignose', 'clownstar'], 'b': 'face', 'bIds': ['mustache', 'curlymustache']},
    {'a': 'cheeks', 'aIds': ['*'], 'b': 'face', 'bIds': ['facepaint']},
    {'a': 'head', 'aIds': ['astronaut', 'headphones'], 'b': 'face', 'bIds': ['eyepatch']},
]
art_names = sorted(f[:-4] for f in os.listdir(OUT) if f.startswith('art-av-') and f.endswith('.png'))
prev = {}
mp = os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')
if os.path.exists(mp):
    prev = json.load(open(mp))
# Per-body seat fixes from fit-check.py (the backpack peeks out around a narrow body; the white
# supercape drapes wider behind the leaning bean).
BODY_OVERRIDES = {
    'tall': {'acc:backpack': {'scale': 1.3}},
    'bean': {'acc:supercape': {'scale': 1.2}},
}
for b in BODIES:   # keep hand-tuned per-body overrides across regenerations (+ the ones above)
    bodies[b]['overrides'] = {**prev.get('bodies', {}).get(b, {}).get('overrides', {}), **BODY_OVERRIDES.get(b, {})}
manifest = {
    'version': 2,
    'placeholder': False,
    'frame': 'square',
    'note': ('Fit manifest v2 (docs/design/brand/avatar/compose-avatar.py; layout = packages/core/src/avatar-layout.ts). '
             'Body units: fractions of the body art square. Items are placed by anchor at their slot point, '
             'width = w x the slot base width; the whole composition is scaled to the tile by `fit`.'),
    'fit': prev.get('fit', {'pad': 0.05, 'maxBody': 0.86, 'minBody': 0.5}),
    'layerOrder': ['back', 'body', 'pattern', 'letter', 'cheeks', 'eyes', 'nose', 'mouth', 'face', 'head', 'neckFront'],
    'bodies': bodies,
    # v1 keys (category slot + scale), kept for older clients
    'parts': {
        'eyes': {'slot': 'eyeY', 'scale': 0.37}, 'mouth': {'slot': 'mouthY', 'scale': 0.19},
        'nose': {'slot': 'cheekY', 'scale': 0.12}, 'cheeks': {'slot': 'cheekY', 'scale': 0.5},
        'head': {'slot': 'headTop', 'scale': 1.0}, 'face': {'slot': 'eyeY', 'scale': 0.4}, 'neck': {'slot': 'neckY', 'scale': 0.32},
    },
    'items': ITEMS,
    'conflicts': CONFLICTS,
    'art': art_names,
}
for dst in ['packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
            'apps/android/app/src/main/assets/avatar-parts.json']:
    with open(os.path.join(REPO, dst), 'w') as fh:
        json.dump(manifest, fh, indent=1)
        fh.write('\n')
print(len(art_names), 'parts;', len(ITEMS), 'items; manifest written')
