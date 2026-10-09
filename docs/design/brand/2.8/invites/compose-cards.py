#!/usr/bin/env python3
"""Invite card layouts (1200 x 630 share/invite image) per invite type: two mascot slots + badge + title plaque + VS mark.
Cast = canonical cast/hero art (never redrawn). Slots: left mascot (inviter), right mascot (invitee/rival), badge top-center,
plaque (game title art goes on it) bottom-center. Text in Nunito (live in the app); art from ChatGPT pieces in out/."""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
H = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.normpath(os.path.join(H, '..', '..'))
sys.path.insert(0, os.path.join(H, '..', 'glyphs'))
import bubble_text as bt
NUNITO = os.path.normpath(os.path.join(H, '../../../../../apps/ios/Wordocious/Resources/Nunito.ttf'))
def font(s):
    f = ImageFont.truetype(NUNITO, s); f.set_variation_by_name('Black'); return f
def piece(n, w=None, h=None):
    im = Image.open(f'{H}/out/{n}.png').convert('RGBA'); k = (w / im.width) if w else (h / im.height)
    return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
def hero(i, h):
    im = Image.open(f'{BRAND}/cast/hero/{i}.png').convert('RGBA'); im = im.crop(im.getchannel('A').getbbox())
    k = h / im.height; return im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
def grad(w, h, a, b):
    im = Image.new('RGB', (w, h)); d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / (h - 1); d.line([(0, y), (w, y)], fill=tuple(round(a[c] * (1 - t) + b[c] * t) for c in range(3)))
    return im.convert('RGBA')
def shadow(c, im, xy, blur=14, op=80):
    sh = Image.new('RGBA', im.size, (50, 20, 100, 0)); sh.putalpha(im.getchannel('A').point(lambda v: v * op // 255))
    big = Image.new('RGBA', c.size, (0, 0, 0, 0)); big.alpha_composite(sh, (xy[0], xy[1] + 10)); c.alpha_composite(big.filter(ImageFilter.GaussianBlur(blur)))
def put(c, im, xy, sh=True):
    if sh: shadow(c, im, xy)
    c.alpha_composite(im, xy)
def ctext(d, cx, y, t, f, fill):
    d.text((cx - d.textlength(t, font=f) / 2, y), t, font=f, fill=fill)
W, Hh = 1200, 630
CARDS = [
    ('live-vs', 'badge-versus', ('w', 'r'), 'LIVE MATCH', ((124, 58, 237), (236, 72, 153))),
    ('race-my-run', 'badge-race', ('s', 'd'), 'RACE MY RUN', ((8, 145, 178), (37, 99, 235))),
    ('pocket-game', 'badge-pocket', ('o1', 'c'), 'POCKET GAME', ((202, 138, 4), (124, 58, 237))),
    ('friend-request', 'badge-friend', ('i', 'o2'), 'NEW FRIEND', ((236, 72, 153), (124, 58, 237))),
]
for key, badge, (L, R), word, (ca, cb) in CARDS:
    c = grad(W, Hh, tuple(int(v * .35 + 255 * .65) for v in ca), tuple(int(v * .25 + 255 * .75) for v in cb))
    put(c, piece(badge, h=150), ((W - 150) // 2, 24))
    hl = hero(L, 310); hr = hero(R, 310)
    put(c, hl, (130, 70 + 310 - hl.height + 10)); put(c, hr, (W - 130 - hr.width, 70 + 310 - hr.height + 10))
    d = ImageDraw.Draw(c)
    if key in ('live-vs', 'race-my-run'):
        vs = bt.render('VS', '#fbbf24', '#f97316', height=84); put(c, vs, ((W - vs.width) // 2, 255), sh=False)
    else:
        sp = piece('sparkles', w=120) if os.path.exists(f'{H}/out/sparkles.png') else None
    pl = piece('title-plaque', w=470); put(c, pl, ((W - pl.width) // 2, Hh - pl.height - 6))
    d = ImageDraw.Draw(c); ctext(d, W / 2, Hh - pl.height - 6 + pl.height * 0.30, '<game title art>', font(34), (91, 33, 182))
    ctext(d, W / 2, 208, word, font(30), tuple(int(v * .6) for v in ca))
    c.convert('RGB').save(f'{H}/card-{key}.png')
print('ok')
