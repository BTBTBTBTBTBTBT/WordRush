#!/usr/bin/env python3
"""Ship the button family sprites ×3 (ship-labels.py conventions): out/fam-*.png → art-fam-*
  web apps/web/public/art/<name>.webp · Android res/drawable-nodpi/<name_>.webp · iOS Assets.xcassets/<name>.imageset PNG
Prints the web ART_SIZE lines."""
import json, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
SHIP = ['lm-frost', 'lm-frost-pressed', 'lm-key'] + [f'ic-{n}' for n in [
    'delete', 'shuffle', 'enter', 'hint', 'eye', 'flag', 'check', 'undo', 'next', 'refresh', 'sparkles', 'pencil', 'erase', 'xmark', 'play', 'chart']] \
    + ['cic-close', 'cic-info', 'cic-gem']


def ship(name, im):
    # Light maps carry soft alpha gradients: lossless WebP keeps them exact (they're small).
    lossless = '-lm-' in name
    im.save(os.path.join(WEB, f'{name}.webp'), 'WEBP', lossless=lossless, quality=92, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', lossless=lossless, quality=92, method=6)
    iset = os.path.join(IOS, f'{name}.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, f'{name}.png'), optimize=True)
    json.dump({'images': [{'filename': f'{name}.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}},
              open(os.path.join(iset, 'Contents.json'), 'w'), indent=2)


for s in SHIP:
    im = Image.open(os.path.join(HERE, 'out', f'fam-{s}.png')).convert('RGBA')
    ship(f'art-fam-{s}', im)
    print(f"  'art-fam-{s}': [{im.width}, {im.height}],")
