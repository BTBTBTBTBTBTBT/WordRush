# Avatar maker parts (FINISH_SPEC AN2; night art 10-03). ChatGPT sheets (sheets/*.png, keyed) are split into
# cut/<kind>-<id>.png (split-grid-api.py), then placed on the shared canvas conventions below, written to
# parts/art-av-<kind>-<id>.png, and the real anchors go to packages/core/src/avatar-parts.json (+ the iOS and
# Android copies).
#
# Canvas conventions (all platforms; every value is a fraction of the body art SQUARE "u"):
#   body   square u×u; the white glossy body (arms + feet included) bottom-aligned; tinted by multiply in code.
#   eyes   2:1 canvas, width = parts.eyes.scale·u, centered on (faceCenter.x, eyeY).
#   mouth  1:1 canvas, width = parts.mouth.scale·u, centered on (faceCenter.x, mouthY).
#   nose   2:1 canvas, width = parts.nose.scale·u, centered on (faceCenter.x, cheekY).
#   face   1:1 canvas, width = parts.face.scale·u, centered on (faceCenter.x, eyeY) (glasses over the eyes,
#          the monocle over the right eye, the mustache drawn low in its canvas so it lands above the mouth).
#   head   1:1 canvas, width = headTop.w·parts.head.scale·u, content bottom-aligned; the canvas bottom sits
#          18% of its height BELOW headTop.y (the hat overlaps the top of the head) — the halo floats high.
#   neck   1:1 canvas (bow tie, scarf, chain), width = parts.neck.scale·u, centered on (faceCenter.x, neckY).
#   back   (cape, wings) a full u×u canvas drawn under the body, same box as the body.
#   python3 compose-avatar.py
import json, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
CUT, SRC, OUT = (os.path.join(HERE, d) for d in ('cut', 'src', 'parts'))
os.makedirs(OUT, exist_ok=True)
U = 1024          # body square
PW = 512          # part canvas width


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def place(img, cw, ch, frac_w, cx=0.5, cy=0.5, bottom=None, max_h=0.98):
    """img scaled to frac_w of the canvas width (and ≤ max_h of its height), centered at (cx, cy) or bottom-aligned."""
    img = trim(img.convert('RGBA'))
    w = frac_w * cw
    h = w * img.height / img.width
    if h > max_h * ch:
        h = max_h * ch
        w = h * img.width / img.height
    img = img.resize((max(1, round(w)), max(1, round(h))), Image.LANCZOS)
    out = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
    x = round(cx * cw - img.width / 2)
    y = round(bottom * ch - img.height) if bottom is not None else round(cy * ch - img.height / 2)
    out.alpha_composite(img, (x, y))
    return out


# ── Bodies ───────────────────────────────────────────────────────────────────
BODIES = ['classic', 'tall', 'wide', 'blob', 'bean', 'star']
anchors = {}
for b in BODIES:
    art = trim(Image.open(os.path.join(SRC, f'body-{b}.png')).convert('RGBA'))
    s = min(0.94 * U / art.width, 0.94 * U / art.height)
    art = art.resize((round(art.width * s), round(art.height * s)), Image.LANCZOS)
    canvas = Image.new('RGBA', (U, U), (0, 0, 0, 0))
    ox, oy = (U - art.width) // 2, round(0.97 * U) - art.height
    canvas.alpha_composite(art, (ox, oy))
    canvas.save(os.path.join(OUT, f'art-av-body-{b}.png'))
    a = np.asarray(canvas.getchannel('A')) > 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min() / U, ys.max() / U
    H = bot - top
    # The main body: feet are the bottom ~11% (star: the lower points carry on, feet ~9%).
    mb = bot - H * (0.09 if b == 'star' else 0.115)
    mh = mb - top

    def row_span(fy):
        r = a[min(U - 1, int(fy * U))]
        xx = np.nonzero(r)[0]
        return xx.min() / U, xx.max() / U

    # width of the main body above the arms (arms start ~45% down)
    l, r = row_span(top + mh * (0.2 if b != 'star' else 0.42))
    cxe = (l + r) / 2
    mw = r - l
    tl, tr = row_span(top + mh * 0.015)      # head top center (bean leans)
    face = {
        'classic': (0.33, 0.47, 0.53, 0.60, 0.34), 'tall': (0.26, 0.37, 0.42, 0.50, 0.40),
        'wide': (0.33, 0.48, 0.55, 0.62, 0.32), 'blob': (0.35, 0.49, 0.55, 0.62, 0.32),
        'bean': (0.30, 0.42, 0.47, 0.55, 0.36), 'star': (0.40, 0.50, 0.555, 0.61, 0.24),
    }[b]   # eye, cheek, mouth, letter top, letter height — fractions of the main body height
    ey, chy, my, lt, lh = face
    lw = min(0.6 * mw, 0.42) if b != 'star' else 0.3 * mw
    eye_l, eye_r = row_span(top + mh * ey)
    fx = (eye_l + eye_r) / 2 if b == 'bean' else cxe
    anchors[b] = {
        'faceCenter': [round(fx, 4), round(top + mh * (ey + my) / 2, 4)],
        'eyeY': round(top + mh * ey, 4), 'mouthY': round(top + mh * my, 4), 'cheekY': round(top + mh * chy, 4),
        'headTop': {'x': round((tl + tr) / 2, 4), 'y': round(top, 4), 'w': round(min(0.86 * mw, 0.7) if b != 'star' else 0.36, 4)},
        'neckY': round(top + mh * (lt - 0.015), 4),
        'letterBox': [round(fx - lw / 2, 4), round(top + mh * lt, 4), round(lw, 4), round(mh * lh, 4)],
    }
    print(b, anchors[b])

# ── Parts ────────────────────────────────────────────────────────────────────
SCALE = {'eyes': 0.37, 'mouth': 0.19, 'nose': 0.46, 'face': 0.40, 'neck': 0.32, 'head': 1.0}
cut = lambda n: Image.open(os.path.join(CUT, n + '.png'))
EYES = {'beady': 0.78, 'happy': 0.8, 'sparkly': 0.82, 'sleepy': 0.82, 'wink': 0.8, 'hearts': 0.84, 'stars': 0.86,
        'glasses': 1.0, 'cyclops': 0.44}
for k, f in EYES.items():
    place(cut(f'eyes-{k}'), PW, PW // 2, f).save(os.path.join(OUT, f'art-av-eyes-{k}.png'))
MOUTHS = {'smile': 0.9, 'grin': 0.86, 'tongue': 0.84, 'o': 0.42, 'cat': 0.8, 'toothy': 0.9, 'smirk': 0.82, 'tiny': 0.55, 'gasp': 0.46}
for k, f in MOUTHS.items():
    place(cut(f'mouth-{k}'), PW, PW, f).save(os.path.join(OUT, f'art-av-mouth-{k}.png'))
NOSES = {'button': 0.15, 'red': 0.24, 'blush': 0.96, 'freckles': 0.86}
for k, f in NOSES.items():
    place(cut(f'nose-{k}'), PW, PW // 2, f).save(os.path.join(OUT, f'art-av-nose-{k}.png'))
# face extras (canvas = 0.40u centered on eyeY); classic geometry sets the offsets
c = anchors['classic']
eye_dx = 0.33 * EYES['beady'] * SCALE['eyes']                       # an eye's center from the face center, in u
must_dy = ((c['cheekY'] + c['mouthY']) / 2 - c['eyeY']) / SCALE['face']
place(cut('acc-heart-glasses'), PW, PW, 1.0).save(os.path.join(OUT, 'art-av-acc-heart-glasses.png'))
place(cut('acc-mustache'), PW, PW, 0.62, cy=0.5 + must_dy).save(os.path.join(OUT, 'art-av-acc-mustache.png'))
mono = trim(cut('acc-monocle').convert('RGBA'))
mw_ = 0.34 * PW
mono_s = place(mono, PW, PW, 0.34, cx=0.5 + eye_dx / SCALE['face'], cy=0.5 + (mono.height / mono.width * 0.34) / 2 - 0.34 * 0.47)
mono_s.save(os.path.join(OUT, 'art-av-acc-monocle.png'))
# neck front
NECK = {'bowtie': (0.62, 0.64), 'chain': (0.96, 0.74), 'scarf': (1.0, 0.62)}   # (width, content center y): neck pieces hang below neckY
for k, (f, cy) in NECK.items():
    place(cut(f'acc-{k}'), PW, PW, f, cy=cy).save(os.path.join(OUT, f'art-av-acc-{k}.png'))
# hats: bottom-aligned on a square canvas
HATS = {'crown': 0.74, 'party': 0.5, 'beanie': 0.98, 'sprout': 0.5, 'nightcap': 1.0, 'headphones': 1.0, 'bow': 0.62,
        'wizard': 0.88, 'pirate': 1.0, 'cowboy': 1.0, 'chef': 0.8, 'grad': 0.96, 'flower': 0.5, 'tophat': 0.74,
        'propeller': 0.86, 'catears': 0.96, 'bunnyears': 0.82, 'tiara': 0.8, 'viking': 1.0, 'sweatband': 1.0}
for k, f in HATS.items():
    place(cut(f'acc-{k}'), PW, PW, f, bottom=1.0).save(os.path.join(OUT, f'art-av-acc-{k}.png'))
place(cut('acc-halo'), PW, PW, 0.78, cy=0.22).save(os.path.join(OUT, 'art-av-acc-halo.png'))
# back: full body square
place(cut('acc-cape'), U, U, 0.96, bottom=0.95).save(os.path.join(OUT, 'art-av-acc-cape.png'))
place(cut('acc-wings'), U, U, 1.0, cy=0.42).save(os.path.join(OUT, 'art-av-acc-wings.png'))

art_names = sorted(f[:-4] for f in os.listdir(OUT) if f.startswith('art-av-') and f.endswith('.png'))
manifest = {
    'version': 1,
    'placeholder': False,
    'frame': 'square',
    'note': ('Real anchors (night art 2026-10-03, docs/design/brand/avatar/compose-avatar.py). Every coordinate is a 0-1 '
             'fraction of the body art SQUARE (u x u), the same box the body art fills on every platform. Part widths '
             '= scale x u (head: headTop.w x scale x u). Hats: the canvas bottom sits 18% of its height below headTop.y. '
             'Back accessories (cape, wings) fill the body square under the body.'),
    'bodies': anchors,
    'parts': {
        'eyes': {'slot': 'eyeY', 'scale': SCALE['eyes']},
        'mouth': {'slot': 'mouthY', 'scale': SCALE['mouth']},
        'nose': {'slot': 'cheekY', 'scale': SCALE['nose']},
        'head': {'slot': 'headTop', 'scale': SCALE['head']},
        'face': {'slot': 'eyeY', 'scale': SCALE['face']},
        'neck': {'slot': 'neckY', 'scale': SCALE['neck']},
    },
    'art': art_names,
}
for dst in ['packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
            'apps/android/app/src/main/assets/avatar-parts.json']:
    with open(os.path.join(REPO, dst), 'w') as fh:
        json.dump(manifest, fh, indent=2)
        fh.write('\n')
print(len(art_names), 'parts; manifest written')
