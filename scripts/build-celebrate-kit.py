#!/usr/bin/env python3
"""Celebration kit (2.8 item 7): docs/design/brand/2.8/celebrate/out/*.png -> the three apps.
  web      apps/web/public/art/celebrate-<name>.webp
  Android  apps/android/app/src/main/res/drawable-nodpi/celebrate_<name>.webp
  iOS      apps/ios/Wordocious/Resources/Assets.xcassets/celebrate-<name>.imageset (PNG)
Props only (the cast / your mascot are composited in code). Sized to <= 320 px on the long side (the popup draws them <= 200 pt)."""
import json
import os
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'docs/design/brand/2.8/celebrate/out')
NAMES = ['burst-party', 'burst-gold', 'streamers-pair', 'sparkle-sweep', 'crown-gold', 'seal-gold',
         'h-bats', 'h-broom', 'h-candy-burst', 'h-pumpkin-glow', 'h-streamers', 'h-witch-hat']
MAXSIDE = 320

for n in NAMES:
    im = Image.open(os.path.join(SRC, f'{n}.png')).convert('RGBA')
    k = min(1.0, MAXSIDE / max(im.size))
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(os.path.join(ROOT, 'apps/web/public/art', f'celebrate-{n}.webp'), 'WEBP', quality=90, method=6)
    im.save(os.path.join(ROOT, 'apps/android/app/src/main/res/drawable-nodpi', f'celebrate_{n.replace("-", "_")}.webp'), 'WEBP', quality=90, method=6)
    d = os.path.join(ROOT, 'apps/ios/Wordocious/Resources/Assets.xcassets', f'celebrate-{n}.imageset')
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, f'celebrate-{n}.png'), optimize=True)
    json.dump({'images': [{'filename': f'celebrate-{n}.png', 'idiom': 'universal'}], 'info': {'author': 'xcode', 'version': 1}},
              open(os.path.join(d, 'Contents.json'), 'w'), indent=2)
print(len(NAMES), 'props')
