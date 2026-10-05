# Builds the harness-only asset catalog (Extras.xcassets) next to the widget's own catalog:
# the app's shipped lettering + cast poses, the seasonal (Halloween / Thanksgiving) costumes,
# titles and props, and one sample "player's own mascot" composed with the avatar maker's
# own parts (docs/design/brand/avatar) -- the same kind of cutout WidgetAvatarSnapshot writes.
#   python3 extras.py <out-dir>
# Everything is downscaled to <= 512 px (the widget never draws art larger than ~190 pt @3x).
import glob, json, os, sys
from PIL import Image

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
APP = os.path.join(REPO, 'apps/ios/Wordocious/Resources/Assets.xcassets')
SEA = os.path.join(REPO, 'docs/design/brand/seasons')
OUT = os.path.join(sys.argv[1], 'Extras.xcassets')
os.makedirs(OUT, exist_ok=True)
json.dump({'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(OUT, 'Contents.json'), 'w'))


def put(name, im, cap=512):
    im = im.convert('RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb:
        im = im.crop(bb)  # trim transparent margins so frames hug the art
    im.thumbnail((cap, cap), Image.LANCZOS)
    d = os.path.join(OUT, name + '.imageset')
    os.makedirs(d, exist_ok=True)
    im.save(os.path.join(d, name + '.png'))
    json.dump({'images': [{'filename': name + '.png', 'idiom': 'universal'}],
               'info': {'author': 'xcode', 'version': 1}}, open(os.path.join(d, 'Contents.json'), 'w'))


def app(name, cap=512, trim=True):
    f = glob.glob(os.path.join(APP, name + '.imageset', '*.png'))[0]
    im = Image.open(f)
    put(name if trim else name, im, cap)


# Shipped lettering (the app's page titles + moments), wide caps -> 900 px.
for n in ['art-titlecast-dailies', 'art-titlecast-puzzles', 'art-titlecast-wotd', 'art-titlecast-leaderboard',
          'art-titlecast-friends', 'art-moment-sweep', 'art-moment-streak', 'art-titlecast-onastreak',
          'art-titlecast-sweep']:
    app(n, cap=900)

# Shipped cast poses (never w-cheer / w-lean: the angry-brow W).
for f in sorted(glob.glob(os.path.join(APP, 'art-pose-*.imageset'))):
    n = os.path.basename(f)[:-9]
    if n in ('art-pose-w-cheer', 'art-pose-w-lean'):
        continue
    app(n, cap=384)
for n in ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']:
    app('mascot-' + n, cap=384)

# Seasonal library: costumes, lettering, props.
for season, tag in [('halloween', 'hw'), ('thanksgiving', 'tg')]:
    for n in ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']:
        put(f'art-{tag}-{n}', Image.open(os.path.join(SEA, season, 'cast', n + '.png')), 384)
    for key, file in [('dailies', 'dailies'), ('puzzles', 'puzzles'), ('wotd', 'page-wordoftheday'),
                      ('leaderboard', 'page-leaderboard'), ('friends', 'page-friends')]:
        put(f'art-{tag}-title-{key}', Image.open(os.path.join(SEA, season, 'titles', file + '.png')), 900)
    props = (['moon-crescent', 'bat-flying', 'pumpkin', 'stars-cluster'] if season == 'halloween'
             else ['leaf-maple', 'leaf-oak', 'acorn', 'wheat'])
    for p in props:
        put(f'art-{tag}-prop-{p}', Image.open(os.path.join(SEA, season, 'props', p + '.png')), 256)

# A sample player's own mascot (the avatar maker's parts + its preview composer).
src = open(os.path.join(REPO, 'docs/design/brand/avatar/preview-avatars.py')).read().split('\nCFG = [')[0]
ns = {'__file__': os.path.join(REPO, 'docs/design/brand/avatar/preview-avatars.py')}
exec(src.replace('U = 300', 'U = 512'), ns)
me = ns['mascot']('classic', '#0d9488', 'happy', 'grin', 'none', 'party', 'none', 'cape', 'B')
put('art-player-mascot', me, 384)
print('extras ok:', len(os.listdir(OUT)) - 1, 'image sets')
