# Onboarding cast rows (FINISH_SPEC AO; night art 10-03), from full-size single-character ChatGPT drawings (src/):
#   welcome-cast.png  all ten waving, W-O-R-D-O-C-I-O-U-S, tightly packed
#   all-set.png       all ten cheering with an EMPTY spot in the middle (right after W… the apps drop the
#                     player's mascot into it; web/iOS overlay it bottom-center)
#   python3 compose-cast-row.py
import os
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
TILE_H = 520           # a standard tile's body height in px


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def row(prefix, gap_after=None, gap_w=0.0, out_name='x.png'):
    figs = []
    for cid in ORDER:
        im = trim(Image.open(os.path.join(HERE, 'src', f'{prefix}-{cid}.png')).convert('RGBA'))
        h = int(TILE_H * (1.18 if cid == 'i' else 1.0))
        figs.append((cid, im.resize((round(im.width * h / im.height), h), Image.LANCZOS)))
    over = 0.16                                        # neighbors overlap a little (packed lineup)
    xs, x = [], 0
    for k, (cid, im) in enumerate(figs):
        xs.append(x)
        x += int(im.width * (1 - over))
        if gap_after is not None and k == gap_after:
            x += int(TILE_H * gap_w)
    W = x + int(figs[-1][1].width * over)
    H = max(im.height for _, im in figs) + 40
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    # back row first: alternate characters sit slightly behind (drawn first, a touch higher)
    order = sorted(range(len(figs)), key=lambda k: (k % 2 == 0, k))
    for k in order:
        cid, im = figs[k]
        y = H - im.height - (14 if k % 2 == 1 else 0)
        sh = Image.new('RGBA', im.size, (40, 20, 60, 0))
        sh.putalpha(im.getchannel('A').point(lambda v: int(v * 0.22)).filter(ImageFilter.GaussianBlur(10)))
        out.alpha_composite(sh, (xs[k] + 6, y + 8))
        out.alpha_composite(im, (xs[k], y))
    out.save(os.path.join(HERE, out_name))
    print(out_name, out.size)


def group(prefix, out_name, gap=False):
    """Two packed rows (back W-O-R-D-O, front C-I-O-U-S, offset half a figure) — ~2.3:1, readable on a phone.
    gap=True leaves an empty spot in the FRONT row's middle (all-set: the player's mascot hops in there)."""
    figs = {}
    for cid in ORDER:
        im = trim(Image.open(os.path.join(HERE, 'src', f'{prefix}-{cid}.png')).convert('RGBA'))
        h = int(TILE_H * (1.18 if cid == 'i' else 1.0))
        figs[cid] = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    step = int(TILE_H * 0.86)
    back, front = ORDER[:5], ORDER[5:]
    front_slots = [0, 1, 2, 3, 4]
    if gap:
        front_slots = [-0.5, 0.5, 2.5, 3.5, 4.5] if False else [0, 1, 3, 4, 5]
    W = int(step * (6 if gap else 5.5)) + TILE_H // 2
    H = int(TILE_H * 1.9)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    def put(im, cx, bottom, scale=1.0):
        if scale != 1.0:
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        x, y = int(cx - im.width / 2), int(bottom - im.height)
        sh = Image.new('RGBA', im.size, (40, 20, 60, 0))
        sh.putalpha(im.getchannel('A').point(lambda v: int(v * 0.22)).filter(ImageFilter.GaussianBlur(10)))
        out.alpha_composite(sh, (x + 6, y + 8))
        out.alpha_composite(im, (x, y))
    x0 = TILE_H * 0.55
    bshift = 0.5 if gap else 0.0
    for k, cid in enumerate(back):
        put(figs[cid], x0 + step * (k + bshift + 0.25), H * 0.60, 0.9)
    for k, cid in enumerate(front):
        put(figs[cid], x0 + step * (front_slots[k] + 0.75 - (0 if not gap else 0.25)), H - 6)
    out = trim(out)
    out.save(os.path.join(HERE, out_name))
    print(out_name, out.size)


group('wave', 'welcome-cast.png')
if all(os.path.exists(os.path.join(HERE, 'src', f'cheer-{c}.png')) for c in ORDER):
    group('cheer', 'all-set.png', gap=True)
