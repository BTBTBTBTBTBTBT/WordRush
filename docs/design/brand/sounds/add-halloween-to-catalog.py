"""Adds the Halloween section to the admin Sound Library (item 49: "put both into the Sound Library for the founder's listen").
  python3 docs/design/brand/sounds/add-halloween-to-catalog.py        (idempotent; run after make-halloween.py)
Writes: apps/web/lib/admin/sound-catalog.json (+ a 'halloween' section), the option clips under
apps/web/public/admin/sound-library/, and the seed rows in docs/sql/20261010-sound-library.sql. Nothing is ever the LIVE
sound here: the Halloween jingle / notes play only in season (registry slots.sounds); 'now' = what plays today (the
everyday ones), A = the Halloween version. The founder listens and comments inline; the slot switches on with the season.
Re-run export-sound-catalog.py first? It regenerates the catalog WITHOUT this section, so run this script after it."""
import json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
CATALOG = os.path.join(ROOT, 'apps/web/lib/admin/sound-catalog.json')
CLIPS = os.path.join(ROOT, 'apps/web/public/admin/sound-library')
SQL = os.path.join(ROOT, 'docs/sql/20261010-sound-library.sql')
OPT = os.path.join(HERE, 'options')
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
COLORS = ["#7c3aed", "#f59e0b", "#94a3b8", "#2563eb", "#ec4899", "#0891b2", "#059669", "#f97316", "#7e22ce", "#ca8a04"]
TITLE = 'Halloween (in season only)'
NOTES_TITLE = 'The musical cast, spooky voicings'
INTRO_TITLE = 'Halloween intro (same melody, minor key)'

os.makedirs(CLIPS, exist_ok=True)
for name in ['intro-halloween-a'] + [f'note-h-{c}' for c in CAST]:
    shutil.copyfile(os.path.join(OPT, f'{name}.m4a'), os.path.join(CLIPS, f'{name}.m4a'))

section = {
    'id': 'halloween', 'title': TITLE,
    'blurb': 'Oct 17 - Nov 1 only. The registry swaps these in (slots.sounds); the everyday sounds return Nov 1. All synthesized in-house, nothing recorded.',
    'events': [
        {'id': 'intro', 'title': INTRO_TITLE,
         'note': 'The same melody and timing as the app intro, in C minor: bone-xylophone and celesta, a church bell and an organ swell on the landing.',
         'grid': None, 'colors': None,
         'candidates': [
             {'opt': 'now', 'letter': 'Now', 'name': 'intro', 'clips': ['/sounds/intro.m4a'], 'live': True, 'shipped': 'intro'},
             {'opt': 'a', 'letter': 'A', 'name': 'Spooky parade', 'keys': ['intro-halloween-a'], 'clips': ['/admin/sound-library/intro-halloween-a.m4a'], 'live': False, 'same': False},
         ]},
        {'id': 'notes', 'title': NOTES_TITLE,
         'note': 'Each hero keeps its own voice; an organ (W, S, O), celesta (R, C, U), bone-xylophone (O, I) or low strings (D, O) plays under it. Tap the cast in musical mode.',
         'grid': ['W', 'O', 'R', 'D', 'O', 'C', 'I', 'O', 'U', 'S'], 'colors': COLORS,
         'candidates': [
             {'opt': 'now', 'letter': 'Now', 'name': 'What plays today', 'clips': [f'/sounds/note-{c}.m4a' for c in CAST], 'live': True, 'shipped': [f'note-{c}' for c in CAST]},
             {'opt': 'a', 'letter': 'A', 'name': 'Spooky voicings', 'detail': 'Each hero + an organ / celesta / bones / strings layer', 'keys': [f'note-h-{c}' for c in CAST],
              'clips': [f'/admin/sound-library/note-h-{c}.m4a' for c in CAST], 'live': False, 'same': False},
         ]},
    ],
}
d = json.load(open(CATALOG))
d['sections'] = [s for s in d['sections'] if s['id'] != 'halloween']
i = next((k for k, s in enumerate(d['sections']) if s['id'] == 'app'), len(d['sections']))
d['sections'].insert(i + 1, section)
with open(CATALOG, 'w') as f:
    json.dump(d, f, indent=1, ensure_ascii=False); f.write('\n')

# seed rows
sql = open(SQL).read()
sql = re.sub(r"\n  \('halloween/[^\n]*\),?(?=\n)", '', sql)   # drop earlier Halloween rows (idempotent)
sql = re.sub(r",+\s*\n(on conflict \(id\) do update set section)", r"\n\1", sql)   # no dangling comma before the upsert
sorts = [int(m) for m in re.findall(r", (\d+)\)[,\n]", sql[sql.index('-- BEGIN SEED'):])] if '-- BEGIN SEED' in sql else [708]
start = max(sorts) + 1
rows = []
def row(ev, evt, opt, name, clips, shipped, live):
    global start
    sh = 'null' if shipped is None else f"'{shipped}'"
    rows.append(f"  ('halloween/{ev}/{opt}', 'halloween', '{TITLE}', '{ev}', '{evt}', '{opt}', '{name}', '{{{clips}}}', {sh}, {'true' if live else 'false'}, {start})")
    start += 1
row('intro', INTRO_TITLE, 'now', 'intro', '', 'intro', True)
row('intro', INTRO_TITLE, 'a', 'Spooky parade', 'intro-halloween-a', None, False)
row('notes', NOTES_TITLE, 'now', 'What plays today', '', None, True)
row('notes', NOTES_TITLE, 'a', 'Spooky voicings', ','.join(f'note-h-{c}' for c in CAST), None, False)
marker = "\non conflict (id) do update set section = excluded.section"
last = sql.rindex(marker)
sql = sql[:last] + ',\n' + ',\n'.join(rows) + sql[last:]
open(SQL, 'w').write(sql)
print('halloween section added:', len(section['events']), 'events,', len(rows), 'seed rows')
