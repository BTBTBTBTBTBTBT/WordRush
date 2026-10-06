"""Exports the Sound Library catalog for admin > Design > Sound Library (founder 10-06: "a Sound Library in the
admin portal, like the Art Library"). Reads the Sound Lab's sections (build-lab.py GAMES: every game, every event,
the CURRENT sound and its A/B/C options) and the shipped picks (make-sounds.py PICKS), then writes:
  apps/web/lib/admin/sound-catalog.json      -> the page's sections, events and candidates (+ the shipped picks)
  apps/web/public/admin/sound-library/*.m4a  -> the option clips (behind the /admin middleware gate; the shipped
                                                sounds already live in public/sounds/)
  docs/sql/20261010-sound-library.sql        -> refreshes the seed block (one sound_assets row per candidate)
  python3 docs/design/brand/sounds/export-sound-catalog.py

Every event has a "now" candidate = exactly what ships today (the LIVE one; silent when nothing plays), then the
lab's options. When a lab option is the shipped pick (Classic's win = option A), the option says so ("same").
Nothing here changes a shipped sound: approved picks become make-sounds.py PICKS rows through
apps/web/scripts/sound-picks.ts (dry run), then ship-sounds.sh ships them x3."""
import json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../../../..'))
WEB = os.path.join(ROOT, 'apps/web')
CLIPS = os.path.join(WEB, 'public/admin/sound-library')
CATALOG = os.path.join(WEB, 'lib/admin/sound-catalog.json')
SQL = os.path.join(ROOT, 'docs/sql/20261010-sound-library.sql')

# ── The lab's data (build-lab.py up to the page markup; no lab.html is written) ──
src = open(os.path.join(HERE, 'build-lab.py')).read()
lab = {'__file__': os.path.join(HERE, 'build-lab.py'), '__name__': 'sound_catalog'}
exec(compile(src[:src.index('# ── The page')], 'build-lab.py', 'exec'), lab)
GAMES, CAST = lab['GAMES'], lab['CAST']

# ── The shipped picks (make-sounds.py PICKS) ──
ms = open(os.path.join(HERE, 'make-sounds.py')).read()
block = ms[ms.index('JINGLE, UI, PEAK_CAP'):]
block = block[:block.index('\n}\n') + 3]
picks_ns = {}
exec(block, picks_ns)
PICKS, JINGLE, UI = picks_ns['PICKS'], picks_ns['JINGLE'], picks_ns['UI']

# ── What each event plays today (apps/web/lib/sound-map.ts, same ×3) ──
# A game section uses the pack's sound unless the game has its own scope (Classic today); the app section's
# events with their own shipped name are listed here. Anything else plays the lab row's `current`.
SHIP = {
    ('classic', 'win'): 'classic-win', ('classic', 'loss'): 'classic-lose',
    ('classic', 'streak'): 'classic-streak', ('classic', 'invalid'): 'classic-invalid',
    ('app', 'intro'): 'intro', ('app', 'levelup'): 'levelup', ('app', 'open'): 'open',
    ('hubbub', 'pangram'): 'pangram',
    ('app', 'laugh'): [f'laugh-{c}' for c, _, _ in CAST],
}
SHIPPED = {f[:-4] for f in os.listdir(os.path.join(WEB, 'public/sounds')) if f.endswith('.m4a')}

def clip_file(key):
    """Option clip key -> its file name under public/admin/sound-library ('+' spelled 'plus')."""
    return key.replace('+', 'plus') + '.m4a'

def url(key):
    if key.startswith('cur-'):
        name = key[4:]
        assert name in SHIPPED, f'{name} is not in public/sounds'
        return f'/sounds/{name}.m4a'
    return f'/admin/sound-library/{clip_file(key)}'

def shipped_url(name):
    assert name in SHIPPED, f'{name} is not in public/sounds'
    return f'/sounds/{name}.m4a'

used = set()
sections = []
for g in GAMES:
    events = []
    for r in g['rows']:
        ship = SHIP.get((g['id'], r['id']))
        cur = r['cur'][4:] if r['cur'] else None
        grid = bool(r.get('grid'))
        cands = []
        if grid:
            names = ship if isinstance(ship, list) else ([cur] * len(r['labels']) if cur else None)
            pick_src = [PICKS[n][0] for n in names] if names and all(n in PICKS for n in names) else None
            cands.append(dict(opt='now', letter='Now', name='What ships' if names else 'Silent today',
                              clips=[shipped_url(n) for n in names] if names else [], live=True,
                              shipped=names[0] if names and len(set(names)) == 1 else (names or None)))
            for s in r['sets']:
                for k in s['keys']: used.add(k)
                head = s['n'].split(':')[0]
                cands.append(dict(opt=s['l'].lower(), letter=s['l'], name=head, detail=s['n'],
                                  keys=s['keys'], clips=[url(k) for k in s['keys']], live=False,
                                  same=pick_src == s['keys']))
        else:
            name = ship if isinstance(ship, str) else cur
            pick_src = PICKS[name][0] if name in PICKS else None
            cands.append(dict(opt='now', letter='Now', name=(name or 'Silent today'),
                              clips=[shipped_url(name)] if name else [], live=True, shipped=name))
            for o in r['opts']:
                used.add(o['k'])
                cands.append(dict(opt=o['l'].lower(), letter=o['l'], name=o['n'], keys=[o['k']],
                                  clips=[url(o['k'])], live=False,
                                  same=bool(pick_src) and (o['k'] == pick_src or o['k'] == f'cur-{name}')))
        note = r.get('note') or ''
        same = next((c for c in cands if c.get('same')), None)
        if same and re.search(r'No sound|[Ss]ilent|Today:|Today every|Today a ', note):
            # The lab note predates the pick: say what ships now.
            note = f'Ships option {same["letter"]} ({same["name"]}) today.'
        ev = dict(id=r['id'], title=r['event'], note=note, grid=r.get('labels') if grid else None,
                  colors=r.get('colors'), candidates=cands)
        events.append(ev)
    sections.append(dict(id=g['id'], title=g['title'], blurb=g['blurb'], events=events))

# Every option clip the page plays, copied next to the admin page (gated by middleware: /admin/*).
os.makedirs(CLIPS, exist_ok=True)
wanted = set()
for k in sorted(used):
    if k.startswith('cur-'): continue
    f = clip_file(k); wanted.add(f)
    shutil.copyfile(os.path.join(HERE, 'options', k + '.m4a'), os.path.join(CLIPS, f))
for f in os.listdir(CLIPS):
    if f.endswith('.m4a') and f not in wanted: os.remove(os.path.join(CLIPS, f))

picks = {n: dict(src=s, target=t) for n, (s, t) in PICKS.items()}
catalog = dict(
    note='Generated by docs/design/brand/sounds/export-sound-catalog.py from build-lab.py + make-sounds.py PICKS. Do not edit.',
    targets=dict(jingle=JINGLE, ui=UI),
    picks=picks,
    sections=sections,
)
with open(CATALOG, 'w') as f:
    json.dump(catalog, f, indent=1, ensure_ascii=False)
    f.write('\n')

# The seed block of the SQL file: one sound_assets row per candidate.
def q(s): return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
rows, sort = [], 0
for s in sections:
    for e in s['events']:
        for c in e['candidates']:
            sort += 1
            shipped = c.get('shipped')
            shipped = ','.join(shipped) if isinstance(shipped, list) else shipped
            keys = c.get('keys') or []
            rows.append(f"  ({q(s['id'] + '/' + e['id'] + '/' + c['opt'])}, {q(s['id'])}, {q(s['title'])}, {q(e['id'])}, "
                        f"{q(e['title'])}, {q(c['opt'])}, {q(c['name'])}, {q('{' + ','.join(keys) + '}')}, {q(shipped)}, "
                        f"{'true' if c['live'] else 'false'}, {sort})")
seed = ('-- BEGIN SEED (generated by docs/design/brand/sounds/export-sound-catalog.py; re-run it to refresh)\n'
        'insert into public.sound_assets (id, section, section_title, event, event_title, option, option_name, clips, shipped_name, live, sort)\nvalues\n'
        + ',\n'.join(rows) + '\n'
        'on conflict (id) do update set section = excluded.section, section_title = excluded.section_title, event = excluded.event,\n'
        '  event_title = excluded.event_title, option = excluded.option, option_name = excluded.option_name, clips = excluded.clips,\n'
        '  shipped_name = excluded.shipped_name, live = excluded.live, sort = excluded.sort, updated_at = now();\n'
        '-- END SEED')
sql = open(SQL).read()
sql = re.sub(r'-- BEGIN SEED.*?-- END SEED', lambda _: seed, sql, flags=re.S)
open(SQL, 'w').write(sql)

n_ev = sum(len(s['events']) for s in sections)
print(f'{len(sections)} sections · {n_ev} events · {len(rows)} candidates · {len(wanted)} option clips · {len(PICKS)} shipped picks')
