#!/usr/bin/env python3
"""Split the API title sheets (raw/inv*-N.png + .json slug lists, raw/pk-5.png) into <slug>.png and
color-match each to its cast color: hue shift + saturation / value quantile mapping onto the finished
title in that color (dailies = purple, puzzles = teal, wotd = green, vsbattle = blue, leaderboard = gold,
stats = slate, guides = orange, friends = pink). Wrapped titles (more bands than slugs) are reported.
  python3 finish-inventory.py"""
import glob, json, os, re
import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = {'purple': 'dailies', 'teal': 'puzzles', 'green': 'wotd', 'blue': 'vsbattle', 'gold': 'leaderboard',
          'slate': 'stats', 'orange': 'guides', 'pink': 'friends'}
inv = open(os.path.join(HERE, '..', '..', 'TITLE-INVENTORY.md')).read()
COLOR = {s: c for s, _, c in re.findall(r'^\| (\S+) \| (.+?) \| (\w+) \|$', inv, re.M) if s != 'Slug'}
COLOR.update({'pocket-ghost': 'slate', 'pocket-chain': 'green', 'pick-friend': 'pink'})
STACK_OK = {'achievement'}


def bands(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)[..., 3] > 40
    lab, n = ndimage.label(ndimage.binary_dilation(a.any(1), iterations=3))
    out = []
    for s in sorted([s[0] for s in ndimage.find_objects(lab)], key=lambda s: s.start):
        t = im.crop((0, s.start, im.width, s.stop))
        bb = t.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
        if bb and bb[3] - bb[1] > 40:
            out.append(t.crop(bb))
    return out


def stack(a, b):
    w = max(a.width, b.width); gap = round(a.height * 0.06)
    o = Image.new('RGBA', (w, a.height + gap + b.height))
    o.alpha_composite(a, ((w - a.width) // 2, 0)); o.alpha_composite(b, ((w - b.width) // 2, a.height + gap))
    return o


def join(a, b):
    if abs(b.height - a.height) > 6:
        b = b.resize((round(b.width * a.height / b.height), a.height), Image.LANCZOS)
    sp = round(a.height * 0.13); h = max(a.height, b.height)   # a natural word space for this face
    o = Image.new('RGBA', (a.width + sp + b.width, h)); o.alpha_composite(a, (0, h - a.height)); o.alpha_composite(b, (a.width + sp, h - b.height))
    return o


_tgt = {}


def target(color):
    if color not in _tgt:
        im = Image.open(os.path.join(HERE, TARGET[color] + '.png')).convert('RGBA')
        a = np.asarray(im)[..., 3] > 200
        hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(float)[a]
        _tgt[color] = hsv
    return _tgt[color]


def qmap(src, ref, vals):
    qs = np.linspace(0, 100, 101)
    return np.interp(vals, np.percentile(src, qs), np.percentile(ref, qs))


def match(im, color):
    a = np.asarray(im)[..., 3]
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(float)
    m = a > 200
    ref = target(color)
    src = hsv[m]
    out = hsv.copy()
    # hue: circular median shift (skip near-grey slate where hue is noise)
    def cmed(h):
        ang = h / 256 * 2 * np.pi
        return (np.arctan2(np.sin(ang).mean(), np.cos(ang).mean()) / (2 * np.pi) * 256) % 256
    out[..., 0] = (hsv[..., 0] + (cmed(ref[:, 0]) - cmed(src[:, 0]))) % 256
    out[..., 1] = qmap(src[:, 1], ref[:, 1], hsv[..., 1])
    out[..., 2] = qmap(src[:, 2], ref[:, 2], hsv[..., 2])
    rgb = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'HSV').convert('RGBA')
    rgb.putalpha(Image.fromarray(a))
    return rgb


def clean(im):
    im.putalpha(im.getchannel('A').point(lambda v: 0 if v < 10 else v))
    return im


# Sheets where a title wrapped onto two lines (or went missing): band → slug, a tuple = join on one line.
# 'unwrap', i = one band holding two tight lines: cut at the emptiest row of its middle and join.
MANUAL = {
    'inv1-4.png': [('invite', (0, 1)), ('editprofile', 2), ('mascot', (3, 4))],   # BOTS missing → fix-1
    'inv1-8.png': [('tour-together', (0, 1))],
    'inv2-3.png': [('freeweek', ('unwrap', 0)), ('properk', 1), ('newpassword', 2), ('gauntletcleared', 3)],
    'inv2-4.png': [('laddercleared', (0, 1)), ('alreadyplayed', (2, 3)), ('archetypes', 4)],   # LEVEL UP missing → fix-1
    'inv2-7.png': [('privatematch', ('unwrap', 0)), ('oops', 1), ('notfound', 2), ('rotate', ('unwrap', 3))],
    'inv2-8.png': [('dailychallenge', ('unwrap', 0)), ('onastreak', 1)],
    'fix-1.png': [('bots', 0), ('levelup', 1)],
}


def unwrap(b):
    a = np.asarray(b)[..., 3] > 40
    cnt = a.sum(1); n = len(cnt); lo, hi = n // 3, 2 * n // 3
    cut = lo + int(np.argmin(cnt[lo:hi]))
    # assign each connected letter blob to the line holding most of it (lines can interlock at the cut)
    lab, n = ndimage.label(a)
    top = np.zeros_like(a); bot = np.zeros_like(a)
    for i, sl in enumerate(ndimage.find_objects(lab), start=1):
        blob = lab[sl] == i
        cy = sl[0].start + np.nonzero(blob)[0].mean()
        (top if cy < cut else bot)[sl] |= blob
    full = ndimage.binary_dilation(a, iterations=3)
    fused = not bot.any() or not top.any()
    if fused:                                                # the lines are fused into one blob: cut the rows
        top = a.copy(); top[cut:] = False; bot = a.copy(); bot[:cut] = False
        for m in (top, bot):                                 # drop slivers of the other line's letters
            l2, n2 = ndimage.label(m)
            if n2:
                sz = ndimage.sum(m, l2, range(1, n2 + 1))
                m &= np.isin(l2, [i + 1 for i, v in enumerate(sz) if v >= sz.max() * 0.06])
            rows = m.sum(1); keep = rows > rows.max() * 0.12          # trim fringe rows of the other line
            ys = np.nonzero(keep)[0]
            m[:ys.min()] = False; m[ys.max() + 1:] = False
    parts = []
    for m in (top, bot):
        mm = m if fused else ndimage.binary_dilation(m, iterations=3) & full
        t = b.copy(); al = np.asarray(t.getchannel('A')).copy(); al[~mm] = 0; t.putalpha(Image.fromarray(al))
        parts.append(t.crop(t.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()))
    return join(*parts)
report = []
sheets = sorted(glob.glob(os.path.join(HERE, 'raw', 'inv*-*.json')))
jobs = [(p[:-5] + '.png', json.load(open(p))) for p in sheets]
jobs.append((os.path.join(HERE, 'raw', 'fix-1.png'), ['bots', 'levelup']))
if os.path.exists(os.path.join(HERE, 'raw', 'pk-5.png')):
    jobs.append((os.path.join(HERE, 'raw', 'pk-5.png'), ['pocket-ghost', 'pocket-chain', 'pick-friend']))
for png, slugs in jobs:
    bs = bands(png)
    if os.path.basename(png) in MANUAL:
        for slug, idx in MANUAL[os.path.basename(png)]:
            if isinstance(idx, tuple) and idx[0] == 'unwrap':
                b = unwrap(bs[idx[1]])
            elif isinstance(idx, tuple):
                b = join(bs[idx[0]], bs[idx[1]])
            else:
                b = bs[idx]
            clean(match(b, COLOR[slug])).save(os.path.join(HERE, slug + '.png'))
        continue
    if len(bs) != len(slugs):
        report.append(f'{os.path.basename(png)}: {len(bs)} bands for {len(slugs)} titles {slugs} heights {[b.height for b in bs]}')
        continue
    for slug, b in zip(slugs, bs):
        clean(match(b, COLOR[slug])).save(os.path.join(HERE, slug + '.png'))
print('\n'.join(report) or 'all sheets split cleanly')
