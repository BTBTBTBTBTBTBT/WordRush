#!/usr/bin/env python3
"""Mock board: the 8 cast buttons with the ChatGPT/API label lettering (cream, no rim) centered on the
skin, at 1× and 3×, next to a cast-color title for the softness reference.
  python3 make-board.py → board-1x.png, board-3x.png (+ all-labels.png: every label on purple)"""
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CAST = os.path.join(HERE, '..', 'cast')
TITLES = os.path.join(HERE, '..', '..', 'titles', 'cast-colors')
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', s)
SPEC = json.load(open(os.path.join(CAST, 'labels.json')))['rules']
BTNS = [('purple', 'playagain'), ('teal', 'continue'), ('green', 'signup'), ('blue', 'invite'),
        ('gold', 'gopro'), ('slate', 'undo'), ('orange', 'erase'), ('pink', 'share')]


def skin(color, h, w, state='', dark=False):
    size = 's' if h <= 34 * 3 else 'm' if h <= 48 * 3 else 'l'
    sk = Image.open(os.path.join(CAST, 'out', f'{color}-l{state}{"-dark" if dark else ""}.png')).convert('RGBA')
    sk = sk.resize((max(h, round(sk.width * h / sk.height)), h), Image.LANCZOS)
    cap = h // 2
    out = Image.new('RGBA', (w, h))
    out.alpha_composite(sk.crop((0, 0, cap, h)), (0, 0))
    out.alpha_composite(sk.crop((sk.width // 2, 0, sk.width // 2 + 1, h)).resize((w - 2 * cap, h)), (cap, 0))
    out.alpha_composite(sk.crop((sk.width - cap, 0, sk.width, h)), (w - cap, 0))
    return out


def button(color, slug, height_pt=44, width_pt=None, scale=3, state='', dark=False):
    """Label art at the SAME cap height (artLabelCapOfHeight × height); the button widens to fit (README)."""
    from PIL import ImageFilter
    labels = json.load(open(os.path.join(CAST, 'labels.json')))['labels']
    h = round(height_pt * scale)
    lab = Image.open(os.path.join(HERE, slug + '.png')).convert('RGBA')
    lh = round(SPEC['artLabelCapOfHeight'] * h)
    lab = lab.resize((max(1, round(lab.width * lh / lab.height)), lh), Image.LANCZOS)
    inset = max(SPEC['capInsetOfHeight'] * h, SPEC['minPadPt'] * scale * height_pt / 44)
    need = lab.width + 2 * inset
    w = max(round((width_pt or 0) * scale), round(need))
    b = skin(color, h, w, state, dark)
    cy = h * SPEC['labelCenterOfHeight'] + (SPEC['pressedDropPt'] * scale if state else 0)
    pos = (round((w - lab.width) / 2), round(cy - lab.height / 2))
    a = lab.getchannel('A')

    def tinted(hexc, alpha):
        t = Image.new('RGBA', lab.size, tuple(int(hexc[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
        t.putalpha(a.point(lambda v: int(v * alpha)))
        return t
    halo = labels[color].get('artHalo')
    if halo:
        layer = Image.new('RGBA', b.size)
        t = tinted(halo['color'], halo['alpha'])
        pad = round(halo['spreadPt'] * scale) * 2 + 1
        ta = t.getchannel('A').filter(ImageFilter.MaxFilter(pad if pad % 2 else pad + 1))
        t.putalpha(ta)
        layer.alpha_composite(t, pos)
        b.alpha_composite(layer.filter(ImageFilter.GaussianBlur(halo['blurPt'] * scale)))
    sh = Image.new('RGBA', b.size)
    sh.alpha_composite(tinted(labels[color]['shadow'], min(1, SPEC['shadowAlpha'] * 1.6)), (pos[0], pos[1] + round(SPEC['shadowYPt'] * scale)))
    b.alpha_composite(sh.filter(ImageFilter.GaussianBlur(SPEC['shadowBlurPt'] * scale / 1.5)))
    b.alpha_composite(lab, pos)
    return b


def board(scale, out):
    cellw, gap = 150, 12
    W = round((4 * (cellw + gap) + 24) * scale)
    rows = [(False, ''), (False, '-pressed'), (True, '')]
    title = Image.open(os.path.join(TITLES, 'dailies.png')).convert('RGBA')
    th = round(40 * scale)
    title = title.resize((round(title.width * th / title.height), th), Image.LANCZOS)
    H = round((60 + len(rows) * 2 * 60 + 20) * scale)
    img = Image.new('RGBA', (W, H), (238, 228, 250, 255))
    img.alpha_composite(title, ((W - title.width) // 2, round(12 * scale)))
    y = 64 * scale
    for dark, state in rows:
        if dark:
            img.alpha_composite(Image.new('RGBA', (W, round(120 * scale)), (30, 22, 50, 255)), (0, round(y - 8 * scale)))
        for i, (c, slug) in enumerate(BTNS):
            x = (12 + (i % 4) * (cellw + gap)) * scale
            yy = y + (i // 4) * 60 * scale
            bt = button(c, slug, 44, None, scale, state, dark)
            img.alpha_composite(bt, (round(x + (cellw * scale - bt.width) / 2), round(yy)))
        y += 120 * scale
    img.convert('RGB').save(out, optimize=True)
    print('wrote', out, img.size)


def all_labels(out, scale=2):
    """Every label as the app draws it: 44 pt purple button, same cap height, the button widened to fit."""
    slugs = sorted(f[:-4] for f in os.listdir(HERE) if f.endswith('.png') and not f.startswith(('board', 'all-')))
    btns = [(s, button('purple', s, 44, None, scale)) for s in slugs]
    W, x, y, rowh = 1500, 20, 20, round(44 * scale) + 34
    img = Image.new('RGBA', (W, 2000), (250, 247, 255, 255))
    d = ImageDraw.Draw(img)
    for s, b in btns:
        if x + b.width > W - 20:
            x, y = 20, y + rowh
        img.alpha_composite(b, (x, y))
        d.text((x + 6, y + b.height + 4), s, font=F(15), fill=(60, 40, 95))
        x += b.width + 18
    img = img.crop((0, 0, W, y + rowh + 10))
    img.convert('RGB').save(out, optimize=True)
    print('wrote', out, len(slugs), 'labels')


if __name__ == '__main__':
    board(1, os.path.join(HERE, 'board-1x.png'))
    board(3, os.path.join(HERE, 'board-3x.png'))
    all_labels(os.path.join(HERE, 'all-labels.png'))
