# Whole-cast page titles (founder: "put the whole cast on the page titles",
# "different poses", "put some of them in front of the letters if it's still
# legible"). ChatGPT makes only the lettering (keyed); the cast poses
# (docs/design/brand/poses/<id>-<pose>.png, one character per prompt so details
# stay exact) are placed here: a row PERCHED on top of the word (drawn in front,
# bottoms overlapping the letter tops a little) and characters LEANING on the two
# ends in front of the first/last letters.
#   python3 compose-cast-title.py <layout-name>
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__))
POSES = os.path.join(HERE, '..', 'poses')

# Six poses per character (founder: "differentiate a bit, don't reuse"): each page
# title rotates through them with its own offset, so no two titles share a pose set
# and neighbors in the app never show the same pose for the same character.
POSES6 = {
    'w': ['cheer', 'point', 'lean', 'proud', 'sit', 'fly'],
    'o1': ['cheer', 'jump', 'sit', 'cartwheel', 'lean', 'hug'],
    'r': ['sit', 'wake', 'lean', 'cocoa', 'cheer', 'sleepwalk'],
    'd': ['cheer', 'eureka', 'lean', 'notes', 'sit', 'skeptic'],
    'o2': ['sit', 'gasp', 'cheer', 'twirl', 'lean', 'strut'],
    'c': ['cheer', 'telescope', 'sit', 'map', 'lean', 'backpack'],
    'i': ['sit', 'water', 'cheer', 'giggle', 'lean', 'reach'],
    'o3': ['sit', 'cushion', 'handstand', 'mustache', 'sneak', 'laugh'],
    'u': ['meditate', 'lotus', 'spin', 'tea', 'stretch', 'upside'],
    's': ['flex', 'trophy', 'slide', 'stopwatch', 'sit', 'blocks'],
}
PAGE_ORDER = ['welcome', 'dailies', 'puzzles', 'wotd', 'friends', 'stats', 'leaderboard', 'records',
              'vs', 'settings', 'howto', 'gopro', 'moregames']
LETTERING = {n: f'{n}-lettering-keyed.png' for n in PAGE_ORDER}
WIDE = {'welcome', 'dailies', 'friends', 'leaderboard', 'records', 'vs', 'wotd', 'howto', 'moregames'}


def layout(name):
    k = PAGE_ORDER.index(name)
    ids = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
    pick = {cid: POSES6[cid][(k + 2 * j) % 6] for j, cid in enumerate(ids)}
    ends = 1 if name in WIDE else 2
    left = [(cid, pick[cid], False) for cid in ids[:ends]]
    right = [(cid, pick[cid], False) for cid in ids[-ends:]]
    top = [(cid, pick[cid]) for cid in ids[ends:-ends]]
    return {'lettering': LETTERING[name], 'left': left, 'right': right, 'top': top}


LAYOUTS = {n: layout(n) for n in PAGE_ORDER}

def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def word_only(word):
    """The lettering without ChatGPT's floating sparkles/hearts, plus its letter band."""
    a = np.array(word.getchannel('A')) > 40
    rows = a[:, ::2].sum(axis=1)
    band = np.nonzero(rows > rows.max() * 0.45)[0]
    ltop, lbot = band[0], band[-1]
    lh = lbot - ltop
    lab, n = ndimage.label(ndimage.binary_erosion(a, iterations=6))
    keep = np.zeros_like(a)
    for i in range(1, n + 1):
        ys = np.nonzero(lab == i)[0]
        if ys.min() <= ltop + lh * 0.3 and ys.max() >= lbot - lh * 0.3:
            keep |= lab == i
    keep = ndimage.binary_dilation(keep, iterations=9) & a
    w = np.array(word)
    w[..., 3] = np.where(keep, w[..., 3], 0)
    word = trim(Image.fromarray(w))
    a = np.array(word.getchannel('A')) > 128
    rows = a[:, ::2].sum(axis=1)
    band = np.nonzero(rows > rows.max() * 0.45)[0]
    cols = np.nonzero(a[band[0]:band[-1]].any(axis=0))[0]
    return word, band[0], band[-1], cols[0], cols[-1]


SYMMETRIC = {'w', 'o1', 'o2', 'o3', 'u', 'i'}  # letters that read the same mirrored


def pose(cid, name, h, flip=False):
    assert not flip or cid in SYMMETRIC, f'{cid} would mirror its letter'
    im = trim(Image.open(os.path.join(POSES, f'{cid}-{name}.png')).convert('RGBA'))
    im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def shadow(im, op=0.3):
    s = Image.new('RGBA', im.size, (60, 20, 110, 0))
    s.putalpha(im.getchannel('A').point(lambda v: int(v * op)).filter(ImageFilter.GaussianBlur(5)))
    return s


def compose(name):
    L = LAYOUTS[name]
    word, ltop, lbot, lx0, lx1 = word_only(Image.open(os.path.join(HERE, L['lettering'])).convert('RGBA'))
    lh = lbot - ltop
    span = lx1 - lx0
    top = L['top']
    th = int(min(lh * 1.05, span / len(top) * 1.0))       # perched characters
    eh = int(th * 1.22)                                    # end characters, a touch bigger
    padx = int(eh * 1.3 * max(len(L['left']), len(L['right'])))
    W, H = word.width + 2 * padx, word.height + th + int(eh * 0.25)
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    wx, wy = padx, H - word.height - int(eh * 0.12)
    canvas.alpha_composite(word, (wx, wy))
    # Perched row: sit on the letter tops, slight jitter in height/size for life.
    jitter = [0.0, 0.08, -0.04, 0.06, -0.02, 0.1, 0.0, 0.05]
    for k, (cid, pn) in enumerate(top):
        h = int(th * (1 + 0.06 * ((k % 3) - 1)))
        im = pose(cid, pn, h)
        cx = wx + lx0 + span * (k + 0.5) / len(top)
        y = wy + ltop + int(lh * (0.22 + jitter[k % len(jitter)])) - im.height
        canvas.alpha_composite(shadow(im), (int(cx - im.width / 2) + 2, y + 4))
        canvas.alpha_composite(im, (int(cx - im.width / 2), y))
    # Ends: in front of the first/last letters (nearest one overlaps the letter
    # by ~16% of its width), the next one further out overlapping its neighbor.
    # 'left' is listed in reading order (outermost first), so walk it inner → outer.
    for side, group in ((0, list(reversed(L['left']))), (1, L['right'])):
        edge = wx + lx0 if side == 0 else wx + lx1
        for j, (cid, pn, flip) in enumerate(group):
            im = pose(cid, pn, int(eh * (1 - 0.08 * j)), flip)
            ov = 0.16 if j == 0 else 0.12
            if side == 0:
                x = edge - int(im.width * (1 - ov))
                edge = x
            else:
                x = edge - int(im.width * ov)
                edge = x + im.width
            y = wy + lbot + int(lh * 0.06) - im.height
            canvas.alpha_composite(shadow(im), (x + 3, y + 5))
            canvas.alpha_composite(im, (x, y))
    out = trim(canvas)
    out.save(os.path.join(HERE, f'{name}-cast.png'))
    print(name, out.size)


for n in (sys.argv[1:] or LAYOUTS):
    compose(n)
