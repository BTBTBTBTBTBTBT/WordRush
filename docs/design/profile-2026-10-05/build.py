# Builds options.html — Edit Profile + mascot-maker + featured-title options (design only, 10-05).
#   python3 docs/design/profile-2026-10-05/build.py
# Inputs: src/current (sim screenshots, -storeDemo), src/chatgpt (ChatGPT mockups, illustrative),
# src/renders (REAL mascot renders: core avatarLayout + avatar_draw.py, the same recipe as the apps),
# apps/web/public/art (real lettering, badge, frame, part and game art).
import base64, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ART = os.path.join(REPO, 'apps', 'web', 'public', 'art')
SRC = os.path.join(HERE, 'src')


def uri(path):
    ext = path.rsplit('.', 1)[1]
    mime = {'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg'}[ext]
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


A = {}


def add(key, path):
    A[key] = uri(path)
    return key


# current screenshots
for n in ['01-stats', '02-edit-top', '03b-builder', '05-hats', '04a-mid', '04-edit-3', '06-home', '07-leaderboard']:
    add('cur-' + n, os.path.join(SRC, 'current', n + '.webp'))
# ChatGPT mockups
for n in sorted(os.listdir(os.path.join(SRC, 'chatgpt'))):
    if n.endswith('.webp'):
        add('gpt-' + n[:-5], os.path.join(SRC, 'chatgpt', n))
# real renders
for n in sorted(os.listdir(os.path.join(SRC, 'renders'))):
    add('r-' + n[:-5], os.path.join(SRC, 'renders', n))
# real art
for n in ['art-titlecast-editprofile', 'art-titlecast-mascot', 'art-frame-gold', 'art-frame-silver', 'art-frame-bronze',
          'art-frame-platinum', 'art-frame-diamond', 'art-badge-level-silver', 'game-practice', 'game-gauntlet',
          'game-quordle', 'game-octordle', 'game-six', 'art-titlecast-achievement', 'art-av-eyes-sparkly',
          'art-av-mouth-grin', 'art-av-acc-cape', 'art-badge-level-gold']:
    add(n, os.path.join(ART, n + '.webp'))
HATS = ['none', 'wizard', 'crown', 'party', 'beanie', 'pirate', 'cowboy', 'chef', 'tophat', 'propeller', 'catears',
        'halo', 'flowercrown', 'santa', 'grad', 'sprout', 'viking', 'astronaut']
for h in HATS:
    if h != 'none':
        add('acc-' + h, os.path.join(ART, f'art-av-acc-{h}.webp'))

# featured titles: the live catalog (wordocious.com/api/achievements), only the ones with badge art
cat = json.load(open(os.path.join(SRC, 'achievements.json')))['achievements']
cat = [a for a in cat if not a.get('hidden') and os.path.exists(os.path.join(ART, f"art-ach-{a['key']}.webp"))]
EARNED = {'speed_demon', 'octo_boss', 'streak_7', 'streak_30', 'gauntlet_god', 'daily_sweep',
          'first_win', 'daily_debut', 'all_modes', 'centurion', 'century_club', 'thousand_words', 'flawless_victory',
          'hat_trick', 'eagle_eye', 'rising_star', 'linguist', 'wordsmith', 'best_buds', 'cheerleader',
          'hive_mind', 'crossword_first', 'crossword_regular', 'sudoku_first', 'dress_up', 'self_portrait', 'early_bird',
          'night_owl', 'medal_10', 'golden_touch', 'rival', 'vs_veteran', 'three_in_a_row', 'called_it', 'wake_up_call',
          'meet_the_cast', 'spooky_season', 'classic_master', 'lucky_seven', 'six_shooter', 'blitz', 'close_call'}
RECENT = ['gauntlet_god', 'crossword_regular', 'octo_boss', 'dress_up', 'speed_demon']
SHELVES = [('skill', 'Skill'), ('consistency', 'Streaks'), ('beginner', 'Firsts'), ('puzzles', 'Puzzles'),
           ('social', 'VS'), ('friends', 'Friends'), ('collection', 'Medals'), ('mascot', 'Mascot'), ('pocket', 'Pocket'),
           ('bots', 'Bots'), ('streaks', 'Time of day'), ('seasonal', 'Seasonal')]
used = set(RECENT)
for c, _ in SHELVES:
    for a in [x for x in cat if x['category'] == c][:9]:
        used.add(a['key'])
for k in used:
    add('ach-' + k, os.path.join(ART, f'art-ach-{k}.webp'))
TITLES = [{'k': a['key'], 'n': a['name'], 'c': a['category'], 'd': a.get('description', ''), 'e': a['key'] in EARNED} for a in cat if a['key'] in used]
CC = {}
for a in json.load(open(os.path.join(SRC, 'achievements.json')))['achievements']:
    if a.get('hidden'):
        continue
    e = CC.setdefault(a['category'], [0, 0]); e[1] += 1; e[0] += a['key'] in EARNED

html = open(os.path.join(HERE, 'page.html')).read()
html = html.replace('/*__ASSETS__*/', 'const A=' + json.dumps(A) + ';')
html = html.replace('/*__TITLES__*/', 'const TITLES=' + json.dumps(TITLES) + ';const RECENT=' + json.dumps(RECENT) +
                    ';const SHELVES=' + json.dumps(SHELVES) + ';const HATS=' + json.dumps(HATS) + ';const CC=' + json.dumps(CC) + ';')
html = html.replace('__NCAT__', str(len([a for a in json.load(open(os.path.join(SRC, 'achievements.json')))['achievements'] if not a.get('hidden')])))
out = os.path.join(HERE, 'options.html')
open(out, 'w').write(html)
print(out, round(os.path.getsize(out) / 1e6, 2), 'MB', len(A), 'assets')
