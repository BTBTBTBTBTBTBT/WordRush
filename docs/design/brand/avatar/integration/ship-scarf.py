#!/usr/bin/env python3
"""Ship the integrated scarf (pieces.scarf: a knit band warped along each body's wrap line between the mouth
and the letter, the tail down the side) as PER-BODY art: art-av-acc-scarf-<body> + its rect in body units,
written into avatar-parts.json items['acc:scarf'].perBody (core avatarLayout draws that art at that rect).
Founder rule: a part never covers the face or the letter (fitcheck: face/letter <= 1%).
  python3 docs/design/brand/avatar/integration/ship-scarf.py
SUPERSEDED (10-06): the scarf ships as per-body `pieces` from ship-rules.py; running this would bring back the
one-layer `perBody` art and its old fit.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from rig import U, M, MAN, REPO, Image  # noqa: E402
from pieces import scarf  # noqa: E402
from fitcheck import check  # noqa: E402

if '--force' not in sys.argv:
    sys.exit('superseded by ship-rules.py (10-06); pass --force to run anyway')
PARTS = os.path.join(os.path.dirname(HERE), 'parts')
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
MANIFESTS = [os.path.join(REPO, p) for p in ('packages/core/src/avatar-parts.json', 'apps/ios/Wordocious/Resources/avatar-parts.json',
                                             'apps/android/app/src/main/assets/avatar-parts.json')]
per = {}
for body in MAN['bodies']:
    L = scarf(body)
    res, fails = check(body, L)
    assert not fails, (body, fails)
    layers = L['front']
    comp = Image.new('RGBA', layers[0].size, (0, 0, 0, 0))
    for im in layers:
        comp.alpha_composite(im)
    box = comp.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    piece = comp.crop(box)
    s = 320 / max(piece.size)            # ~ the shipped part resolution
    piece = piece.resize((max(1, round(piece.width * s)), max(1, round(piece.height * s))), Image.LANCZOS)
    name = f'art-av-acc-scarf-{body}'
    piece.save(os.path.join(PARTS, name + '.png'))
    piece.save(os.path.join(WEB, name + '.webp'), 'WEBP', quality=92, method=6)
    piece.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=92, method=6)
    iset = os.path.join(IOS, name + '.imageset'); os.makedirs(iset, exist_ok=True)
    piece.save(os.path.join(iset, name + '.png'), optimize=True)
    json.dump({'images': [{'filename': name + '.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}},
              open(os.path.join(iset, 'Contents.json'), 'w'), indent=2)
    per[body] = [round((box[0] - M) / U, 4), round((box[1] - M) / U, 4), round((box[2] - box[0]) / U, 4), round((box[3] - box[1]) / U, 4)]
    print(body, per[body], {k: round(v, 3) for k, v in res.items()})
for p in MANIFESTS:
    d = json.load(open(p))
    d['items']['acc:scarf']['perBody'] = per
    with open(p, 'w') as f:
        json.dump(d, f, indent=1, ensure_ascii=False)
        f.write('\n')
