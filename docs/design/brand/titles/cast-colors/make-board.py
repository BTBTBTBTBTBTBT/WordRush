#!/usr/bin/env python3
"""Cast-color pick board (founder 10-03): every title in its cast member's color on a ~390 pt phone row,
the cast-color button skins (normal / pressed, light / dark, with labels), and three mock screens on the real
wallpapers. → ../cast-colors-2026-10-03.png"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
BTN = os.path.join(HERE, '..', '..', 'buttons', 'cast', 'out')
WALL = os.path.join(REPO, 'apps', 'web', 'public', 'art')
F = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', s)
FB = lambda s: ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Black.ttf', s)
INK = (60, 40, 95)
HOME_BG = (238, 228, 250)
ORDER = [('dailies', 'W purple'), ('puzzles', 'C teal'), ('wotd', 'I green'), ('vsbattle', 'D blue'),
         ('leaderboard', 'S gold'), ('stats', 'R slate'), ('friends', 'O pink'), ('settings', 'R slate'),
         ('gopro', 'S gold'), ('strategy', 'U violet'), ('guides', 'O orange'), ('menu', 'W purple'),
         ('welcome', 'W purple'), ('howto', 'W purple'), ('words', 'W purple'), ('moregames', 'W purple'),
         ('records', 'W purple'), ('faq', 'W purple'), ('privacy', 'W purple'), ('terms', 'W purple')]
BTNS = [('purple', 'PLAY AGAIN'), ('teal', 'STARTS WITH'), ('green', 'SIGN UP'), ('blue', 'INVITE'),
        ('gold', 'GO PRO'), ('slate', 'UNDO'), ('orange', 'ERASE'), ('pink', 'SHARE')]


def title(name, w, h):
    t = Image.open(os.path.join(HERE, name + '.png')).convert('RGBA')
    s = min(w / t.width, h / t.height)
    return t.resize((int(t.width * s), int(t.height * s)), Image.LANCZOS)


def button(color, label, h=132, w=520, state='', dark=False):
    """Three-slice: caps = h/2 from the skin, the middle column stretched to width w."""
    sk = Image.open(os.path.join(BTN, f'{color}-l{state}{"-dark" if dark else ""}.png')).convert('RGBA')
    sk = sk.resize((int(sk.width * h / sk.height), h), Image.LANCZOS)
    cap = h // 2
    out = Image.new('RGBA', (w, h))
    out.alpha_composite(sk.crop((0, 0, cap, h)), (0, 0))
    out.alpha_composite(sk.crop((sk.width // 2, 0, sk.width // 2 + 1, h)).resize((w - 2 * cap, h)), (cap, 0))
    out.alpha_composite(sk.crop((sk.width - cap, 0, sk.width, h)), (w - cap, 0))
    # the label always fits INSIDE the caps (the app shrinks it the same way); colors from labels.json
    import json
    from PIL import ImageFilter
    lab = json.load(open(os.path.join(BTN, '..', 'labels.json')))['labels'][color]
    pt = h / 44                                           # board px per pt (a 44 pt regular button)
    d = ImageDraw.Draw(out)
    fs = int(h * 0.3)
    while fs > 8 and d.textlength(label, font=FB(fs)) > w - h * 0.9:
        fs -= 1
    f = FB(fs)
    cx, cy = w / 2, h * 0.45 + (3 if state else 0)
    sh = Image.new('RGBA', out.size)
    sc = tuple(int(lab['shadow'][i:i + 2], 16) for i in (1, 3, 5)) + (int(255 * lab['shadowAlpha']),)
    ImageDraw.Draw(sh).text((cx, cy + lab['shadowYPt'] * pt), label, font=f, fill=sc, anchor='mm',
                            stroke_width=int(lab['strokePt'] * pt), stroke_fill=sc)
    out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(lab['shadowBlurPt'] * pt)))
    d.text((cx, cy), label, font=f, fill=lab['fill'], anchor='mm', stroke_width=max(1, int(lab['strokePt'] * pt)), stroke_fill=lab['stroke'])
    return out


def screen(wall, titles, buttons, W=390 * 2, H=760):
    bg = Image.open(os.path.join(WALL, wall + '.webp')).convert('RGBA')
    bg = bg.resize((W, int(bg.height * W / bg.width))).crop((0, 0, W, H))
    y = 60
    for t in titles:
        im = title(t, int(W * 0.66), 92)
        bg.alpha_composite(im, ((W - im.width) // 2, y)); y += im.height + 70
    for c, label in buttons:
        b = button(c, label, h=88, w=int(W * 0.8))
        bg.alpha_composite(b, ((W - b.width) // 2, y)); y += 104
    return bg


def main():
    colW, rowH, cols = 560, 120, 4
    rows = (len(ORDER) + cols - 1) // cols
    W = cols * (colW + 20) + 40
    btnH = 2 * (132 + 30) + 60
    screens = [screen('art-wall-home', ['dailies', 'puzzles', 'wotd'], [('purple', 'PLAY')]),
               screen('art-wall-leaderboard', ['leaderboard'], [('gold', 'GO PRO'), ('purple', 'SHARE')]),
               screen('art-wall-friends', ['friends'], [('green', 'INVITE A FRIEND'), ('slate', 'MAYBE LATER')]),
               screen('art-wall-stats', ['stats'], [('teal', 'STARTS WITH'), ('orange', 'ERASE')])]
    H = 140 + rows * (rowH + 44) + 60 + 2 * btnH + 70 + screens[0].height + 60
    board = Image.new('RGB', (W, H), (250, 247, 255))
    d = ImageDraw.Draw(board)
    d.text((40, 24), 'Cast-color titles + buttons (2026-10-03) — each title wears its cast member\'s body color; deeper same-color rim', font=F(30), fill=INK)
    d.text((40, 70), 'Proposed mapping below (W purple is the default; pink only on FRIENDS). Rows are ~390 pt phone widths.', font=F(22), fill=(110, 90, 150))
    y0 = 130
    for i, (name, cast) in enumerate(ORDER):
        x = 40 + (i % cols) * (colW + 20)
        y = y0 + (i // cols) * (rowH + 44)
        d.text((x, y), f'{name.upper()} · {cast}', font=F(18), fill=INK)
        row = Image.new('RGB', (colW, rowH), HOME_BG)
        t = title(name, int(colW * 0.7), rowH - 20)
        row.paste(t, ((colW - t.width) // 2, (rowH - t.height) // 2), t)
        board.paste(row, (x, y + 26))
    y = y0 + rows * (rowH + 44) + 30
    for dark in (False, True):
        d.text((40, y), 'Buttons — ' + ('dark mode' if dark else 'light') + ' (top: normal · bottom: pressed). Three-slice skins, 32 / 44 / 56 pt.', font=F(22), fill=INK)
        y += 40
        strip = Image.new('RGBA', (W - 80, 2 * (132 + 30)), (30, 22, 50, 255) if dark else (246, 242, 255, 255))
        for j, (c, label) in enumerate(BTNS):
            for k, st in enumerate(['', '-pressed']):
                b = button(c, label, h=110, w=(W - 80) // len(BTNS) - 20, state=st, dark=dark)
                strip.alpha_composite(b, (10 + j * ((W - 80) // len(BTNS)), 20 + k * 150))
        board.paste(strip.convert('RGB'), (40, y)); y += strip.height + 30
    d.text((40, y), 'On real screens (mocked on the shipped wallpapers): Home · Leaderboard · Friends · Stats', font=F(22), fill=INK)
    y += 40
    sw = (W - 80 - 3 * 30) // 4
    for i, s in enumerate(screens):
        s = s.resize((sw, int(s.height * sw / s.width)), Image.LANCZOS)
        board.paste(s.convert('RGB'), (40 + i * (sw + 30), y))
    out = os.path.join(HERE, '..', 'cast-colors-2026-10-03.png')
    board.save(out, optimize=True)
    print('wrote', os.path.normpath(out), board.size)


if __name__ == '__main__':
    main()
