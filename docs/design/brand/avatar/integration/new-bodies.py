#!/usr/bin/env python3
"""Add the 18 new bodies (FRIDAY-QUEUE item 50, art/driver docs/design/brand/2.8/bodies/draft1024-hires).

  python3 integration/new-bodies.py            # all 18
  python3 integration/new-bodies.py heart egg  # some

Step 1 of INTEGRATION.md "How to add a new body", automated:
  - parts/art-av-body-<id>.png          the 1024² white body (copied from docs/design/brand/2.8/bodies/draft1024-hires)
  - the body's manifest entry           FACE + LETTER anchors (the body's design: DESIGN below, a fraction of its height per
                                        row) clamped by the measured width of the torso (arms / ears / stems opened away),
                                        plus the geometry the core layout reads (headTop, shoulderW, back, cape, hand,
                                        bounds) measured from the art. Everything the items need beyond that is measured
                                        by landmarks.py afterwards.
  - the body art at 640² on web / iOS / Android (ship-integrated.save_art) + lib/art.ts ART_SIZE + the manifest `art` list.
Then: landmarks.py <ids> → rig-body.py <ids> --ship → ship-rules.py --bodies <ids> → audit guards (INTEGRATION.md).
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
REPO = os.path.abspath(os.path.join(AV, '..', '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, AV)
import numpy as np  # noqa: E402
import cv2  # noqa: E402
from PIL import Image  # noqa: E402
from scipy import ndimage  # noqa: E402

SRC = os.path.join(REPO, 'docs', 'design', 'brand', '2.8', 'bodies', 'draft1024-hires')
PARTS = os.path.join(AV, 'parts')
MANIFESTS = [os.path.join(REPO, p) for p in (
    'packages/core/src/avatar-parts.json',
    'apps/ios/Wordocious/Resources/avatar-parts.json',
    'apps/android/app/src/main/assets/avatar-parts.json')]
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
ART_TS = os.path.join(REPO, 'apps', 'web', 'lib', 'art.ts')

S = 1024
# Per body: (eye row, mouth row, letter top, letter bottom) as a fraction of the body's height (bbox top → feet bottom),
# the 12 shipped bodies' recipe (classic: eyes .29, mouth .47, letter .53–.83) bent to each new silhouette: where the
# shape is narrow up top (cone, bell, triangle, bunny) the face sits lower; where the lobe is (moon) it sits in the lobe.
DESIGN = {
    'heart':    (.30, .45, .50, .78),
    # 'moon' (.40, .55, .60, .84): HELD BACK: the crescent's right mitten hangs from the lower horn and landmarks.py finds no
    # notch pair for it (no arm = no rig). Needs a hand-placed mitten (LANDMARK_OVERRIDES) or a redraw with a clear arm.
    'egg':      (.32, .48, .54, .84),
    'bell':     (.40, .54, .60, .84),
    'triangle': (.50, .61, .66, .88),
    'diamond':  (.40, .52, .57, .80),
    'shield':   (.28, .44, .50, .80),
    'burst':    (.30, .46, .52, .80),
    'flower':   (.32, .48, .54, .82),
    'gumdrop':  (.30, .46, .52, .82),
    'can':      (.28, .44, .50, .84),
    'potato':   (.33, .49, .55, .82),
    'catear':   (.34, .49, .55, .84),
    'bunnyear': (.44, .58, .63, .86),
    'pumpkin':  (.37, .52, .58, .84),
    'ghost':    (.30, .46, .52, .80),
    'cone':     (.55, .65, .69, .87),
    'bat':      (.34, .50, .56, .84),
}
NEW = list(DESIGN)
# Free in season, then buy / Pro / earn like other seasonal items (item 50): the Halloween shapes.
SEASONAL = {'pumpkin': 'halloween', 'ghost': 'halloween', 'bat': 'halloween', 'cone': 'halloween'}
# Where the mittens sit, as a fraction of the body's height (default .60; the bell / cone / triangle hang them lower).
HAND_Y = {'bell': .57, 'cone': .66, 'triangle': .62, 'burst': .56, 'heart': .58, 'bunnyear': .62, 'moon': .58}
PRIOR = {}
FACE_W_MAX, LETTER_W_MAX, LETTER_H_MAX = 0.5844, 0.42, 0.2457     # classic's: never bigger
FACE_FRAC, LETTER_FRAC = 0.74, 0.62                                  # of the torso width at that row


def core_mask(A):
    """The torso: the silhouette with the mittens, feet, ears, stems and wings opened away."""
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * 62 + 1, 2 * 62 + 1))
    core = cv2.morphologyEx(A.astype(np.uint8), cv2.MORPH_OPEN, k) > 0
    lab, n = ndimage.label(core)
    if n > 1:
        sizes = ndimage.sum(core, lab, range(1, n + 1))
        core = lab == (1 + int(np.argmax(sizes)))
    return core


def widest_run(row):
    """The row's extent (first to last torso pixel): a gap between two lobes (the flower's bottom) is still torso."""
    xs = np.nonzero(row)[0]
    if len(xs) == 0:
        return 0, 0.5
    return (xs[-1] - xs[0] + 1) / S, (xs[0] + xs[-1]) / 2 / S


def width_at(core, y):
    return widest_run(core[int(round(y * S))])


def build(bid):
    A = np.asarray(Image.open(os.path.join(SRC, f'art-av-body-{bid}.png')).convert('RGBA').getchannel('A')) > 128
    ys, xs = np.nonzero(A)
    x0, x1, y0, y1 = xs.min() / S, (xs.max() + 1) / S, ys.min() / S, (ys.max() + 1) / S
    H = y1 - y0
    core = core_mask(A)
    cys = np.nonzero(core.any(1))[0]
    ct = cys.min() / S                                   # the torso's top (ears / stem / nub opened away)
    eye, mouth, lt, lb = (y0 + f * H for f in DESIGN[bid])
    eye, mouth = max(eye, ct + 0.06), max(mouth, ct + 0.17)
    ew, ecx = width_at(core, eye)
    mw, mcx = width_at(core, mouth)
    fx = (ecx + mcx) / 2
    fw = round(min(FACE_W_MAX, FACE_FRAC * min(ew, mw)), 4)
    # the letter: the narrowest torso row across its box, centered on the torso there
    rows = [width_at(core, lt + (lb - lt) * t) for t in (0.1, 0.5, 0.9)]
    lw = min(r[0] for r in rows)
    lcx = float(np.mean([r[1] for r in rows]))
    LW = round(min(LETTER_W_MAX, LETTER_FRAC * lw), 4)
    LH = round(min(LETTER_H_MAX, lb - lt), 4)
    letter = [round(lcx - LW / 2, 4), round(lt, 4), LW, LH]
    headw, headx = width_at(core, ct + 0.3 * (eye - ct))
    neck = round((mouth + lt) / 2 + 0.008, 4)
    shw, _ = width_at(core, neck)
    # the hands: the outline notches are landmarks.py's job; a first guess at the mittens (the body's widest rows near
    # the arm height) is enough for the manifest entry — landmarks.py replaces it (--write-hands)
    hy = round(y0 + HAND_Y.get(bid, 0.60) * H, 4)
    hand = {'x': round(x1 - 0.04, 4), 'y': hy}
    rowc = core[int(hy * S)]
    cx_ = np.nonzero(rowc)[0]
    cl, cr = (cx_.min() / S, (cx_.max() + 1) / S) if len(cx_) else (x0 + 0.1, x1 - 0.1)
    if bid == 'moon':      # the crescent's open side has no mitten bulge on the right: only the lobe's left hand
        PRIOR[bid] = {'L': [0.14, 0.60], 'R': [0.83, 0.62]}   # read off the art: the right mitten hangs from the lower horn
    else:
        PRIOR[bid] = {'L': [round(cl - 0.03, 4), hy], 'R': [round(cr + 0.03, 4), hy]}
    ent = {
        'faceCenter': [round(fx, 4), round((eye + mouth) / 2, 4)],
        'eyeY': round(eye, 4), 'mouthY': round(mouth, 4), 'cheekY': round(eye + 0.74 * (mouth - eye) - 0.0, 4),
        'headTop': {'x': round(headx, 4), 'y': round(ct, 4), 'w': round(headw, 4)},
        'neckY': neck,
        'letterBox': letter,
        'face': {'x': round(fx, 4), 'w': fw},
        'mustacheY': round(eye + 0.9 * (mouth - eye), 4),
        'shoulderW': round(shw, 4),
        'back': {'x': round((x0 + x1) / 2, 4), 'y': round(y0 + 0.336 * H, 4), 'w': round(x1 - x0, 4)},
        'cape': {'y': round(y0 + 0.159 * H, 4)},
        'hand': hand,
        'bounds': [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)],
        'floor': round(y1 - 0.0006, 4),
    }
    if bid in SEASONAL:
        ent['season'] = SEASONAL[bid]
    return ent


def save_art(name, im):
    im.save(os.path.join(WEB, name + '.webp'), 'WEBP', quality=90, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=90, method=6)
    d = os.path.join(IOS, name + '.imageset')
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, name + '.png'), optimize=True)
    with open(os.path.join(d, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': name + '.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('-')] or NEW
    ents = {}
    for bid in ids:
        src = Image.open(os.path.join(SRC, f'art-av-body-{bid}.png')).convert('RGBA')
        src.save(os.path.join(PARTS, f'art-av-body-{bid}.png'))
        ents[bid] = build(bid)
        save_art(f'art-av-body-{bid}', src.resize((640, 640), Image.LANCZOS))
        print(bid, json.dumps({k: ents[bid][k] for k in ('eyeY', 'mouthY', 'face', 'letterBox')}))
    for p in MANIFESTS:
        d = json.load(open(p))
        for bid, ent in ents.items():
            old = d['bodies'].get(bid, {})
            keep = {k: v for k, v in old.items() if k in ('overrides', 'hands', 'shoulderY', 'wrap')}   # re-runs keep fits
            d['bodies'][bid] = {**ent, **keep}
        d['art'] = sorted(set(d['art']) | {f'art-av-body-{b}' for b in ents})
        with open(p, 'w') as f:
            json.dump(d, f, indent=1, ensure_ascii=False)
            f.write('\n')
    hp = os.path.join(HERE, 'hands-prior.json')
    cur = json.load(open(hp)) if os.path.exists(hp) else {}
    cur.update(PRIOR)
    json.dump(cur, open(hp, 'w'), indent=1)
    # lib/art.ts ART_SIZE (web)
    src = open(ART_TS).read()
    for bid in ents:
        line = f"  'art-av-body-{bid}': [640, 640],\n"
        if line not in src:
            anchor = "  'art-av-body-hex': [640, 640],\n"
            src = src.replace(anchor, anchor + line, 1)
    open(ART_TS, 'w').write(src)


if __name__ == '__main__':
    main()
