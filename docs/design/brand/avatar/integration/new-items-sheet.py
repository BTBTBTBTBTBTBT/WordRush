#!/usr/bin/env python3
"""Contact sheet of the shipped 2.8 items on bodies, through the REAL core layout (avatar-layout.ts via dump-layout.ts) and the
python renderer: rows = items, columns = bodies. Look at it before shipping a pack.

  python3 integration/new-items-sheet.py goth [body,body,…]      → integration/out/items/<pack>.jpg
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
sys.path.insert(0, HERE); sys.path.insert(0, AV)
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
import audit  # noqa: E402
from avatar_draw import render  # noqa: E402

BODIES = ['classic', 'tall', 'wide', 'star', 'pear', 'heart', 'egg', 'bell', 'triangle', 'can', 'cone', 'bat', 'moon', 'ghost']
T = 150


def main():
    pack = sys.argv[1]
    bodies = sys.argv[2].split(',') if len(sys.argv) > 2 else BODIES
    spec = json.load(open(os.path.join(HERE, 'new-items-spec.json')))
    items = [s for s in spec['items'] if s['pack'] == pack]
    cfgs, cells = [], []
    for s in items:
        for b in bodies:
            c = {'v': '1', 'body': b, 'color': 'purple', 'pattern': 'solid', 'eyes': 'beady', 'mouth': 'smile', 'display': 'mascot', s['field']: s['id']}
            cfgs.append(c)
            cells.append((s, b))
    out = audit.dump(cfgs)['out']
    sheet = Image.new('RGB', (T * len(bodies) + 190, T * len(items) + 24), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for j, b in enumerate(bodies):
        d.text((190 + j * T + 6, 6), b, fill=(30, 30, 30))
    for i, s in enumerate(items):
        d.text((6, 24 + i * T + T // 2), s['id'].replace(pack + '-', '') + ('  (Pro)' if s['pro'] else ''), fill=(30, 30, 30))
    for k, ((s, b), lay) in enumerate(zip(cells, out)):
        i, j = items.index(s), bodies.index(b)
        im = render(lay, T, bg=(241, 239, 250, 255), letter='A').convert('RGB')
        sheet.paste(im, (190 + j * T, 24 + i * T))
    os.makedirs(os.path.join(HERE, 'out', 'items'), exist_ok=True)
    p = os.path.join(HERE, 'out', 'items', f'{pack}.jpg')
    sheet.save(p, quality=88)
    print(p)


if __name__ == '__main__':
    main()
