# Seasonal library: refresh manifest.json, per-season gallery.png contact sheets, and one self-contained gallery.html.
#   python3 docs/design/brand/seasons/build-gallery.py
# Scans <season>/{cast,titles,props,extras}/*.png. Existing manifest fields (status, approved, created, caption) are kept;
# new files get status "draft" and today's date. Captions for new files come from CAPTIONS below or stay empty.
# gallery.html embeds compressed WebP data URIs (kept well under ~12 MB) and puts every costume next to its hero.
import base64, datetime, io, json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.dirname(ROOT)
KINDS = [('cast', 'Costumed cast'), ('titles', 'Title lettering'), ('props', 'Props for code-drawn wallpapers'), ('extras', 'Extras to judge')]
KIND_ID = {'cast': 'cast', 'titles': 'title', 'props': 'prop', 'extras': 'extra'}
CAST_ORDER = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
TODAY = datetime.date.today().isoformat()

CAPTIONS = {
    # halloween cast
    'halloween/cast/w.png': 'W as a vampire: black cape with red lining and stand-up collar, tiny fangs in his usual smile. Replaces his magenta cape.',
    'halloween/cast/o1.png': 'O (amber) as a pumpkin cheerleader: pumpkin stem hat, black-and-orange skirt, four purple/black pom-poms.',
    'halloween/cast/r.png': 'R as a ghost: bedsheet worn like a hooded cloak, nightcap poking through, sleepy face and R fully visible.',
    'halloween/cast/d.png': 'D as a wizard: purple star-and-moon hat and cape; his pencil gets a gold star tip as a wand.',
    'halloween/cast/o2.png': 'O (pink) as a witch: black hat with purple band, heart sunglasses resting on the brim, black-and-purple cape. No broom.',
    'halloween/cast/c.png': 'C as an alien astronaut: space-suit collar ring, backpack, gloves and boots, springy antennae. The C is still his mouth.',
    'halloween/cast/i.png': 'I as a scarecrow: patched straw hat with his sprout through the crown, plaid vest, straw tufts.',
    'halloween/cast/o3.png': 'O (orange cyclops) as a mummy (second try): five loose bandage strips, eye, mouth and tongue fully clear.',
    'halloween/cast/o3-alt2.png': 'Mummy, first try: more bandages; one strip brushes the mouth corner.',
    'halloween/cast/u.png': 'U as a fairy-ghost: pearly lilac wings, a wavy ghost tail (he floats anyway), a glowing lantern.',
    'halloween/cast/s.png': 'S in a skeleton onesie: bone-print sleeves and legs, rib panels at his sides; headband, sneakers and S stay.',
    'halloween/cast/w-alt1.png': 'Alternate: W as a bat, ear headband and scalloped wings in place of his cape.',
    'halloween/cast/o2-alt1.png': 'Alternate: pink O as a black cat, ears behind her heart sunglasses, curly tail, bell collar. No whiskers.',
    'halloween/cast/d-alt1.png': 'Alternate: D as a mad scientist, open lab coat, pencil in the pocket, bubbling potion, wild white hair tuft.',
    # titles
    'halloween/titles/happy-halloween.png': 'Greeting header (v2): orange with a purple rim, jack-o\'-lantern O, bat perched outside the word.',
    'halloween/cast/r-alt1.png': 'Alternate: R as a sleepy trick-or-treater, bat slippers, striped cuffs, candy pillowcase (second try; first had long legs).',
    'halloween/cast/o1-alt1.png': 'Alternate: amber O as a candy-corn fairy, candy-corn party hat, pale wings, ruffled tutu, purple pom-poms kept.',
    'halloween/cast/c-alt1.png': 'Alternate: C as a pirate, star tricorn and bandana, striped sash, treasure map. Both eyes visible, C is still the mouth.',
    'halloween/cast/o3-alt1.png': 'Alternate: orange cyclops O as a goofy magician, top hat with a bat popping out, cape, wand.',
    'halloween/cast/s-alt1.png': 'Alternate: S as a superhero, purple cape, domino mask, orange wristbands; his S is the emblem.',
    'halloween/cast/u-alt1.png': 'Alternate: U as a stargazer wizard, starry hat and shawl, floating crescent moon (green glow spill cleaned).',
    'halloween/cast/i-alt1.png': 'Alternate: I as a gentle Frankenstein, flat-top tuft with the sprout through it, neck bolts, purple vest.',
    'halloween/titles/happy-halloween-alt1.png': 'HAPPY HALLOWEEN (v1): the bat overlaps the lower W slightly.',
    'halloween/titles/label-trick-or-treat.png': 'Label: TRICK OR TREAT (for buttons, banners or share cards).',
    'halloween/titles/label-spooky.png': 'Label: SPOOKY, the O letters have little eyes.',
    'halloween/titles/label-boo.png': 'Label: BOO!, ghost-white with ghost-eye O letters.',
    'halloween/extras/home-host-w.png': 'Home host: vampire W waving with a jack-o\'-lantern candy pail, for HAPPY HALLOWEEN, <NAME>!',
    'halloween/extras/home-host-o1.png': 'Home host option: pumpkin cheerleader O jumping, pom-poms up, jack-o\'-lantern pail.',
    'halloween/extras/podium-halloween.png': 'Leaderboard podium idea: jack-o\'-lantern 1, starry midnight 2, cobweb charcoal 3.',
    'halloween/titles/page-leaderboard.png': 'Page title: LEADERBOARD in gold, bat outside.',
    'halloween/titles/page-stats.png': 'Page title: STATS in slate, cobweb corner.',
    'halloween/titles/page-friends.png': 'Page title: FRIENDS in pink.',
    'halloween/titles/page-wordoftheday.png': 'Page title: WORD OF THE DAY in green, jack-o\'-lantern O.',
    'halloween/cast/w-alt2.png': 'Alternate: W as a pumpkin prince, pumpkin crown, orange cape with leaf collar, jack-o\'-lantern scepter.',
    'halloween/cast/o1-alt2.png': 'Alternate: amber O as a spider, googly-eye headband, striped fuzzy sleeves on all four arms.',
    'halloween/cast/r-alt2.png': 'Alternate: R as a night owl, owl ear tufts on the nightcap, feather wing cape, cocoa.',
    'halloween/cast/d-alt2.png': 'Alternate: D as a friendly robot, antenna, bolt ears, silver sleeves and boots, button belt; pencil kept.',
    'halloween/cast/o2-alt2.png': 'Alternate: pink O as a unicorn, gold horn and ears behind her heart sunglasses, pastel rainbow mane and tail.',
    'halloween/cast/c-alt2.png': 'Alternate: C as a little dinosaur, orange back spikes, striped tail, claw slippers. C is still the mouth.',
    'halloween/cast/u-alt2.png': 'Alternate: U floating calmly over a pumpkin, knitted scarf, autumn leaf on top.',
    'halloween/extras/streak-flame-jack.png': 'Jack-o\'-lantern streak flame (same shape as the shipped flame icon).',
    'halloween/extras/streak-shield-candy.png': 'Candy-corn streak shield with a wrapped candy (same shape as the shipped shield).',
    'halloween/extras/tile-theme-pumpkin.png': 'Tile theme mockup: pumpkin = correct, midnight purple = present, charcoal = absent. TRICK / TREAT.',
    'halloween/extras/badge-trick-or-treat.png': 'Achievement badge idea: Trick or Treat (play all dailies on Oct 31).',
    'halloween/extras/badge-pumpkin-streak.png': 'Achievement badge idea: Pumpkin Streak.',
    'halloween/extras/badge-night-owl.png': 'Achievement badge idea: Night Owl (owl in a witch hat).',

    'halloween/titles/dailies.png': 'DAILIES (v2): purple with a black rim, cobweb corner, plain S.',
    'halloween/titles/dailies-alt1.png': 'DAILIES (v1): bigger drips; its S has a small drip.',
    'halloween/titles/puzzles.png': 'PUZZLES: orange with a black rim (pairs with DAILIES).',
}
GAMES = {'classic': 'Classic', 'classicseven': 'Classic Seven', 'classicsix': 'Classic Six', 'codebreaker': 'Codebreaker (cryptogram)',
         'crosswordocious': 'Crosswordocious', 'deliverance': 'Deliverance (rescue)', 'gauntlet': 'Gauntlet', 'hubbub': 'Hubbub',
         'kindred': 'Kindred (groups)', 'letterladder': 'Letter Ladder', 'muddle': 'Muddle (scramble)', 'octoword': 'Octoword',
         'propernoundle': 'ProperNoundle', 'quadword': 'Quadword', 'spyglass': 'Spyglass (word search)', 'starsweep': 'Starsweep (regions)',
         'succession': 'Succession (sequence)', 'sudocious': 'Sudocious'}
for k, v in GAMES.items():
    CAPTIONS[f'halloween/titles/game-{k}.png'] = f'{v} game title in its game color with a black rim; drips, bat, cobweb or pumpkin O. Spell-checked.'
PROPS = {'pumpkin': 'Pumpkin', 'jack-o-lantern': 'Friendly jack-o\'-lantern', 'pumpkin-stack': 'Two stacked pumpkins', 'candy-corn': 'Candy corn',
         'bat': 'Bat, wings spread', 'bat-flying': 'Bat flying sideways', 'moon-crescent': 'Crescent moon', 'moon-full': 'Full moon',
         'star': 'Gold star', 'stars-cluster': 'Three tiny stars', 'cobweb': 'Corner cobweb', 'spider': 'Hanging spider'}
PROPS.update({'ghost': 'Friendly ghost', 'candy-wrapped': 'Wrapped candy', 'lollipop': 'Swirl lollipop', 'witch-hat': 'Witch hat',
              'cauldron': 'Bubbling cauldron', 'black-cat': 'Black cat', 'owl': 'Purple owl', 'candle': 'Candle', 'leaf-maple': 'Maple leaf',
              'leaf-oak': 'Oak leaf', 'candy-bag': 'Candy bag (clear wrap, see-through)', 'broom': 'Broom'})
for k, v in PROPS.items():
    CAPTIONS[f'halloween/props/{k}.png'] = f'{v}: small motif for code-drawn orange/black wallpapers (place faint, in margins).'

AV = {'witch-hat': 'witch hat', 'pumpkin-hat': 'pumpkin cap', 'bat-ears': 'bat-ear headband', 'wizard-hat': 'wizard hat',
      'vampire-collar': 'vampire collar', 'bat-wings': 'bat wings (back slot)', 'mummy-wrap': 'mummy-bandage headband', 'candycorn-hat': 'candy-corn party hat'}
for k, v in AV.items():
    CAPTIONS[f'halloween/extras/av-{k}.png'] = f'Avatar-maker accessory: {v}, same style as the shipped art-av-acc parts (needs anchor fitting).'
BTN = {'pumpkin': 'pumpkin orange with a stem', 'midnight': 'midnight purple with a crescent moon', 'cobweb': 'glossy black with a cobweb corner',
       'candycorn': 'candy-corn stripes', 'ghost': 'ghost white with a lavender edge', 'slime': 'slime green with two drips'}
for k, v in BTN.items():
    CAPTIONS[f'halloween/extras/btn-{k}.png'] = f'Blank button skin: {v}. Label drawn in code (three-slice like the cast buttons).'


def load_manifest():
    p = os.path.join(ROOT, 'manifest.json')
    if os.path.exists(p):
        with open(p) as f: return json.load(f)
    return {'version': 1, 'note': 'Seasonal cast library. status: draft -> approved (founder) -> shipped (art-season-<season>-*).', 'seasons': {}, 'assets': []}

def scan(man):
    by_file = {a['file']: a for a in man['assets']}
    out = []
    for season in sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d))):
        for kind, _ in KINDS:
            kd = os.path.join(ROOT, season, kind)
            if not os.path.isdir(kd): continue
            for fn in sorted(os.listdir(kd)):
                if not fn.endswith('.png'): continue
                rel = f'{season}/{kind}/{fn}'
                stem = fn[:-4]
                a = by_file.get(rel, {})
                cast_id = stem.split('-alt')[0] if kind == 'cast' else a.get('castId')
                entry = {
                    'id': f'{season}-{KIND_ID[kind]}-{stem}',
                    'season': season,
                    'kind': KIND_ID[kind],
                    'castId': cast_id,
                    'file': rel,
                    'status': a.get('status', 'draft'),
                    'created': a.get('created', TODAY),
                    'caption': a.get('caption') or CAPTIONS.get(rel, ''),
                }
                if a.get('approved'): entry['approved'] = a['approved']
                with Image.open(os.path.join(ROOT, rel)) as im: entry['size'] = list(im.size)
                out.append(entry)
    def order(e):
        k = [x[0] for x in KINDS].index(e['file'].split('/')[1])
        c = e['castId'] if e['kind'] == 'cast' else ''
        ci = CAST_ORDER.index(c) if c in CAST_ORDER else 99
        stem = os.path.basename(e['file'])[:-4]
        head = {'happy-halloween': 0, 'dailies': 1, 'puzzles': 2}.get(stem.split('-alt')[0], 3) if e['kind'] == 'title' else 0
        return (e['season'], k, ci, head, stem.split('-alt')[0], '-alt' in stem, stem)
    out.sort(key=order)
    man['assets'] = out
    return man

def font(sz):
    for p in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

def contact_sheet(season, assets):
    W, pad = 2000, 24
    blocks = []
    for kind, label in KINDS:
        items = [a for a in assets if a['file'].split('/')[1] == kind]
        if not items: continue
        if kind == 'cast':
            cell, cols = 158, 12   # hero above costume
            rows = (len(items) + cols - 1) // cols
            h = 60 + rows * (cell * 2 + 30)
        elif kind == 'titles':
            cols, cellw, cellh = 3, (W - 2 * pad) // 3, 150
            rows = (len(items) + cols - 1) // cols
            h = 60 + rows * (cellh + 30)
        else:
            cols, cell = 8, 220
            rows = (len(items) + cols - 1) // cols
            h = 60 + rows * (cell + 30)
        blocks.append((kind, label, items, h))
    H = 90 + sum(b[3] for b in blocks) + pad
    sheet = Image.new('RGB', (W, H), '#1d1530')
    d = ImageDraw.Draw(sheet)
    d.text((pad, 24), f'{season.upper()} - seasonal library (draft, {TODAY})', fill='#f7c873', font=font(40))
    y = 90
    for kind, label, items, h in blocks:
        d.text((pad, y + 8), f'{label} ({len(items)})', fill='#e9ddff', font=font(30))
        yy = y + 60
        if kind == 'cast':
            cell, cols = 158, 12
            for k, a in enumerate(items):
                x = pad + (k % cols) * (cell + 5); ry = yy + (k // cols) * (cell * 2 + 30)
                hero = os.path.join(BRAND, 'cast', 'hero', f"{a['castId']}.png")
                for j, p in enumerate([hero, os.path.join(ROOT, a['file'])]):
                    if not os.path.exists(p): continue
                    im = Image.open(p).convert('RGBA'); bb = im.getchannel('A').getbbox(); im = im.crop(bb); im.thumbnail((cell, cell))
                    sheet.paste(im, (x + (cell - im.width) // 2, ry + j * (cell + 10) + (cell - im.height) // 2), im)
                d.text((x + 4, ry + 2 * cell + 12), os.path.basename(a['file'])[:-4], fill='#b9a8e0', font=font(16))
        elif kind == 'titles':
            cols, cellw, cellh = 3, (W - 2 * pad) // 3, 150
            for k, a in enumerate(items):
                x = pad + (k % cols) * cellw; ry = yy + (k // cols) * (cellh + 30)
                im = Image.open(os.path.join(ROOT, a['file'])).convert('RGBA'); im.thumbnail((cellw - 20, cellh - 10))
                sheet.paste(im, (x + (cellw - im.width) // 2, ry + (cellh - im.height) // 2), im)
                d.text((x + 6, ry + cellh + 4), os.path.basename(a['file'])[:-4], fill='#b9a8e0', font=font(16))
        else:
            cols, cell = 8, 220
            for k, a in enumerate(items):
                x = pad + (k % cols) * (cell + 22); ry = yy + (k // cols) * (cell + 30)
                im = Image.open(os.path.join(ROOT, a['file'])).convert('RGBA'); im.thumbnail((cell - 20, cell - 20))
                sheet.paste(im, (x + (cell - im.width) // 2, ry + (cell - im.height) // 2), im)
                d.text((x + 6, ry + cell + 4), os.path.basename(a['file'])[:-4], fill='#b9a8e0', font=font(16))
        y += h
    out = os.path.join(ROOT, season, 'gallery.png')
    sheet.save(out)
    return out

def data_uri(path, maxdim, q=80):
    im = Image.open(path).convert('RGBA'); bb = im.getchannel('A').getbbox()
    if bb: im = im.crop(bb)
    im.thumbnail((maxdim, maxdim), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=4)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')

def html(man):
    seasons = sorted({a['season'] for a in man['assets']})
    parts = []
    hero_cache = {}
    for season in seasons:
        sa = [a for a in man['assets'] if a['season'] == season]
        parts.append(f'<section class="season"><h2>{esc(season.replace("-", " ").title())}</h2>')
        win = man.get('seasons', {}).get(season, {}).get('window')
        if win: parts.append(f'<p class="win">Window: {esc(win)}</p>')
        for kind, label in KINDS:
            items = [a for a in sa if a['file'].split('/')[1] == kind]
            if not items: continue
            parts.append(f'<h3>{esc(label)} <span class="n">{len(items)}</span></h3><div class="grid {kind}">')
            for a in items:
                src = data_uri(os.path.join(ROOT, a['file']), 560 if kind == 'titles' else 420)
                fig = f'<img src="{src}" alt="{esc(a["id"])}" loading="lazy">'
                if kind == 'cast':
                    cid = a['castId']
                    if cid not in hero_cache:
                        hp = os.path.join(BRAND, 'cast', 'hero', f'{cid}.png')
                        hero_cache[cid] = data_uri(hp, 300) if os.path.exists(hp) else ''
                    fig = (f'<div class="pair"><div class="hero"><img src="{hero_cache[cid]}" alt="{cid} hero" loading="lazy"><span>hero</span></div>'
                           f'<div class="costume">{fig}<span>costume</span></div></div>')
                name = os.path.basename(a['file'])[:-4]
                parts.append(f'<figure class="card">{fig}<figcaption><div class="row"><b>{esc(name)}</b>'
                             f'<em class="chip {esc(a["status"])}">{esc(a["status"])}</em></div>'
                             f'<p>{esc(a.get("caption", ""))}</p><code>{esc(a["file"])}</code></figcaption></figure>')
            parts.append('</div>')
        parts.append('</section>')
    counts = {}
    for a in man['assets']: counts[a['kind']] = counts.get(a['kind'], 0) + 1
    names = {'cast': 'costumes', 'title': 'titles', 'prop': 'props', 'extra': 'extras'}
    summary = ' · '.join(f'{v} {names.get(k, k)}' for k, v in counts.items())
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seasonal Cast Library</title>
<style>
:root{{--bg:#f6f2fc;--fg:#24193a;--muted:#6d5f8a;--card:#ffffff;--tile:#efe8fa;--line:#e2d8f3;--draft:#b45309;--draftbg:#fef3c7;--ok:#047857;--okbg:#d1fae5;--ship:#1d4ed8;--shipbg:#dbeafe;--accent:#7c3aed}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#140f22;--fg:#efe9fb;--muted:#a597c4;--card:#1e1733;--tile:#2a2144;--line:#33285a;--draft:#fbbf24;--draftbg:#3b2a0a;--ok:#34d399;--okbg:#0b3326;--ship:#93c5fd;--shipbg:#13284d;--accent:#c4a5ff}}}}
:root[data-theme="dark"]{{--bg:#140f22;--fg:#efe9fb;--muted:#a597c4;--card:#1e1733;--tile:#2a2144;--line:#33285a;--draft:#fbbf24;--draftbg:#3b2a0a;--ok:#34d399;--okbg:#0b3326;--ship:#93c5fd;--shipbg:#13284d;--accent:#c4a5ff}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}}
main{{max-width:1240px;margin:0 auto;padding:28px 16px 60px}}h1{{margin:0 0 4px;font-size:28px}}.sub{{color:var(--muted);margin:0 0 22px}}
h2{{font-size:24px;margin:28px 0 2px;color:var(--accent)}}.win{{margin:0 0 8px;color:var(--muted)}}h3{{font-size:17px;margin:26px 0 12px}}.n{{color:var(--muted);font-weight:500}}
.grid{{display:grid;gap:14px}}.grid.cast{{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}}.grid.titles{{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}}
.grid.props,.grid.extras{{grid-template-columns:repeat(auto-fill,minmax(170px,1fr))}}
.card{{margin:0;background:var(--card);border-radius:16px;padding:12px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 4px 14px rgba(60,30,120,.06)}}
.card img{{display:block;max-width:100%;height:auto;margin:0 auto}}.grid.titles .card img{{max-height:120px;object-fit:contain}}
.grid.props .card img,.grid.extras .card img{{height:130px;object-fit:contain}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:var(--tile);border-radius:12px;padding:8px}}
.pair>div{{display:flex;flex-direction:column;align-items:center;justify-content:flex-end}}.pair img{{height:150px;object-fit:contain}}
.pair span{{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:4px}}
figcaption{{margin-top:10px}}.row{{display:flex;align-items:center;justify-content:space-between;gap:8px}}figcaption p{{margin:6px 0 4px;color:var(--muted);font-size:13px}}
code{{font-size:11px;color:var(--muted);word-break:break-all}}
.chip{{font-style:normal;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 8px;border-radius:999px;color:var(--draft);background:var(--draftbg)}}
.chip.approved{{color:var(--ok);background:var(--okbg)}}.chip.shipped{{color:var(--ship);background:var(--shipbg)}}
</style></head><body><main>
<h1>Seasonal Cast Library</h1><p class="sub">Reusable holiday art made in ChatGPT, for the founder to approve before anything ships. {esc(summary)}. Each costume sits next to its hero for an accuracy check.</p>
{"".join(parts)}
</main></body></html>'''

def main():
    man = scan(load_manifest())
    man.setdefault('seasons', {}).setdefault('halloween', {'window': 'Oct 17 – Nov 1 (local date)'})
    with open(os.path.join(ROOT, 'manifest.json'), 'w') as f: json.dump(man, f, indent=2); f.write('\n')
    for season in sorted({a['season'] for a in man['assets']}):
        print('sheet', contact_sheet(season, [a for a in man['assets'] if a['season'] == season]))
    page = html(man)
    with open(os.path.join(ROOT, 'gallery.html'), 'w') as f: f.write(page)
    print('assets', len(man['assets']), 'gallery.html', round(len(page) / 1e6, 2), 'MB')

if __name__ == '__main__':
    main()
