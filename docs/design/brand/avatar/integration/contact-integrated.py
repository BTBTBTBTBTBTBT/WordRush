#!/usr/bin/env python3
"""Contact sheets of the SHIPPED integrated parts (10-05 "not bolted on" gate): every rebuilt / new part on all 12
bodies, composed from the shipped per-body layer art (apps/web/public/art) at the manifest rects, in the manifest
layer order, exactly like the renderers draw it (letter after the 'under' layers).
  python3 docs/design/brand/avatar/integration/contact-integrated.py OUT_DIR
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.dirname(HERE))
from PIL import Image, ImageDraw, ImageFont  # noqa: E402
from rig import U, M, CW, REPO, body_art, tint, draw_letter, place_part, tile  # noqa: E402

MAN = json.load(open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-parts.json')))
ART = os.path.join(REPO, 'apps', 'web', 'public', 'art')
ORDER = MAN['layerOrder']
COLS = ['purple', 'teal', 'amber', 'pink', 'sky', 'green', 'orange', 'red', 'slate', 'blue', 'mint', 'lilac']
ACC = {'backpack': '#f97316', 'supercape': '#2563eb'}
T = 150
BG = (241, 239, 250, 255)


def compose(body, color, key, letter='A'):
    b = MAN['bodies'][body]
    it = MAN['items'][key]
    kind, pid = key.split(':')
    pcs = it['pieces'].get(body, [])
    c = Image.new('RGBA', (CW, CW), (0, 0, 0, 0))

    def draw(layer, x, y, w, h):
        im = Image.open(os.path.join(ART, f'art-av-{kind}-{pid}-{body}-{layer}.webp')).convert('RGBA')
        im = im.resize((max(1, round(w * U)), max(1, round(h * U))), Image.LANCZOS)
        if pid in ACC:
            im = tint(im, ACC[pid])
        c.alpha_composite(im, (round(M + x * U), round(M + y * U)))
    layers = sorted(pcs, key=lambda p: ORDER.index(p[0]))
    for p in [p for p in layers if p[0] == 'back']:
        draw(*p)
    c.alpha_composite(tint(body_art(body), color))
    for p in [p for p in layers if p[0] == 'under']:
        draw(*p)
    draw_letter(c, b, letter)
    place_part(c, 'eyes:beady', b)
    place_part(c, 'mouth:smile', b)
    for p in [p for p in layers if p[0] not in ('back', 'under')]:
        draw(*p)
    return c


def main(out):
    os.makedirs(out, exist_ok=True)
    keys = [k for k, v in MAN['items'].items() if 'pieces' in v]
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 20)
    per = 7
    for s in range(0, len(keys), per):
        chunk = keys[s:s + per]
        sheet = Image.new('RGBA', (T * 12 + 130, T * len(chunk)), BG)
        d = ImageDraw.Draw(sheet)
        for r, key in enumerate(chunk):
            d.text((8, r * T + T // 2 - 10), key.split(':')[-1] if not key.startswith('brows') else key, font=font, fill=(40, 20, 60, 255))
            for j, body in enumerate(MAN['bodies']):
                letter = 'AWMRSOBKEQZH'[j]
                t = tile(compose(body, COLS[j], key, letter), T, bg=BG) if key in MAN['items'] and body in MAN['items'][key]['pieces'] else Image.new('RGBA', (T, T), (225, 222, 232, 255))
                sheet.alpha_composite(t, (130 + j * T, r * T))
        sheet.convert('RGB').save(os.path.join(out, f'sheet-{s // per + 1}.png'))
        print(os.path.join(out, f'sheet-{s // per + 1}.png'), chunk)


if __name__ == '__main__':
    main(sys.argv[1])
