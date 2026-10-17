#!/usr/bin/env python3
"""Block 2 builder (Nov 30 - Dec 27, 2026). Source: b2_data.py + b2_head.md. Writes:
  apps/web/lib/admin/jp45-block2-posts.json               (same schema as jp45-posts.json; source of truth for the SQL)
  docs/sql/20261016-jp45-block2-posts.sql                 (idempotent; NOT applied)
  docs/design/brand/social/jp45/incoming/full/queue-block2.json
  docs/design/brand/social/jp45/manifest-block2.json      (stubs; merge into manifest.json when the first scene is accepted)
  docs/marketing/jp45/BLOCK-2-NOV30-DEC27.md              (the calendar)
Run: python3 docs/marketing/jp45/build-block2.py"""
import json, os, re, sys, uuid, datetime, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
import b2_data as D
P = D.P
SOC = os.path.join(ROOT, 'docs/design/brand/social/jp45')
BRAND = os.path.join(ROOT, 'docs/design/brand')
NAMES = {'w': 'Webster', 'o1': 'Ollie', 'r': 'Rip', 'd': 'Dewey', 'o2': 'Opal', 'c': 'Cosmo', 'i': 'Ivy', 'o3': 'Ozzy', 'u': 'Umi', 's': 'Scoot'}
COSTUME = {
 'w': 'Santa hat, black belt with a gold buckle, fur-cuffed mittens and fur boots; the cape stays',
 'd': 'blue-and-silver knit Hanukkah sweater with a dreidel and snowflake pattern (round opening for the D), beanie, holding a chocolate gelt coin',
 'c': 'blue-and-silver scarf and beanie, a dreidel (gimel side) in hand, gelt at his feet',
 'o3': 'knit ugly Christmas sweater, pom beanie and red mittens',
 'u': 'Kwanzaa wrap with red, black and green kente-inspired trim and a beanie, holding a kinara (3 red, 1 black, 3 green candles)',
 's': 'kente-inspired sash, scarf and an ear of corn baton; keeps his angled, determined brows (friendly raised brows on S are off-model)',
 'i': 'striped scarf, earmuffs and white mittens',
 'o1': 'reindeer antlers with holly, a jingle-bell collar, tan belly bib and pom-poms',
 'r': 'patchwork quilt wrap, striped nightcap with holly and a cocoa mug',
 'o2': 'Christmas cape with a bow, a muff and a gift (heart sunglasses stay on)'}
EX = {  # approved block-1 finals used as layout and lettering examples (their season colors and props are ignored)
 ('monday', 'x'): '2026-11-23-x/landscape.png', ('wotd', 'x'): '2026-11-19-x/landscape.png', ('muddle', 'x'): '2026-11-18-x/landscape.png',
 ('muddle', 'portrait'): '2026-11-18-feed/portrait.png', ('friday', 'x'): '2026-11-20-x/landscape.png', ('friday', 'portrait'): '2026-11-20-feed/portrait.png',
 ('sweep', 'x'): '2026-11-22-x/landscape.png', ('sweep', 'portrait'): '2026-11-22-fb/portrait.png', ('cast', 'x'): '2026-11-14-x/landscape.png',
 ('pin-explainer', 'pin'): '2026-11-19-pin-1/pin.png', ('pin-word', 'pin'): '2026-11-19-pin-2/pin.png', ('pin-cast', 'pin'): '2026-11-19-pin-3/pin.png',
 ('holiday', 'portrait'): '2026-11-26-holiday/portrait.png', ('holiday', 'x'): '2026-11-26-holiday/landscape.png'}
GEN = {'x': '2026-11-24-x/landscape.png', 'portrait': '2026-11-26-fb/portrait.png', 'pin': '2026-11-19-pin-3/pin.png'}
FMT = {'landscape': '3:2 landscape (1536x1024)', 'portrait': '2:3 portrait (1024x1536)', 'pin': '2:3 portrait (1024x1536)'}
DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
PLAT = {'x': ['x', 'threads'], 'feed': ['instagram', 'facebook', 'threads'], 'fb': ['facebook'], 'pin': ['pinterest'], 'video': ['tiktok', 'instagram'], 'holiday': ['x', 'threads', 'instagram', 'facebook']}

def uid(p):
    if p['slot'] == 'holiday': s = 'wordocious.com/jp45/holiday/' + p['date']
    elif p['slot'] == 'video': s = 'wordocious.com/jp45/video/' + p['date']
    else: s = f"wordocious.com/jp45/{p['date']}/{p['slot']}" + (f"-{p['pin_n']}" if p.get('pin_n') else '')
    return str(uuid.uuid5(uuid.NAMESPACE_URL, s))
pins = collections.defaultdict(list)
for p in P:
    if p['slot'] == 'pin': pins[p['date']].append(p)
for d, ps in pins.items():
    for n, p in enumerate(sorted(ps, key=lambda q: q['time']), 1): p['pin_n'] = n
for p in P:
    p['id'] = uid(p)
    p['dow'] = DOW[datetime.date.fromisoformat(p['date']).weekday()]
    p['wotd'] = None
    if p['kind'] == 'wotd':
        w = D.WOTD[p['date']]; p['wotd'] = {'date': p['date'], 'word': w[0], 'answer': w[3]}
    p['key'] = f"{p['date']}-{p['slot']}" + (f"-{p['pin_n']}" if p.get('pin_n') else '')
    assert sorted(p['targets']) == sorted(PLAT[p['slot']]), (p['key'], list(p['targets']))
    p['targets'] = [{'platform': k, 'caption': p['targets'][k]} for k in PLAT[p['slot']]]
P.sort(key=lambda p: (p['date'], p['time'], p['slot'], p.get('pin_n') or 0))
slugs = [f"p-{p['id'].replace('-', '')[-8:]}-{t['platform']}" for p in P for t in p['targets']]
assert len(set(slugs)) == len(slugs) and len({p['id'] for p in P}) == len(P)

# ---- brand rules (the same ones jp45-posts.test.ts pins)
emoji = re.compile('[\U0001F300-\U0001FAFF☀-➿]')
comp = re.compile(r'wordle|\bnyt\b|new york times|quordle|octordle|heardle|connections', re.I)
brit = re.compile(r'\b(colour|favourite|centre|neighbour|grey|realise|organise|recognise|travelling|cancelled|programme|whilst|learnt)\w*', re.I)
for p in P:
    text = '\n'.join([p['title']] + [t['caption'] for t in p['targets']] + p['hashtags'])
    assert not emoji.search(text) and not comp.search(text) and not brit.search(text), p['key']
    for m in re.findall(r'\$\d[\d.,]*', text): assert m in ('$6.99', '$59.99', '$1', '$5'), (p['key'], m)
    assert len(p['hashtags']) >= 2, p['key']
    for t in p['targets']:
        cap = t['caption']; tags = ' '.join('#' + h for h in p['hashtags'])
        if t['platform'] == 'x': assert len(cap) + 2 + 23 <= 260 and len(cap) + len(tags) + 4 + 23 <= 280, (p['key'], len(cap))
        if t['platform'] in ('threads', 'pinterest'): assert len(cap) + len(tags) + 2 <= 500, (p['key'], t['platform'], len(cap))
        if p['wotd']: assert not re.search(r'answer\s*:\s*\(?[abc]\)?\b', cap, re.I) and p['wotd']['word'] in cap
    if p['slot'] == 'video': assert p['paused'] and p['title'].startswith('[Needs capture] ')

# ---- JSON
out = [{'id': p['id'], 'title': p['title'], 'kind': p['kind'], 'date': p['date'], 'time': p['time'], 'slot': p['slot'], 'hashtags': p['hashtags'],
        'link_target': p['link_target'], 'paused': p['paused'], 'size': p['size'], 'asset_hint': p['asset_hint'], 'beat': p['beat'], 'note': p['note'],
        'wotd': p['wotd'], 'targets': p['targets']} for p in P]
about = ("JP-plan BLOCK 2 (Mon Nov 30 - Sun Dec 27, 2026) as Social Studio drafts. Generated by docs/marketing/jp45/build-block2.py from docs/marketing/jp45/b2_data.py. "
         "Same schema as jp45-posts.json. Times America/Chicago. Holiday greeting ids = uuid5(URL, 'wordocious.com/jp45/holiday/<date>'); videos = uuid5(URL, 'wordocious.com/jp45/video/<date>'); "
         "all others = uuid5(URL, 'wordocious.com/jp45/<date>/<slot>[-n]'). 'note', 'wotd' and 'beat' are for humans and tests, not stored.")
json.dump({'_about': about, 'posts': out}, open(os.path.join(ROOT, 'apps/web/lib/admin/jp45-block2-posts.json'), 'w'), indent=1, ensure_ascii=False)

# ---- SQL (mirrors apps/web/scripts/jp45-posts.mjs exactly)
q = lambda s: 'null' if s is None else "'" + str(s).replace("'", "''") + "'"
nt = sum(len(p['targets']) for p in P)
L = ['-- NOT APPLIED. Block 2 of the JP social plan (Mon Nov 30 - Sun Dec 27, 2026) as Social Studio drafts.',
     '-- Generated by docs/marketing/jp45/build-block2.py from apps/web/lib/admin/jp45-block2-posts.json (idempotent). Every post is a draft needing BMT + JP approval.',
     '-- Re-running only refreshes untouched drafts (version 1, no review) and still-pending targets. Media is attached later by apps/web/scripts/social-attach.mjs.',
     f'-- Before applying: scripts/db-backup.sh, then libpq psql from ~/.wordocious-db-url, then read back (expect {len(P)} new posts / {nt} targets / {nt} tracked links; {sum(1 for p in P if p["paused"])} paused).',
     'begin;']
for p in P:
    at = f"{p['date']} {p['time']}:00 America/Chicago"
    title = p['title'] + (' (image coming)' if p['slot'] == 'holiday' else '')
    L.append(f"""insert into public.social_posts (id, title, kind, scheduled_at, hashtags, media, link_target, paused, created_by)
values ({q(p['id'])}, {q(title)}, {q(p['kind'])}, {q(at)}::timestamptz, {q('{' + ','.join(p['hashtags']) + '}')}::text[], '[]'::jsonb, {q(p['link_target'])}, {'true' if p['paused'] else 'false'}, 'claude')
on conflict (id) do update set title = excluded.title, kind = excluded.kind, scheduled_at = excluded.scheduled_at,
  hashtags = excluded.hashtags, link_target = excluded.link_target, paused = excluded.paused, updated_at = now()
where public.social_posts.status = 'draft' and public.social_posts.version = 1
  and not exists (select 1 from public.social_reviews r where r.post_id = public.social_posts.id);""")
    for t in p['targets']:
        slug = 'p-' + p['id'].replace('-', '')[-8:].lower() + '-' + t['platform']
        L.append(f"insert into public.marketing_links (slug, target, channel) values ({q(slug)}, {q(p['link_target'])}, {q(t['platform'])}) on conflict (slug) do nothing;")
        L.append(f"""insert into public.social_post_targets (post_id, platform, caption, link_slug) values ({q(p['id'])}, {q(t['platform'])}, {q(t['caption'])}, {q(slug)})
on conflict (post_id, platform) do update set caption = excluded.caption, link_slug = excluded.link_slug, updated_at = now()
where public.social_post_targets.status = 'pending'
  and exists (select 1 from public.social_posts sp where sp.id = public.social_post_targets.post_id and sp.version = 1 and sp.status = 'draft');""")
L += ['commit;', '']
open(os.path.join(ROOT, 'docs/sql/20261016-jp45-block2-posts.sql'), 'w').write('\n'.join(L))

# ---- image queue
def ex_path(p, fmt):
    k = ('holiday' if p['slot'] == 'holiday' else p['series'], 'x' if fmt == 'landscape' else fmt)
    if p['slot'] == 'pin': k = (p['series'], 'pin')
    return os.path.join(SOC, EX.get(k) or GEN['x' if fmt == 'landscape' else fmt])
def prompt_for(it, p):
    winter = p['season'] in ('winter', 'newyear')
    lines = [f"Make a {it['aspect']} social-media scene for the Wordocious word-game brand ({p['title']})."]
    desc = []
    for r in it['refs']:
        b = os.path.basename(r).split('.')[0]
        if 'jp45' in r: desc.append(f"{os.path.basename(os.path.dirname(r))}/{os.path.basename(r)} = approved layout and lettering style example (ignore its season colors and props)")
        elif '/cast/hero/' in r: desc.append(f"hero/{b}.png = canonical {NAMES[b]}")
        else: desc.append(f"winter-holidays/{b}.png = {NAMES[b]}'s approved winter costume art")
    lines.append('ATTACH: ' + '; '.join(desc) + '.')
    ch = [f"{NAMES[c]} (the letter {c[0].upper()}): " + (COSTUME[c] if winter else 'no costume, the plain look from the canonical art') for c in it['cast']]
    lines.append(f"CHARACTERS: draw exactly {len(it['cast'])} character(s), each exactly once: " + '; '.join(ch) + '. Each must match its attached art exactly: same letter shape, colors, eyes, mouth and teeth, brows, limbs and proportions. W is always friendly. Costumes sit naturally on the body, nothing pasted on or floating, and the letter stays fully visible.')
    lines.append(f"HEADLINE in the house bubble lettering (glossy, puffy purple-pink letters with a white highlight and a darker rim, exactly like the style example): \"{it['headline']}\". Spell it letter by letter exactly like this."
                 + (f" SUB LINE in gold-to-orange glossy lettering, one line under it: \"{it['sub']}\"." if it['sub'] else ' No sub line.'))
    lines.append('SETTING: ' + p['setting'] + ('. Winter-holidays look (Christmas, Hanukkah and Kwanzaa all share the season): snow, warm string lights, deep midnight blue with cream and gold; objects, food, light and color only, no religious garments on anyone.' if winter else '.'))
    lines.append('LAYOUT: keep the top 14 percent and the bottom 9 percent of the frame as calm background only (no lettering, no feet, no props); headline fully inside the middle 70 percent' + (('; ' + p['layout']) if p['layout'] else '') + '; cast feet on one baseline above the bottom band.')
    lines.append('DO NOT draw: the Wordocious wordmark, a footer or URL, any other words or letters, emoji, watermarks, speech bubbles, extra characters or a second copy of any character. American spelling only.')
    return '\n'.join(lines)
Q = []
for p in P:
    if p['slot'] == 'video': continue
    fmts = [('holiday-feed', 'portrait'), ('holiday-x', 'landscape')] if p['slot'] == 'holiday' else [(p['slot'], p['size'])]
    for slot, fmt in fmts:
        iid = f"{p['date']}-{slot}-{p['pin_n']}" if p['slot'] == 'pin' else f"{p['date']}-{slot}-1"
        it = {'id': iid, 'post_id': p['id'], 'date': p['date'], 'slot': slot, 'fmt': fmt, 'aspect': FMT[fmt], 'season': p['season'], 'title': p['title'],
              'headline': p['headline'], 'sub': p['sub'], 'cast': p['cast'], 'series': p['series'], 'refs': [], 'status': 'todo',
              'priority': 'front' if p['slot'] == 'holiday' or p['date'] <= '2026-12-01' else 'normal', 'notes': p['setting'], 'hint': p['hint']}
        if p['layout']: it['layout'] = p['layout']
        if p['content']: it['content'] = p['content']
        refs = [os.path.join(BRAND, 'cast/hero', c + '.png') for c in p['cast']]
        if p['season'] in ('winter', 'newyear'): refs += [os.path.join(BRAND, 'seasons/winter-holidays/cast', c + '.png') for c in p['cast']]
        refs.append(ex_path(p, fmt)); it['refs'] = refs
        it['prompt'] = prompt_for(it, p)
        Q.append(it)
order = sorted(range(len(Q)), key=lambda i: (Q[i]['priority'] != 'front', Q[i]['date'], Q[i]['id']))
size = -(-len(Q) // 4)
for rank, i in enumerate(order): Q[i]['tab_group'] = 'ABCD'[rank // size]
Q.sort(key=lambda it: (it['tab_group'], it['date'], it['id']))
note = ("Block 2 (Nov 30 - Dec 27). status todo|sent|done. scene.py reads only incoming/full/queue.json, so append these items first: from incoming/full run "
        "python3 -c \"import json;a=json.load(open('queue.json'));b=json.load(open('queue-block2.json'));a['queue']+=b['queue'];json.dump(a,open('queue.json','w'),indent=1)\". "
        "tab_group A-D = four parallel ChatGPT tabs (free web app, MacBook Chrome only; never click Share). Each item's 'prompt' is ready to paste with its 'refs' attached.")
json.dump({'queue': Q, 'limit': None, 'note': note}, open(os.path.join(SOC, 'incoming/full/queue-block2.json'), 'w'), indent=1, ensure_ascii=False)

# ---- manifest stubs
M = []
for p in P:
    if p['slot'] == 'video': continue
    key = p['key']; nm = {'landscape': 'landscape', 'portrait': 'portrait', 'pin': 'pin'}
    files = {'portrait': f'{key}/portrait.png', 'landscape': f'{key}/landscape.png'} if p['slot'] == 'holiday' else {p['size']: f"{key}/{nm[p['size']]}.png"}
    M.append({'key': key, 'post_id': p['id'], 'date': p['date'], 'slot': p['slot'], 'title': p['title'], 'files': files,
              'caption': f"{p['headline']}: {p['sub']}" if p['sub'] else p['headline'], 'card': p['series'], 'season': p['season'],
              'series_color': 'tbd (BLOCK-2 hue table)', 'cast': p['cast'], 'cast_count': len(p['cast']), 'mascot_check': 'pending',
              'aesthetic_check': 'pending', 'hint': p['hint'], 'notes': p['note'] or '', 'source': 'pending (ChatGPT scene)', 'status': 'stub'})
json.dump(M, open(os.path.join(SOC, 'manifest-block2.json'), 'w'), indent=2, ensure_ascii=False)

# ---- calendar MD
cnt = collections.Counter(p['slot'] for p in P)
md = [open(os.path.join(HERE, 'b2_head.md')).read().replace('{{COUNTS}}', ', '.join(f'{k} {v}' for k, v in sorted(cnt.items()))).replace('{{N}}', str(len(P))).replace('{{IMG}}', str(len(Q))).replace('{{TARGETS}}', str(nt))]
w = md.append
by = collections.defaultdict(list)
for p in P: by[p['date']].append(p)
weeks = [('Week 1: Mon Nov 30 - Sun Dec 6 (Thanksgiving recap, winter begins, Hanukkah)', '2026-11-30', '2026-12-06'), ('Week 2: Mon Dec 7 - Sun Dec 13 (Hanukkah nights, 18 Days finale)', '2026-12-07', '2026-12-13'),
         ('Week 3: Mon Dec 14 - Sun Dec 20 (gift season)', '2026-12-14', '2026-12-20'), ('Week 4: Mon Dec 21 - Sun Dec 27 (solstice, Christmas, Kwanzaa, New Year teaser)', '2026-12-21', '2026-12-27')]
for title, a, b in weeks:
    w(f'\n## {title}\n')
    for d in sorted(by):
        if not (a <= d <= b): continue
        ps = by[d]
        w(f"\n### {ps[0]['dow']} {d}  |  " + ' / '.join(dict.fromkeys(x['beat'] for x in ps)) + '\n')
        for p in ps:
            tag = ' (PAUSED)' if p['paused'] else ''
            w(f"**{p['time']} CT | {p['slot'].upper()}{('-' + str(p['pin_n'])) if p.get('pin_n') else ''} | {p['kind']} | series `{p['series']}`{tag}**: {p['title']}  \n`{p['id']}`\n")
            if p['headline']: w(f"- Hook / image text: **{p['headline']}**" + (f" / {p['sub']}" if p['sub'] else ''))
            for t in p['targets']:
                w(f"- {t['platform']} (`/go/p-{p['id'].replace('-', '')[-8:]}-{t['platform']}`): " + t['caption'].replace('\n\n', ' ¶ ').replace('\n', ' / '))
            if p['slot'] != 'video':
                w(f"- Image brief ({p['size']}{' + landscape' if p['slot'] == 'holiday' else ''}, {p['season']}): cast {', '.join(NAMES[c] for c in p['cast'])}; {p['setting']}" + (f"; layout: {p['layout']}" if p['layout'] else '') + (f"; content added in code: `{p['content']}`" if p['content'] else ''))
            else:
                w('- Video: Brian captures it (iPhone simulator demo mode) or a cast-led cut (cast-scene.py); the cover is cut by make-video.py; paused until captured.')
            w(f"- Spoiler / hint note: {p['hint']}" + (f"\n- Note: {p['note']}" if p['note'] else '') + '\n')
open(os.path.join(HERE, 'BLOCK-2-NOV30-DEC27.md'), 'w').write('\n'.join(md))
print(len(P), 'posts;', nt, 'targets;', len(Q), 'images;', dict(cnt), 'paused', sum(p['paused'] for p in P))
