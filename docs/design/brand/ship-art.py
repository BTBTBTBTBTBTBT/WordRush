# Ship the art pass (docs/ART_PLAN.md, docs/ART_SPEC.md) to the three apps.
# Web + Android get WebP (q92, ~100 KB a title); iOS gets PNG image sets.
#   day titles   titles/<day>-keyed.png      → art-day-<day>       (width 1080)
#   page titles  titles/<name>-cast.png      → art-title-<name>    (width 1080)
#   game icons   games/<mode id>.png         → game-<mode id>      (256 square)
#   UI icons     icons/<name>-capture.png    → icon3d-<name>       (256 square)
#   moments      titles/<m>-lettering-keyed  → art-moment-<m>      (width 900)
#   scenes       scenes/<scene>.png          → art-scene-<scene>   (width 600)
#   game titles  titles/gt-<id>-title.png    → art-game-<id>       (width 900)
# Web:     apps/web/public/art/<name>.webp
# Android: res/drawable-nodpi/<name with _>.webp
# iOS:     Assets.xcassets/<name>.imageset/<name>.png
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
os.makedirs(WEB, exist_ok=True)

DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
PAGES = ['friends', 'stats', 'records', 'vs', 'puzzles', 'wotd', 'settings', 'howto', 'gopro', 'moregames',
         'welcome', 'leaderboard', 'dailies']
GAMES = ['practice', 'vs', 'quordle', 'octordle', 'sequence', 'rescue', 'six', 'seven', 'gauntlet',
         'propernoundle', 'more', 'sudoku', 'scramble', 'hub', 'crossword', 'groups', 'ladder',
         'cryptogram', 'wordsearch', 'regions',
         'pocket-rps', 'pocket-ttt', 'pocket-coin', 'pocket-pass', 'pocket-ghost', 'pocket-chain']
MOMENTS = ['victory', 'soclose', 'sweep', 'flawless', 'youwin', 'youlose', 'draw', 'newrecord', 'streak']
SCENES = ['r-asleep', 'r-unplugged', 'u-alldone', 'o3-notfound', 'i-invite', 'd-nostats']
UI = ['badge-w', 'badge-l', 'badge-check', 'lock', 'bell', 'add-friend', 'share', 'sound', 'back']


def trim(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox())


def despeck(im):
    """Drop specks/hairlines left by the capture (components under 0.4% of the biggest)."""
    import numpy as np
    from scipy import ndimage
    a = np.array(im)
    lab, n = ndimage.label(a[..., 3] > 40)
    if n > 1:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= sz.max() * 0.004])
        a[..., 3] = np.where(ndimage.binary_dilation(keep, iterations=2), a[..., 3], 0)
    return Image.fromarray(a)


def wide(path, width=1080):
    im = trim(despeck(Image.open(path).convert('RGBA')))
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    return im


def square(path, size=256, margin=0.06):
    im = trim(Image.open(path).convert('RGBA'))
    inner = int(size * (1 - 2 * margin))
    s = inner / max(im.size)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return out


ONLY = sys.argv[1:]  # optional name prefixes to (re)ship, e.g. art-title-welcome


def ship(name, im):
    if ONLY and not any(name.startswith(o) for o in ONLY):
        return
    im.save(os.path.join(WEB, f'{name}.webp'), 'WEBP', quality=92, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=92, method=6)
    iset = os.path.join(IOS, f'{name}.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, f'{name}.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': f'{name}.png', 'idiom': 'universal'}],
                   'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


n = 0
for d in DAYS:
    ship(f'art-day-{d}', wide(os.path.join(HERE, 'titles', f'{d}-keyed.png'))); n += 1
for p in PAGES:
    ship(f'art-title-{p}', wide(os.path.join(HERE, 'titles', f'{p}-cast.png'))); n += 1
for g in GAMES:
    ship(f'game-{g}', square(os.path.join(HERE, 'games', f'{g}.png'))); n += 1
for u in UI:
    ship(f'icon3d-{u}', square(os.path.join(HERE, 'icons', f'{u}-capture.png'))); n += 1
for m in MOMENTS:
    ship(f'art-moment-{m}', wide(os.path.join(HERE, 'titles', f'{m}-lettering-keyed.png'), 900)); n += 1
for sc in SCENES:
    ship(f'art-scene-{sc}', wide(os.path.join(HERE, 'scenes', f'{sc}.png'), 600)); n += 1
for g in GAMES:
    if g.startswith('pocket-') or g in ('vs', 'more'):
        continue
    ship(f'art-game-{g}', wide(os.path.join(HERE, 'titles', f'gt-{g}-title.png'), 900)); n += 1
ship('art-bg-tiles', Image.open(os.path.join(HERE, 'backgrounds', 'tile-pattern.png')).convert('RGBA')); n += 1
print('shipped', n)
