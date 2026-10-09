#!/usr/bin/env python3
"""Living-wallpaper sprites (FRIDAY-QUEUE items 15 + 25): slice the ChatGPT cutout sheets
(docs/design/brand/2.8/walls/out) into single solid sprites (connected alpha components, glows dropped:
the soft parts are drawn in code) and write them to web public/art, iOS Resources, Android drawable-nodpi.
Run from the repo root: python3 scripts/ambient-sprites.py"""
import os
from collections import deque
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SRC = os.path.join(ROOT, 'docs/design/brand/2.8/walls/out')
WEB = os.path.join(ROOT, 'apps/web/public/ambient')
ANDROID = os.path.join(ROOT, 'apps/android/app/src/main/res/drawable-nodpi')
IOS = os.path.join(ROOT, 'apps/ios/Wordocious/Resources/Assets.xcassets')
CONTENTS = '{\n  "images": [\n    {\n      "filename": "%s.png",\n      "idiom": "universal"\n    }\n  ],\n  "info": {\n    "author": "xcode",\n    "version": 1\n  }\n}'


def components(im, min_area):
    w, h = im.size
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    px = a.load()
    seen = bytearray(w * h)
    out = []
    for y in range(h):
        for x in range(w):
            if px[x, y] and not seen[y * w + x]:
                q = deque([(x, y)]); seen[y * w + x] = 1
                x0 = x1 = x; y0 = y1 = y; n = 0
                while q:
                    cx, cy = q.popleft(); n += 1
                    x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1; q.append((nx, ny))
                if n >= min_area:
                    out.append((n, (x0, y0, x1 + 1, y1 + 1)))
    return sorted(out, reverse=True)


def save(name, im, maxside):
    im = im.copy(); im.thumbnail((maxside, maxside), Image.LANCZOS)
    os.makedirs(WEB, exist_ok=True); os.makedirs(ANDROID, exist_ok=True)
    im.save(os.path.join(WEB, name + '.webp'), 'WEBP', quality=90, method=6)
    im.save(os.path.join(ANDROID, 'ambient_' + name.replace('-', '_') + '.webp'), 'WEBP', quality=90, method=6)
    d = os.path.join(IOS, 'ambient-' + name + '.imageset'); os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, 'ambient-' + name + '.png'), optimize=True)
    open(os.path.join(d, 'Contents.json'), 'w').write(CONTENTS % ('ambient-' + name))


def slice_sheet(sheet, prefix, count, min_area, maxside):
    im = Image.open(os.path.join(SRC, f'cut-{sheet}.png')).convert('RGBA')
    comps = components(im, min_area)[:count]
    for i, (_, box) in enumerate(sorted(comps, key=lambda c: c[1][0])):
        save(f'{prefix}-{i + 1}', im.crop(box), maxside)
    print(sheet, len(comps), 'sprites')


slice_sheet('bubbles', 'bubble', 4, 600, 128)
slice_sheet('leaves', 'leaf', 4, 700, 128)
for sheet, name, side in (('bat', 'bat', 160), ('witch-broom', 'witch', 200), ('fog', 'fog', 320)):
    im = Image.open(os.path.join(SRC, f'cut-{sheet}.png')).convert('RGBA')
    save(name, im.crop(im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()), side)
print('ok')
