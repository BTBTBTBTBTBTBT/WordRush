#!/usr/bin/env python3
"""2.8 widget art (FRIDAY-QUEUE items 28 / 48 / 24): wordmarks, headline, streak trophies, flawless ring and the
Halloween motifs, copied from docs/design/brand/2.8 into WordociousWidget/Assets.xcassets as image sets.
sync-widget-assets.sh rebuilds that catalog from scratch, so it calls this at the end. Run from apps/ios."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IOS = os.path.normpath(os.path.join(HERE, '..'))
D = os.path.normpath(os.path.join(IOS, '../../docs/design/brand/2.8')) + '/'
A = os.path.join(IOS, 'WordociousWidget/Assets.xcassets') + '/'

CONTENTS = '{\n  "images": [\n    {\n      "filename": "%s.png",\n      "idiom": "universal"\n    }\n  ],\n  "info": {\n    "author": "xcode",\n    "version": 1\n  }\n}'


def add(name, src):
    d = A + name + '.imageset'
    os.makedirs(d, exist_ok=True)
    Image.open(src).convert('RGBA').save(d + '/' + name + '.png', optimize=True)
    open(d + '/Contents.json', 'w').write(CONTENTS % name)


for size in ('small', 'medium', 'large'):
    for v in ('normal', 'halloween', 'halloween-orange'):
        add(f'widget-wordmark-{size}-{v}', D + f'widgets/out/wordmark-{size}-{v}.png')
for v in ('normal', 'halloween', 'halloween-orange'):
    add(f'widget-headline-{v}', D + f'widgets/out/headline-todays-dailies-{v}.png')
for t in (3, 5, 7, 10, 30):
    add(f'streak-trophy-{t}', D + f'streaks/out/trophy-{t}.png')
add('streak-flawless-ring', D + 'streaks/out/flawless-ring.png')
for m in ('moon-bats', 'bat-flock', 'cobweb', 'haunted-hill', 'pumpkin-row', 'stars-clouds'):
    add(f'widget-halloween-{m}', D + f'widgets/halloween/{m}.png')
print('2.8 widget art synced')
