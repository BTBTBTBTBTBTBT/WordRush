# Ship the art pass (docs/ART_PLAN.md, docs/ART_SPEC.md) to the three apps.
# Web + Android get WebP (q92, ~100 KB a title); iOS gets PNG image sets.
#   day titles   titles/<day>-keyed.png      → art-day-<day>       (width 1080)
#   page titles  titles/<name>-cast.png      → art-title-<name>    (width 1080)
#   game icons   games/<mode id>.png         → game-<mode id>      (256 square)
#   UI icons     icons/<name>-capture.png    → icon3d-<name>       (256 square)
#   moments      titles/<m>-lettering-keyed  → art-moment-<m>      (width 900)
#   scenes       scenes/<scene>.png          → art-scene-<scene>   (width 600)
#   game titles  titles/gt-<id>-title.png    → art-game-<id>       (width 1200)
# Web:     apps/web/public/art/<name>.webp
# Android: res/drawable-nodpi/<name with _>.webp
# iOS:     Assets.xcassets/<name>.imageset/<name>.png (art-wall-*: Wallpapers.xcassets)
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
WEB = os.path.join(REPO, 'apps', 'web', 'public', 'art')
IOS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Assets.xcassets')
# The §19 wallpapers get their own iOS catalog so the widget extension (which
# compiles Assets.xcassets) doesn't bundle them.
IOS_WALLS = os.path.join(REPO, 'apps', 'ios', 'Wordocious', 'Resources', 'Wallpapers.xcassets')
DROID = os.path.join(REPO, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi')
os.makedirs(WEB, exist_ok=True)

DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
PAGES = ['friends', 'stats', 'records', 'vs', 'puzzles', 'wotd', 'settings', 'howto', 'gopro', 'moregames',
         'welcome', 'leaderboard', 'dailies', 'guides', 'strategy', 'words', 'faq', 'privacy', 'terms', 'vsbattle',
         'menu']   # MENU: night art 10-03 (FINISH_SPEC AS1)
GAMES = ['practice', 'vs', 'quordle', 'octordle', 'sequence', 'rescue', 'six', 'seven', 'gauntlet',
         'propernoundle', 'more', 'sudoku', 'scramble', 'hub', 'crossword', 'groups', 'ladder',
         'cryptogram', 'wordsearch', 'regions',
         'pocket-rps', 'pocket-ttt', 'pocket-coin', 'pocket-pass', 'pocket-ghost', 'pocket-chain']
MOMENTS = ['victory', 'soclose', 'sweep', 'flawless', 'youwin', 'youlose', 'draw', 'newrecord', 'streak']
SCENES = ['r-asleep', 'r-unplugged', 'u-alldone', 'o3-notfound', 'i-invite', 'd-nostats',
          'pro-crown', 'shield-guard', 'flawless-star', 'sweep-broom', 'banner-sweep', 'banner-flawless', 'vs-faceoff', 'ladder-cleared', 'gauntlet-champion', 'unlimited-loop', 'friends-match', 'invite-sent', 'gift-pro', 'onboard-tiles', 'onboard-score']
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
    if name.startswith('art-wall-'):
        # wallpapers v3 are full phone resolution + opaque: lighter WebP, and JPEG on iOS
        # (a 1179×2556 PNG per screen would add ~100 MB to the app)
        rgb = im.convert('RGB')
        rgb.save(os.path.join(WEB, f'{name}.webp'), 'WEBP', quality=86, method=6)
        if name.endswith('-wide'):
            return   # desktop web only
        rgb.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=86, method=6)
        iset = os.path.join(IOS_WALLS, f'{name}.imageset')
        os.makedirs(iset, exist_ok=True)
        for old in os.listdir(iset):
            if old.endswith('.png'):
                os.remove(os.path.join(iset, old))
        rgb.save(os.path.join(iset, f'{name}.jpg'), 'JPEG', quality=88, optimize=True, progressive=False)
        with open(os.path.join(iset, 'Contents.json'), 'w') as f:
            json.dump({'images': [{'filename': f'{name}.jpg', 'idiom': 'universal'}],
                       'info': {'author': 'xcode', 'version': 1}}, f, indent=2)
        return
    im.save(os.path.join(WEB, f'{name}.webp'), 'WEBP', quality=92, method=6)
    im.save(os.path.join(DROID, name.replace('-', '_') + '.webp'), 'WEBP', quality=92, method=6)
    iset = os.path.join(IOS_WALLS if name.startswith('art-wall-') else IOS, f'{name}.imageset')
    os.makedirs(iset, exist_ok=True)
    im.save(os.path.join(iset, f'{name}.png'), optimize=True)
    with open(os.path.join(iset, 'Contents.json'), 'w') as f:
        json.dump({'images': [{'filename': f'{name}.png', 'idiom': 'universal'}],
                   'info': {'author': 'xcode', 'version': 1}}, f, indent=2)


n = 0
for d in DAYS:
    ship(f'art-day-{d}', wide(os.path.join(HERE, 'titles', f'{d}-keyed.png'))); n += 1
for p in PAGES:
    # Founder 10-02: the living cast row is the one cast per screen → page titles are lettering only.
    ship(f'art-title-{p}', wide(os.path.join(HERE, 'titles', f'{p}-lettering-keyed.png'))); n += 1
for g in GAMES:
    ship(f'game-{g}', square(os.path.join(HERE, 'games', f'{g}.png'))); n += 1
for u in UI:
    ship(f'icon3d-{u}', square(os.path.join(HERE, 'icons', f'{u}-capture.png'))); n += 1
for m in MOMENTS:
    ship(f'art-moment-{m}', wide(os.path.join(HERE, 'titles', f'{m}-lettering-keyed.png'), 900)); n += 1
for sc in SCENES:
    w_ = 1200 if sc.startswith('banner-') or sc in ('vs-faceoff', 'gauntlet-champion', 'friends-match', 'onboard-tiles') else 900 if sc == 'ladder-cleared' else 900 if sc in ('pro-crown', 'shield-guard', 'flawless-star', 'sweep-broom', 'unlimited-loop', 'invite-sent', 'gift-pro', 'onboard-score') else 600
    ship(f'art-scene-{sc}', wide(os.path.join(HERE, 'scenes', f'{sc}.png'), w_)); n += 1
for g in GAMES:
    if g.startswith('pocket-') or g in ('vs', 'more'):
        continue
    # 10-03: hi-res re-letters + full-res hosts → 1200 wide (was 900 from pane captures)
    ship(f'art-game-{g}', wide(os.path.join(HERE, 'titles', f'gt-{g}-title.png'), 1200)); n += 1
ship('game-sweep', square(os.path.join(HERE, 'games', 'sweep.png'))); n += 1   # Sweep tile (founder 10-02)
for pc in ['star-placed', 'star-correct', 'star-wrong', 'cross']:   # Starsweep pieces (founder 10-02)
    ship(f'art-starsweep-{pc}', square(os.path.join(HERE, 'games', 'starsweep', f'{pc}.png'), 256, 0.04)); n += 1
for pc in ['coin-empty', 'coin-filled', 'coin-hint', 'coin-punchline']:   # Muddle circled-letter coins (founder 10-02)
    ship(f'art-muddle-{pc}', square(os.path.join(HERE, 'games', 'muddle', f'{pc}.png'), 256, 0.02)); n += 1
for pc in ['hex', 'hex-center', 'ttt-x', 'ttt-o']:   # Hubbub hexes + Tic-Tac-Tile pieces (founder 10-02)
    ship(f'art-piece-{pc}', square(os.path.join(HERE, 'games', 'pieces', f'{pc}.png'), 256, 0.03)); n += 1
for md in ['gold', 'silver', 'bronze', 'trophy']:   # 3D medals (founder 10-02)
    ship(f'art-medal-{md}', square(os.path.join(HERE, 'icons', 'medals', f'{md}.png'), 256, 0.03)); n += 1
BADGES_DIR = os.path.join(HERE, 'badges')   # achievement + level badges (founder 10-02)
for f in sorted(os.listdir(BADGES_DIR)) if os.path.isdir(BADGES_DIR) else []:
    if f.endswith('.png'):
        ship('art-badge-' + f[:-4], square(os.path.join(BADGES_DIR, f), 256, 0.03)); n += 1
HALLOWEEN_DIR = os.path.join(HERE, 'cast', 'halloween')   # seasonal cast skins (founder 10-02)
for f in sorted(os.listdir(HALLOWEEN_DIR)) if os.path.isdir(HALLOWEEN_DIR) else []:
    if f.endswith('.png'):
        ship('art-halloween-' + f[:-4], square(os.path.join(HALLOWEEN_DIR, f), 320, 0.02)); n += 1
ship('art-bg-tiles', Image.open(os.path.join(HERE, 'backgrounds', 'tile-pattern.png')).convert('RGBA')); n += 1
# every cast pose on its own (founder 10-02 build: popups, share footers, VS, empty states)
POSES_DIR = os.path.join(HERE, 'poses')
for f in sorted(os.listdir(POSES_DIR)):
    if f.endswith('.png') and f != 'contact-sheet.png':
        ship('art-pose-' + f[:-4], square(os.path.join(POSES_DIR, f), 320, 0.02)); n += 1
WALLS = os.path.join(HERE, 'wallpapers', 'out')
for f in sorted(os.listdir(WALLS)):
    if f.endswith('.png'):
        im = Image.open(os.path.join(WALLS, f)).convert('RGB').convert('RGBA')
        ship('art-' + f[:-4], im); n += 1
WALLS_WIDE = os.path.join(HERE, 'wallpapers', 'out-wide')
for f in sorted(os.listdir(WALLS_WIDE)) if os.path.isdir(WALLS_WIDE) else []:
    if f.endswith('.png'):
        ship('art-' + f[:-4], Image.open(os.path.join(WALLS_WIDE, f))); n += 1
# ── Night art 10-03 (NIGHT-ART-QUEUE.md; full-size ChatGPT downloads) ──
GAUNTLET_DIR = os.path.join(HERE, 'gauntlet')   # AU6 header + stage medallions
if os.path.exists(os.path.join(GAUNTLET_DIR, 'header.png')):
    ship('art-gauntlet-header', wide(os.path.join(GAUNTLET_DIR, 'header.png'), 1200)); n += 1
    for md in ['locked', 'current', 'cleared']:
        ship(f'art-gauntlet-medal-{md}', square(os.path.join(GAUNTLET_DIR, f'medal-{md}.png'), 256, 0.02)); n += 1
AV_DIR = os.path.join(HERE, 'avatar', 'parts')   # avatar maker parts (FINISH_SPEC AN2) — fixed canvases, NOT trimmed
for f in sorted(os.listdir(AV_DIR)) if os.path.isdir(AV_DIR) else []:
    if f.startswith('art-av-') and f.endswith('.png'):
        im = Image.open(os.path.join(AV_DIR, f)).convert('RGBA')
        tw = 640   # compose-avatar.py already sized them: bodies 1024 → 640, back items ≤ 640, the rest ≤ 384
        if im.width > tw:
            im = im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS)
        ship(f[:-4], im); n += 1
ACH_DIR = os.path.join(HERE, 'badges', 'ach')   # a badge per achievement (FINISH_SPEC BD/BE): art-ach-<key>
for f in sorted(os.listdir(ACH_DIR)) if os.path.isdir(ACH_DIR) else []:
    if f.endswith('.png'):
        ship('art-ach-' + f[:-4], square(os.path.join(ACH_DIR, f), 256, 0.03)); n += 1
for sc, w_ in [('achievement', 1200), ('welcome-cast', 1200), ('all-set', 1200), ('banner-halloween', 1200)]:   # BF2, AO
    if os.path.exists(os.path.join(HERE, 'scenes', f'{sc}.png')):
        ship(f'art-scene-{sc}', wide(os.path.join(HERE, 'scenes', f'{sc}.png'), w_)); n += 1
GOPRO_DIR = os.path.join(HERE, 'scenes', 'gopro-sign')   # BJ17: the cast holding GO PRO → art-gopro-sign-<id>
for m in ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']:
    if os.path.exists(os.path.join(GOPRO_DIR, f'{m}.png')):
        ship(f'art-gopro-sign-{m}', wide(os.path.join(GOPRO_DIR, f'{m}.png'), 480)); n += 1
REACT_DIR = os.path.join(HERE, 'icons', 'react')   # friend reactions (FINISH_SPEC AM1): art-react-<key>
for k in ['clap', 'fire', 'wow', 'grr', 'rematch', 'heart']:
    if os.path.exists(os.path.join(REACT_DIR, f'{k}.png')):
        ship(f'art-react-{k}', square(os.path.join(REACT_DIR, f'{k}.png'), 256, 0.03)); n += 1
if os.path.exists(os.path.join(HERE, 'badges', 'sprites', 'icon-clock-sprite.png')):   # AL addendum 2 countdown chip
    ship('art-badge-icon-clock-sprite', square(os.path.join(HERE, 'badges', 'sprites', 'icon-clock-sprite.png'), 256, 0.03)); n += 1
FRAMES_DIR = os.path.join(HERE, 'icons', 'frames')   # rounded-square avatar frames (AH / AN6): art-frame-<tier>
for t in ['bronze', 'silver', 'gold', 'platinum', 'diamond']:
    if os.path.exists(os.path.join(FRAMES_DIR, f'{t}.png')):
        ship(f'art-frame-{t}', square(os.path.join(FRAMES_DIR, f'{t}.png'), 256, 0.0)); n += 1
PROPS_DIR = os.path.join(HERE, 'cast', 'halloween', 'props')   # Halloween props (FINISH_SPEC X)
for pr in ['pumpkin', 'bat', 'candy', 'ghost']:
    if os.path.exists(os.path.join(PROPS_DIR, f'{pr}.png')):
        ship(f'art-halloween-prop-{pr}', square(os.path.join(PROPS_DIR, f'{pr}.png'), 256, 0.03)); n += 1
TOGGLE_DIR = os.path.join(HERE, 'toggles')   # candy segmented-toggle sprites (night queue #10; not wired yet)
for mode in ['light', 'dark']:
    for pc in ['track', 'switch', 'thumb-on', 'thumb-off', 'knob', 'switch-on']:
        f = os.path.join(TOGGLE_DIR, mode, f'{pc}.png')
        if os.path.exists(f):
            ship(f'art-toggle-{mode}-{pc}', wide(f, 480)); n += 1
PODIUM_DIR = os.path.join(HERE, 'podium', 'out')   # podium pedestals + floor plate (make-pedestals.py; FINISH_SPEC BJ4)
for k in ['1', '2', '3']:
    for suf in ['', '-plain']:
        f = os.path.join(PODIUM_DIR, f'{k}{suf}.png')
        if os.path.exists(f):
            ship(f'art-podium-{k}{suf}', wide(f, 300)); n += 1
if os.path.exists(os.path.join(PODIUM_DIR, 'floor.png')):
    ship('art-podium-floor', wide(os.path.join(PODIUM_DIR, 'floor.png'), 1080)); n += 1
CAST_TITLES = os.path.join(HERE, 'titles', 'cast-colors')   # cast-color titles (founder 10-03; not wired until the mapping is confirmed)
# The menu/page set + the pocket-game titles + every TITLE-INVENTORY.md slug (founder 10-03: ship them all;
# call-site wiring is separate).
import re as _re
CAST_TITLE_SET = ['dailies', 'puzzles', 'wotd', 'vsbattle', 'leaderboard', 'stats', 'friends', 'settings', 'gopro', 'strategy',
                  'guides', 'menu', 'welcome', 'howto', 'words', 'moregames', 'records', 'faq', 'privacy', 'terms',
                  'pocket-rps', 'pocket-ttt', 'pocket-coin', 'pocket-pass', 'pocket-ghost', 'pocket-chain', 'pick-friend']
CAST_TITLE_SET += [s_ for s_ in _re.findall(r'^\| (\S+) \| .+? \| \w+ \|$', open(os.path.join(HERE, 'TITLE-INVENTORY.md')).read(), _re.M) if s_ != 'Slug']
for t in CAST_TITLE_SET:
    if os.path.exists(os.path.join(CAST_TITLES, t + '.png')):
        ship('art-titlecast-' + t, wide(os.path.join(CAST_TITLES, t + '.png'), 1080)); n += 1
BTN_DIR = os.path.join(HERE, 'buttons', 'cast', 'out')   # cast-color button skins: three-slice, caps = height / 2 (make-skins.py)
for f in sorted(os.listdir(BTN_DIR)) if os.path.isdir(BTN_DIR) else []:
    if f.endswith('.png'):
        ship('art-btn-' + f[:-4], Image.open(os.path.join(BTN_DIR, f)).convert('RGBA')); n += 1
print('shipped', n)
