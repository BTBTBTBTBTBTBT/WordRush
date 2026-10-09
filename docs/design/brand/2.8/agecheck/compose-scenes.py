#!/usr/bin/env python3
"""Compose the two age-check scenes (540 x 960 previews) from ChatGPT props + the CANONICAL cast hero art.
The cast is never redrawn: cast/hero/<id>.png is placed as-is (downscaled only). Text uses the app typeface
(Nunito Black) and, for the headline, the bubble-glyph atlas (../glyphs/bubble_text.py)."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

H = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.normpath(os.path.join(H, '..', '..'))
sys.path.insert(0, os.path.join(H, '..', 'glyphs'))
import bubble_text as bt

NUNITO = os.path.normpath(os.path.join(H, '../../../../../apps/ios/Wordocious/Resources/Nunito.ttf'))


def font(size, weight='Black'):
    f = ImageFont.truetype(NUNITO, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def prop(n, w=None, h=None):
    im = Image.open(f'{H}/out/{n}.png').convert('RGBA')
    k = (w / im.width) if w else (h / im.height)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def hero(i, h):
    im = Image.open(f'{BRAND}/cast/hero/{i}.png').convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    k = h / max(im.size)   # fit the longest side to h
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)


def backdrop(w, h, top=(238, 228, 255), bottom=(255, 236, 246)):
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(round(top[c] * (1 - t) + bottom[c] * t) for c in range(3)))
    return im.convert('RGBA')


def shadow(canvas, im, xy, blur=10, op=70):
    sh = Image.new('RGBA', im.size, (60, 30, 110, 0))
    sh.putalpha(im.getchannel('A').point(lambda v: v * op // 255))
    big = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    big.alpha_composite(sh, (xy[0], xy[1] + 8))
    canvas.alpha_composite(big.filter(ImageFilter.GaussianBlur(blur)))


def put(canvas, im, xy, shade=True):
    if shade:
        shadow(canvas, im, xy)
    canvas.alpha_composite(im, xy)


def center_text(d, xy, text, f, fill):
    w = d.textlength(text, font=f)
    d.text((xy[0] - w / 2, xy[1]), text, font=f, fill=fill)


# 1. the question -----------------------------------------------------------
W, Hh = 540, 960
c = backdrop(W, Hh)
put(c, prop('bunting', w=420), (60, 6), shade=False)
put(c, prop('sparkles', w=70), (440, 120), shade=False)
put(c, prop('hearts', w=80), (26, 150), shade=False)
bub = prop('speech-bubble', w=470)
put(c, bub, (35, 130))
d = ImageDraw.Draw(c)
center_text(d, (270, 170), "When's your", font(40), (91, 33, 182))
center_text(d, (270, 218), 'birthday year?', font(40), (91, 33, 182))
wheel = prop('year-wheel', w=210)
wx, wy = 165, 320
put(c, wheel, (wx, wy))
d = ImageDraw.Draw(c)
rows = [('2016', 0.35), ('2015', 0.6), ('2014', 1.0), ('2013', 0.6), ('2012', 0.35)]
step = 60   # the selection band sits ~177 px below the wheel's top at this size
for k, (txt, op) in enumerate(rows):
    col = (91, 33, 182, int(255 * op))
    layer = Image.new('RGBA', c.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((wx + wheel.width / 2 - ImageDraw.Draw(layer).textlength(txt, font=font(38 if op == 1 else 30)) / 2,
                                wy + 177 + (k - 2) * step - (22 if op == 1 else 18)), txt, font=font(38 if op == 1 else 30), fill=col)
    c.alpha_composite(layer)
put(c, hero('d', 300), (210, 650))                  # D asks (glasses + pencil, brainy)
put(c, prop('cake', w=110), (40, 760))
put(c, prop('balloons', w=110), (410, 560))
c.convert('RGB').save(f'{H}/age-check-question.png')

# 2. 13 and up, see you soon ---------------------------------------------
c = backdrop(W, Hh, (226, 236, 255), (255, 240, 226))
put(c, prop('rainbow', w=470), (35, 280), shade=False)
put(c, prop('bunting', w=440), (50, 18), shade=False)
put(c, prop('balloons', w=100), (14, 300))
put(c, prop('balloons', w=100), (426, 300))
head = bt.render('13 AND UP', '#7c3aed', '#ec4899', height=58)
head2 = bt.render('SEE YOU SOON!', '#0891b2', '#2563eb', height=40)
put(c, head, ((W - head.width) // 2, 105), shade=False)
put(c, head2, ((W - head2.width) // 2, 190), shade=False)
back = ['r', 'o2', 'c', 'u', 'i']
front = ['w', 'o1', 'd', 'o3', 's']
for k, i in enumerate(back):
    im = hero(i, 130)
    put(c, im, (int(20 + k * 104 + (104 - im.width) / 2), 500 + (130 - im.height)))
for k, i in enumerate(front):
    im = hero(i, 150)
    put(c, im, (int(8 + k * 106 + (106 - im.width) / 2), 610 + (150 - im.height)))
put(c, prop('sparkles', w=64), (44, 420), shade=False)
put(c, prop('hearts', w=70), (430, 420), shade=False)
put(c, prop('gift', w=90), (225, 800))
c.convert('RGB').save(f'{H}/age-check-under13-seeyousoon.png')
print('ok')
