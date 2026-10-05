# Builds docs/design/widgets-2026-10-04/options.html (one self-contained page, WebP data URIs)
# from the harness renders (build.sh OUT_DIR) + manifest.json.
#   python3 gallery.py <renders-dir> <out.html>
import base64, io, json, os, sys
from PIL import Image

R, OUT = sys.argv[1], sys.argv[2]
man = {m['id']: m for m in json.load(open(os.path.join(R, 'manifest.json')))}
SIZES = {'small': (170, 170), 'medium': (364, 170), 'large': (364, 382),
         'circular': (100, 100), 'rectangular': (196, 100), 'inline': (281, 50)}
total = 0


def img(id_, alt):
    global total
    m = man[id_]
    im = Image.open(os.path.join(R, id_ + '.png')).convert('RGBA')
    w, h = SIZES[m['family']]
    im = im.resize((w * 2, h * 2), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=80, method=4)
    total += b.tell()
    src = 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
    return f'<img src="{src}" width="{w}" height="{h}" alt="{alt}" loading="lazy">'


def fig(id_, label, alt=None):
    return f'<figure>{img(id_, alt or label)}<figcaption>{label}</figcaption></figure>'


STATES = [('fresh', 'Fresh day 0/8'), ('mid', 'Mid-day 5/8'), ('swept', 'Swept 8/8'),
          ('milestone', 'Streak milestone (14)'), ('guest', 'Guest')]
THEMES = [('dark', 'Dark'), ('ocean', 'Ocean'), ('forest', 'Forest'), ('halloween', 'Halloween'),
          ('thanksgiving', 'Thanksgiving')]

CONCEPTS = {
    'ring': ('Ring first', 'The eight-color ring is the hero and the day\'s host <b>sits on it</b>.',
             {'small': 'Today: ring + corner mascot + two caps lines. New: the ring is centered and bigger, the mascot sits on it, one symmetric stat row (streak | time left).',
              'medium': 'Today: ring + 4×2 chips + a dotted stat line. New: no chip grid; DAILIES lettering, the next game as a tile, then streak, time left and points as labeled icon stats. Swept turns the lettering into SWEEP! and points at a bonus Puzzle.',
              'large': 'Today: header, ring, chips, Puzzles grid. New: a symmetric triad (streak | ring | points), one row of eight tiles as the ring\'s legend, then PUZZLES lettering and ten mini tiles.'}),
    'board': ('Board first', 'The tiles <b>are</b> the widget: every game one tap away, rows headed by the app\'s own lettering.',
              {'small': 'New: a 4×2 board under DAILIES lettering with the count, streak and time left below. No ring, no mascot (the cleanest option).',
               'medium': 'New: both rows on one medium (8 dailies + 10 Puzzles), each headed by lettering; O3 peeks over the tiles (sleepy R at 0/8, your mascot on big days).',
               'large': 'Today\'s large minus the ring and the plain caps: lettering headers, bigger tiles, a cast member peeking over the board.'}),
    'streak': ('Streak hero', 'Your own mascot <b>holds the streak flame</b>; a Monday-to-Sunday strip shows the run.',
               {'small': 'New widget. The player\'s mascot with the flame at its side, the week strip below (today in amber). Milestones swap the caps for ON A STREAK! lettering. Guests get W and a gray flame.',
                'medium': 'New widget. Mascot + flame on the left; the number, week strip, today\'s 8-game bar, best streak and shields on the right.'}),
    'next': ('Up next', '<b>W points</b> at the next unplayed daily; the whole widget is one tap into it.',
             {'small': 'New widget. One big target tile with W pointing at it, the name in the accent color, an 8-segment bar. Swept: SWEEP! lettering and your mascot.',
              'medium': 'New widget. The target on the left; the rest of the queue, progress and streak on the right. After a sweep it suggests a Puzzle.'}),
    'wotd': ('Word of the Day', 'The word spelled in <b>glossy cast-color letter tiles</b>, with D (brainy, glasses) beside it.',
             {'small': 'New widget. Pale tiles + "Guess what it means." until the quiz is done, then glossy tiles and the meaning.',
              'medium': 'New widget. Word, pronunciation and meaning on the left; D takes notes before the quiz and has his eureka after.'}),
    'rank': ('Leaderboard rank', 'Today\'s rank as the hero, with how far you moved.',
             {'small': 'New widget. LEADERBOARD lettering, trophy + rank (gold in the top 10, crown in the top 3), the field size and the move. Before your first game it shows yesterday\'s rank.',
              'medium': 'New widget. Adds a top-3 podium (initial tiles on gold, silver and bronze blocks; fills, no outlines).'}),
    'friends': ('Friends race', 'The same eight dailies as a <b>race</b>: each lane fills as a friend plays.',
                {'small': 'New widget. Top three lanes, your lane in your real game colors with your mascot, one line on where you stand.',
                 'medium': 'New widget. Four lanes with names; the standing moves to the header.',
                 'large': 'New widget. Six lanes, O1 the cheerleader in the header (cheering when you lead), friend streaks + time left at the foot.'}),
    'puzzles': ('Puzzles only', 'The ten Puzzles get their own ring; <b>C the explorer</b> sits on it.',
                {'small': 'New widget. PUZZLES lettering, a ten-segment ring, C with the telescope before you start, then sitting; your mascot when all ten are solved.',
                 'medium': 'New widget. The ring + the 5×2 Puzzle tiles.',
                 'large': 'New widget. A 10-segment bar, every Puzzle as a named tile, C peeking over the last one, a puzzle streak.'}),
}
ORDER = ['ring', 'board', 'streak', 'next', 'wotd', 'rank', 'friends', 'puzzles']
RECO = {('medium', 'ring'): 1, ('medium', 'friends'): 2, ('small', 'streak'): 3}
RECO_WHY = {
    ('medium', 'ring'): 'The cleanest step from today: one hero, labeled stats, lettering, and a mascot that sits on the ring rather than floating in a corner. Works in every theme and state.',
    ('medium', 'friends'): 'The strongest new reason to keep a widget: the friends race turns the dailies into a live competition without adding any boxes.',
    ('small', 'streak'): 'The most personal one: the player\'s own mascot holding the flame, with the week strip as a quiet habit nudge.',
}


def concept_block(fam, cid):
    title, lede, notes = CONCEPTS[cid]
    rank = RECO.get((fam, cid))
    tag = f'<span class="reco">Recommended #{rank}</span>' if rank else ''
    anchor = f'{fam}-{cid}'
    states = ''.join(fig(f'{cid}-{fam}-{s}-light', lab) for s, lab in STATES)
    themes = ''.join(fig(f'{cid}-{fam}-mid-{t}', f'{lab}, mid-day') for t, lab in THEMES)
    themes += fig(f'{cid}-{fam}-swept-dark', 'Dark, swept')
    return f'''<section class="concept" id="{anchor}">
  <h3>{title} {tag}</h3>
  <p class="lede">{lede}</p>
  <p class="note">{notes[fam]}</p>
  <h4>States (Default theme)</h4><div class="row {fam}">{states}</div>
  <h4>Themes</h4><div class="row {fam}">{themes}</div>
</section>'''


fams = [('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')]
body = []
# Recommended strip
rec = []
for (fam, cid), n in sorted(RECO.items(), key=lambda kv: kv[1]):
    rec.append(f'''<a class="rec" href="#{fam}-{cid}"><div class="rank">#{n}</div>
      {img(f"{cid}-{fam}-mid-light", CONCEPTS[cid][0])}
      <div><b>{CONCEPTS[cid][0]}, {fam}</b><p>{RECO_WHY[(fam, cid)]}</p></div></a>''')
body.append(f'<section id="top"><h2>Top 3</h2><div class="recs">{"".join(rec)}</div></section>')

# Today
today = ''.join(fig(f'today-{f}-{t}', f'{F}, {t.title()}') for f, F in fams for t in ['light', 'dark'])
body.append(f'<section id="today"><h2>Today\'s widget (for comparison)</h2><p class="note">Shipping 2.7 build, mid-day 5/8. Every option below keeps its calm backdrop, glossy tiles, game-color ring and Nunito numbers.</p><div class="row mixed">{today}</div></section>')

for fam, F in fams:
    blocks = [concept_block(fam, c) for c in ORDER if f'{c}-{fam}-mid-light' in man]
    body.append(f'<section class="family" id="{fam}"><h2>{F}</h2>{"".join(blocks)}</section>')

# Lock screen
lock = [('lock-circular-ring-fresh', 'Circular ring, 0/8'), ('lock-circular-ring-mid', 'Circular ring, 5/8'),
        ('lock-circular-ring-swept', 'Circular ring, 8/8'), ('lock-circular-flame-mid', 'Circular streak'),
        ('lock-circular-flame-milestone', 'Circular streak, 14'),
        ('lock-rect-progress-fresh', 'Rectangular progress, 0/8'), ('lock-rect-progress-mid', 'Rectangular progress, 5/8'),
        ('lock-rect-progress-swept', 'Rectangular progress, swept'), ('lock-rect-word-mid', 'Rectangular Word of the Day'),
        ('lock-rect-race-mid', 'Rectangular friends race'), ('lock-inline-mid', 'Inline')]
body.append('<section class="family" id="lock"><h2>Lock Screen</h2><p class="note">Today ships only the rectangular headline. The system tints lock-screen widgets (no color, no lettering, no mascots), so these are drawn in white with SF Rounded; shown here on a sample wallpaper. New: a segmented ring gauge, a streak circle, an 8-segment progress bar, Word of the Day, a mini race and an inline line.</p>'
            f'<div class="row lock">{"".join(fig(i, l) for i, l in lock)}</div></section>')

# Personality
place = [('persona-place-none', 'No mascot'), ('persona-place-sit', 'Day host sits on the ring'),
         ('persona-place-own', 'Your mascot sits on the ring'), ('persona-place-hold', 'Your mascot holds the flame'),
         ('persona-place-point', 'W points at the next game'), ('persona-place-peek', 'Peeks over the tiles')]
days = [('mon', 'Mon D'), ('tue', 'Tue I'), ('wed', 'Wed U'), ('thu', 'Thu S'), ('fri', 'Fri O2'), ('sat', 'Sat O1'), ('sun', 'Sun O3')]
cameo = ''
for t, lab in [('light', 'Default'), ('halloween', 'Halloween costumes'), ('thanksgiving', 'Thanksgiving costumes')]:
    cameo += f'<h4>{lab}</h4><div class="row small">{"".join(fig(f"persona-cameo-{d}-{t}", dl) for d, dl in days)}</div>'
body.append(f'''<section class="family" id="personality"><h2>Personality</h2>
<p class="note">One cast member per widget, never two of the same, never in a box. The mood rule used across every option above:
<b>0/8</b> sleepy R (nightcap, cocoa or sitting) · <b>playing</b> the concept's own cast member (D on the ring, O3 over the board, C on the Puzzles, D for words, O1 for friends, W pointing) ·
<b>swept or a streak milestone</b> the player's own mascot · <b>guest</b> W waving or sitting. All motion-free: the mood is the pose.</p>
<h4>Placements (same moment, mid-day)</h4><div class="row mixed">{"".join(fig(i, l) for i, l in place)}</div>
<h3>Rotating cast cameo</h3><p class="note">The day host sits on the ring (the app's Bot of the Day rotation). In season the costume replaces the pose.</p>{cameo}
</section>''')

body.append('''<section class="family" id="notes"><h2>What it would take</h2>
<ul>
<li><b>Data:</b> the widget snapshot gains today's rank + move + field size, a friends race list (name, initial, color, games done), the Word of the Day (word, pronunciation, meaning, quiz done), the last 7 streak days, best streak, the puzzle streak and the in-app theme id. All small fields written by WidgetBridge after each game.</li>
<li><b>Widget catalog:</b> add the page lettering (DAILIES, PUZZLES, WORD OF THE DAY, LEADERBOARD, FRIENDS, SWEEP!, ON A STREAK!), the sit / point / notes / eureka / telescope poses and the seasonal costumes + lettering via scripts/sync-widget-assets.sh (≈1.5 MB more at widget sizes).</li>
<li><b>Themes:</b> the widget follows the in-app theme (Default, Dark, Ocean, Forest); Halloween (Oct 17 to Nov 1) and Thanksgiving (Nov 16 to 27) skins switch on by date.</li>
<li><b>New art that would help (none is required to ship these):</b> a real "holding the flame" pose (today it is your mascot with the flame at its side); sit poses in the Halloween and Thanksgiving costumes (in season the costume stands on the ring instead of sitting); a sleepy pose for every host, not only R; seasonal layers for the player's own mascot (the avatar snapshot has no costume); and small-size versions of the lettering with thinner rims for 15 to 20 pt headers. The Halloween and Thanksgiving library is still marked draft in the seasons manifest.</li>
<li><b>Android:</b> these are SwiftUI views rendered from the real widget code; the picked options get the same layouts in the Android widget after the founder chooses.</li>
</ul></section>''')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Widget Options</title>
<style>
:root {{ --bg:#f7f4ff; --ink:#2a1a4a; --muted:#6b5b8a; --accent:#7c3aed; --gold:#b45309; --rule:#e6def8; --chip:#efe8ff; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#140d22; --ink:#efe7ff; --muted:#b4a3d6; --accent:#b79bff; --gold:#fcd34d; --rule:#2c2145; --chip:#24183a; }} }}
:root[data-theme="dark"] {{ --bg:#140d22; --ink:#efe7ff; --muted:#b4a3d6; --accent:#b79bff; --gold:#fcd34d; --rule:#2c2145; --chip:#24183a; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 -apple-system, "SF Pro Rounded", system-ui, sans-serif; }}
main {{ max-width:1240px; margin:0 auto; padding:24px 16px 80px; }}
header h1 {{ font-size:30px; margin:0 0 4px; letter-spacing:-.01em; }}
header p {{ color:var(--muted); margin:0 0 12px; max-width:760px; }}
nav {{ position:sticky; top:0; background:var(--bg); padding:10px 0; z-index:5; display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid var(--rule); }}
nav a {{ color:var(--accent); text-decoration:none; font-weight:700; font-size:13px; padding:4px 10px; border-radius:999px; background:var(--chip); }}
h2 {{ font-size:24px; margin:40px 0 8px; }}
h3 {{ font-size:19px; margin:28px 0 2px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }}
h4 {{ font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:14px 0 6px; }}
.lede {{ margin:2px 0; }} .note {{ color:var(--muted); margin:2px 0 6px; max-width:860px; }}
section {{ scroll-margin-top:96px; }}
.concept {{ padding-bottom:18px; border-bottom:1px solid var(--rule); }}
.row {{ display:flex; flex-wrap:wrap; gap:14px 14px; }}
figure {{ margin:0; max-width:100%; min-width:0; flex:0 1 auto; }}
.recs > * {{ min-width:0; }}
figure img {{ display:block; max-width:100%; height:auto; filter:drop-shadow(0 4px 10px rgba(40,20,80,.16)); }}
figcaption {{ font-size:12px; color:var(--muted); margin-top:5px; }}
.reco {{ font-size:12px; font-weight:800; color:#fff; background:linear-gradient(#f59e0b,#d97706); padding:2px 9px; border-radius:999px; }}
.recs {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:18px; }}
.rec {{ display:flex; flex-direction:column; gap:8px; text-decoration:none; color:inherit; }}
.rec .rank {{ font-weight:900; color:var(--gold); font-size:20px; }}
.rec img {{ max-width:100%; height:auto; filter:drop-shadow(0 4px 10px rgba(40,20,80,.16)); }}
.rec p {{ margin:2px 0 0; color:var(--muted); font-size:14px; }}
ul {{ max-width:860px; padding-left:20px; }} li {{ margin:6px 0; }}
</style></head><body><main>
<header><h1>Widget options</h1>
<p>Design night, Oct 4. Eight concepts across small, medium and large, plus the lock screen, each shown in all five states and six themes.
Every image is the real SwiftUI view rendered from the shipping widget's own code (glossy tiles, game-color ring, Nunito), so any of them can be built as is.
No boxes or outlines anywhere, the app's lettering instead of plain headings, one cast member at a time, all shipped art.</p></header>
<nav><a href="#top">Top 3</a><a href="#today">Today</a><a href="#small">Small</a><a href="#medium">Medium</a><a href="#large">Large</a><a href="#lock">Lock Screen</a><a href="#personality">Personality</a><a href="#notes">What it takes</a></nav>
{"".join(body)}
</main></body></html>'''
open(OUT, 'w').write(html)
print('images', round(total / 1e6, 2), 'MB; html', round(os.path.getsize(OUT) / 1e6, 2), 'MB')
