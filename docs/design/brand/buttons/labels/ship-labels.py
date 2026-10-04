# Ship the cast-button label ART (FINISH_SPEC BJ15) ×3 with ship-art.py's conventions:
#   buttons/labels/<slug>.png → art-btnlabel-<slug>
#   web apps/web/public/art/<name>.webp · Android res/drawable-nodpi/<name_>.webp · iOS Assets.xcassets/<name>.imageset PNG
# Every label is trimmed to its letter bounds (alpha > 24) and normalized to the SAME height (LABEL_PX), so all
# labels render at one cap height (0.42 × the button height) on every platform. Prints the size table for
# web ART_SIZE and the per-platform slug maps (text → slug, aspect).
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
LABEL_PX = 96   # ≥ the largest cap at @3x (l = 56 pt × 0.42 × 3 ≈ 71 px): always DOWN-sampled, so always crisp


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def ship(name, im):
    im.save(os.path.join(WEB, f'{name}.webp'), 'WEBP', quality=92, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=92, method=6)
    iset = os.path.join(IOS, f'{name}.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, f'{name}.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': f'{name}.png', 'idiom': 'universal'}],
                   'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


spec = json.load(open(os.path.join(HERE, 'labels.json')))
rows = [r for sheet in spec['sheets'] for r in sheet]
out = []
for slug, text in rows:
    src = os.path.join(HERE, f'{slug}.png')
    if not os.path.exists(src):
        print('missing', slug, file=sys.stderr)
        continue
    im = trim(Image.open(src).convert('RGBA'))
    w = round(im.width * LABEL_PX / im.height)
    im = im.resize((w, LABEL_PX), Image.LANCZOS)
    ship(f'art-btnlabel-{slug}', im)
    out.append((slug, text, w))
key = lambda t: ''.join(c for c in t.upper() if c.isalnum())
print('// web ART_SIZE')
for slug, text, w in out:
    print(f"  'art-btnlabel-{slug}': [{w}, {LABEL_PX}],")
print('// map: key slug aspect')
for slug, text, w in out:
    print(key(text), slug, round(w / LABEL_PX, 4))
print('shipped', len(out))
