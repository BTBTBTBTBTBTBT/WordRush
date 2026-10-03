#!/usr/bin/env python3
"""Mascot maker contact sheets (round 2), drawn through the CORE layout (dump-layout.ts) with avatar_draw.py:
  contact-parts.png   every part by category (bodies, eyes, mouths, noses, cheeks, hats, face, neck/back)
  contact-colors.png  the body colors in their rows (brights, pastels, deeps, neutrals, Pro specials) + the 14 patterns
  ../podium/contact-podium.png   the shipped pedestals (numbered + plain) on the floor plate
  python3 contact-sheets.py
"""
import json, os, re, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, HERE)
from avatar_draw import render  # noqa: E402

FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
INK = (60, 40, 90)


def font(sz):
    try:
        return ImageFont.truetype(FONT, sz)
    except Exception:
        return ImageFont.load_default()


def dump(cfgs):
    r = subprocess.run([REPO + '/apps/server/node_modules/.bin/tsx', os.path.join(HERE, 'dump-layout.ts')],
                       input=json.dumps(cfgs), capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


SRC = open(os.path.join(REPO, 'packages', 'core', 'src', 'avatar-config.ts')).read()


def arr(name):
    m = re.search(r'export const ' + name + r' = \[(.*?)\] as const', SRC, re.S)
    return re.findall(r"'([^']+)'", m.group(1))


def grid(sections, out, T=128, cols=12, title=None):
    """sections: [(label, [(cfg, caption)])] → one labeled block per section."""
    flat = [c for _, items in sections for c, _ in items]
    d = dump(flat)['out']
    hdr = 40 if title else 0
    H = hdr
    for _, items in sections:
        H += 28 + ((len(items) + cols - 1) // cols) * (T + 20)
    img = Image.new('RGB', (cols * (T + 8) + 16, H + 10), (250, 248, 255))
    dr = ImageDraw.Draw(img)
    if title:
        dr.text((12, 10), title, fill=INK, font=font(20))
    y, k = hdr, 0
    for label, items in sections:
        dr.text((12, y + 6), f'{label} ({len(items)})', fill=INK, font=font(15))
        y += 28
        for i, (_, cap) in enumerate(items):
            im = render(d[k], T).convert('RGB')
            x = 12 + (i % cols) * (T + 8)
            yy = y + (i // cols) * (T + 20)
            img.paste(im, (x, yy))
            dr.text((x + 2, yy + T + 2), cap[:22], fill=INK, font=font(10))
            k += 1
        y += ((len(items) + cols - 1) // cols) * (T + 20)
    img.save(out, optimize=True)
    print('wrote', os.path.relpath(out, REPO), img.size)


def parts_sheet():
    none = dict(head='none', face='none', neck='none', nose='none', cheeks='none')
    sec = [
        ('Bodies', [(dict(none, body=b), b) for b in arr('AVATAR_BODIES')]),
        ('Eyes', [(dict(none, eyes=e), e) for e in arr('AVATAR_EYES')]),
        ('Mouths', [(dict(none, mouth=m), m) for m in arr('AVATAR_MOUTHS')]),
        ('Noses', [(dict(none, nose=n), n) for n in arr('AVATAR_NOSES') if n != 'none']),
        ('Cheeks', [(dict(none, cheeks=c), c) for c in arr('AVATAR_CHEEKS') if c != 'none']),
        ('Hats', [(dict(none, head=h), h) for h in arr('AVATAR_HEADS') if h != 'none']),
        ('Face extras', [(dict(none, face=f), f) for f in arr('AVATAR_FACES') if f != 'none']),
        ('Neck + back', [(dict(none, neck=n), n) for n in arr('AVATAR_NECKS') if n != 'none']),
    ]
    grid(sec, os.path.join(HERE, 'contact-parts.png'), title='Mascot maker parts — round 2 (core layout, classic body unless noted)')


def colors_sheet():
    m = re.search(r'export const AVATAR_COLORS: ReadonlyArray<AvatarColor> = \[(.*?)\n\];', SRC, re.S)
    ids = re.findall(r"id: '([^']+)'[^}]*?group: '([^']+)'", m.group(1))
    groups = {}
    for cid, g in ids:
        groups.setdefault(g, []).append(cid)
    none = dict(head='none', face='none', neck='none', nose='none', cheeks='none', pattern='solid')
    order = ['bright', 'pastel', 'deep', 'neutral', 'special']
    sec = [(f'Colors · {g}' + (' (Pro)' if g == 'special' else ''), [(dict(none, color=c, patternColor=c), c) for c in groups[g]])
           for g in sorted(groups, key=lambda g: order.index(g) if g in order else 9)]
    sec.append(('Patterns (violet on purple)', [(dict(none, color='purple', patternColor='violet', pattern=p), p) for p in arr('AVATAR_PATTERNS')]))
    sec.append(('Tintable accessories (accColor)', [(dict(none, neck='wings', accColor=a), f'wings · {a}') for a in ('default', 'pink', 'sky', 'gold')]
                + [(dict(none, head='chef', accColor=a), f'chef · {a}') for a in ('default', 'mint', 'rainbow')]
                + [(dict(none, neck='backpack', accColor=a), f'backpack · {a}') for a in ('red', 'teal')]))
    grid(sec, os.path.join(HERE, 'contact-colors.png'), T=104, cols=14, title='Mascot colors, patterns + accessory tints')


def podium_sheet():
    P = os.path.join(REPO, 'docs', 'design', 'brand', 'podium', 'out')
    ped = {k: Image.open(os.path.join(P, f'{k}.png')).convert('RGBA') for k in ('1', '2', '3', '1-plain', '2-plain', '3-plain')}
    floor = Image.open(os.path.join(P, 'floor.png')).convert('RGBA')
    W, Hh = 1200, 420
    img = Image.new('RGBA', (W, Hh * 2 + 60), (250, 248, 255, 255))
    dr = ImageDraw.Draw(img)
    dr.text((14, 10), 'Podium pedestals (art-podium-{1,2,3}, -plain) on art-podium-floor — app heights 74 / 54 / 40', fill=INK, font=font(18))
    for row, suf in enumerate(['', '-plain']):
        top = 50 + row * Hh
        base = top + Hh - 70
        fl = floor.resize((W - 120, 70))
        img.alpha_composite(fl, (60, base - 35))
        heights = {'2': 54 * 3.4, '1': 74 * 3.4, '3': 40 * 3.4}
        for i, k in enumerate(['2', '1', '3']):
            im = ped[k + suf]
            h = int(heights[k]); w = int(im.width * h / im.height)
            cx = 60 + (W - 120) * (i + 0.5) / 3
            img.alpha_composite(im.resize((w, h), Image.LANCZOS), (int(cx - w / 2), base - h))
    out = os.path.join(REPO, 'docs', 'design', 'brand', 'podium', 'contact-podium.png')
    img.convert('RGB').save(out, optimize=True)
    print('wrote', os.path.relpath(out, REPO), img.size)


if __name__ == '__main__':
    parts_sheet()
    colors_sheet()
    podium_sheet()
