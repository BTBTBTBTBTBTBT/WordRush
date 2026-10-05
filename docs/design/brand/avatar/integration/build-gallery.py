#!/usr/bin/env python3
"""options.html: the morning review page (one self-contained file, WebP data URIs)."""
import base64, io, json, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
AV = os.path.dirname(HERE)
HDR = os.path.join(AV, '..', 'seasons', 'halloween', 'header')
OUT = os.path.join(HERE, 'out')


def uri(path, maxw=1200, q=82, bg=None):
    im = Image.open(path).convert('RGBA')
    if im.width > maxw:
        im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    if bg:
        b = Image.new('RGBA', im.size, bg); b.alpha_composite(im); im = b
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()


PARTS = [
    ('backpack', 'Backpack', 'Pack behind, two padded straps over the shoulders tucked under the hands, contact shadow, the body shades the pack.'),
    ('scarf', 'Scarf', 'Knit band warped along the wrap line between mouth and letter, cylinder-shaded so it turns around the body; the tail hangs down the side.'),
    ('chain', 'Chain', 'Real links stamped along the wrap line, foreshortened toward the sides. Withheld on wide and mini (no neck room).'),
    ('bubbletea', 'Bubble tea', 'Held: the cup sits in the fist (hand-over layer), sized to the hand, re-lit to the body gloss.'),
    ('guitar', 'Guitar', 'Carried by the neck, standing on the floor line, as tall as hand-to-floor. Bean carries it on the left (its letter leans right).'),
    ('cape', 'Cape', 'Hangs behind from the wrap line with occlusion; a cord and the gold clasp come around to the front.'),
    ('supercape', 'Super cape (tinted)', 'Same split as the cape, white art tinted by the accessory color; no longer a smudge at the hips.'),
]
fit = json.load(open(os.path.join(HERE, 'fit-integrated.json')))
hdr = json.load(open(os.path.join(HDR, 'header.json')))
NAMES = {'w': 'W', 'o1': 'O (amber)', 'r': 'R', 'd': 'D', 'o2': 'O (pink)', 'c': 'C', 'i': 'I', 'o3': 'O (orange)', 'u': 'U', 's': 'S'}

css = """
:root{--bg:#f6f4fb;--ink:#1f1633;--sub:#5b5275;--card:#fff;--accent:#7c3aed;--ok:#15803d;--warn:#b45309;--line:#e7e2f3}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#140f22;--ink:#f1edfa;--sub:#b3a9cc;--card:#1e1731;--accent:#a78bfa;--ok:#4ade80;--warn:#fbbf24;--line:#2d2445}}
:root[data-theme="dark"]{--bg:#140f22;--ink:#f1edfa;--sub:#b3a9cc;--card:#1e1731;--accent:#a78bfa;--ok:#4ade80;--warn:#fbbf24;--line:#2d2445}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:21px;margin:40px 0 8px;color:var(--accent)}h3{font-size:17px;margin:20px 0 4px}
p,li{color:var(--sub)}.lede{font-size:17px;color:var(--ink)}
img{max-width:100%;height:auto;display:block;border-radius:14px}
.pair{display:grid;gap:6px;margin:8px 0 18px}.tag{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);margin-top:6px}
.after .tag{color:var(--ok)}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--line)}
.scroll{overflow-x:auto}.dark{background:#1e1630;border-radius:14px;padding:8px}
ol li,ul li{margin:4px 0}.ok{color:var(--ok);font-weight:600}.muted{color:var(--sub)}
.ngrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin:8px 0 18px}
.nitem{margin:0;background:var(--card);border-radius:16px;padding:8px}.nitem figcaption{font-size:14px;margin:6px 4px 2px;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.nitem .set{font-size:11px;font-weight:700;color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);border-radius:999px;padding:1px 8px}
.nitem .ok{margin-left:auto;font-size:12px}.nitem .note{flex-basis:100%;margin:2px 0 0;font-size:13px}
"""
h = [f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
     f'<title>Mascot Integration Options</title><style>{css}</style></head><body><main>']
h.append('<h1>Mascot maker: no more bolt-on parts</h1><p class="lede">The answer for the backpack and the other '
         'stickers, the rebuilt parts on every body, 37 new additions drawn tonight, and the Halloween header back on-model. '
         'Design only, nothing is wired into the apps.</p>')

# 1
h.append('<h2>1. How we fix bolt-on parts</h2>')
h.append('<p class="lede">A part feels like part of the mascot when it has <b>contact</b> (it sits on, wraps around, or is held by the body), '
         '<b>depth</b> (some of it is behind, some in front), and the <b>same light</b> as the body. Today every part is one flat sticker on one layer.</p>')
h.append('<ol><li><b>Split front and back.</b> The pack, cape or tail goes behind the body; the straps, cord or scarf band go in front.</li>'
         '<li><b>Hands hold things.</b> The body\'s own hands are redrawn on top, so straps tuck under the arms and items sit in the fist.</li>'
         '<li><b>Wraps follow the body.</b> They are warped along the line between the mouth and the letter and shaded as they turn around the sides.</li>'
         '<li><b>Never cover the face or the letter.</b> A part moves out of the way instead of being cut; a body with no room doesn\'t get it.</li>'
         '<li><b>Every body gets its own fit.</b> Shoulder line, hands, wrap line and floor are measured per body.</li>'
         '<li><b>Baked contact shadow + occlusion, matched top-left light.</b></li>'
         '<li><b>Fit-checked on all 12 bodies</b>: 0 failures for the 7 rebuilt parts.</li></ol>')
h.append('<h3>The backpack</h3><div class="pair"><div class="tag">Before (shipped)</div>'
         f'<img alt="Backpack before on four bodies" src="{uri(os.path.join(OUT, "backpack-before.webp"))}">'
         '<div class="after"><div class="tag">After</div>'
         f'<img alt="Backpack after on four bodies" src="{uri(os.path.join(OUT, "backpack-after.webp"))}"></div>'
         '<div class="tag">After, all 12 bodies</div>'
         f'<img alt="Backpack on all twelve bodies" src="{uri(os.path.join(OUT, "backpack-all12.webp"), 1100)}"></div>')
h.append('<h3>What the audit found</h3><div class="scroll"><table><tr><th>Part</th><th>Why it reads bolt-on</th></tr>'
         '<tr><td>Backpack</td><td>The whole pack sits behind and is bigger than the body; no straps, so nothing connects it.</td></tr>'
         '<tr><td>Scarf, chain</td><td>A flat sticker over the letter; it doesn\'t go around anything.</td></tr>'
         '<tr><td>Bubble tea</td><td>It floats next to the hand; nobody is holding it.</td></tr>'
         '<tr><td>Guitar</td><td>Only a headstock poking out from behind a shoulder.</td></tr>'
         '<tr><td>Super cape</td><td>It hangs from above the eyes and is mostly hidden, so it reads as a smudge.</td></tr>'
         '<tr><td>Cape</td><td>Nothing in front ties it on.</td></tr>'
         '<tr><td>Hats, glasses, face parts</td><td class="ok">Mostly fine: they sit on the head or face. The next step is a contact shadow under each brim.</td></tr></table></div>')
# 2
h.append('<h2>2. The rebuilt parts</h2><p>Before is the shipped layout; after is the integration rig. Bodies: classic, tall, blob and star.</p>')
for pid, name, desc in PARTS:
    nf = sum(1 for v in fit[pid].values() if v['fails'])
    uns = [b for b, v in fit[pid].items() if v.get('unsupported')]
    h.append(f'<h3>{name}</h3><p>{desc} <span class="ok">Fit check: {12 - len(uns) - nf}/{12 - len(uns)} bodies pass</span>'
             + (f' <span class="muted">(not offered on {", ".join(uns)})</span>' if uns else '') + '</p>')
    h.append('<div class="pair"><div class="tag">Before</div>'
             f'<img loading="lazy" alt="{name} before" src="{uri(os.path.join(OUT, pid + "-before.webp"), 960, 76)}">'
             '<div class="after"><div class="tag">After</div>'
             f'<img loading="lazy" alt="{name} after" src="{uri(os.path.join(OUT, pid + "-after.webp"), 960, 80)}"></div></div>')
# 3
NEWFIT = json.load(open(os.path.join(HERE, 'fit-new.json'))) if os.path.exists(os.path.join(HERE, 'fit-new.json')) else {}
NOUT = os.path.join(OUT, 'new')
h.append('<h2>3. New additions (10-05)</h2>'
         '<p class="lede">Drawn tonight in ChatGPT as separate pieces, then fitted to every body by the same rig: held items sit in the fist '
         '(the hand is redrawn on top), wraps follow the line between the mouth and the letter, garments like the apron, tie, sash and a '
         'belt on short bodies sit <b>under</b> the letter (the letter stays on top, like a print), shoes go over the feet with the legs tucked '
         'into them, and companions sit on the head, the shoulder or the floor. Every piece was fit-checked on all 12 bodies; '
         'the rows below show classic, tall and blob. Proposals only: the shipped parts file is untouched.</p>')
NOTES = {
    'balloon': 'Held by its string; the fist covers the knot.',
    'tie': 'Tucks behind the letter, so on most bodies you mainly see the knot and the tie edges beside the letter.',
    'apron': 'Hangs from the wrap line with the tie strip around the body; the letter reads printed on it. Tinted (red here).',
    'sash': 'Diagonal from the left shoulder to the right hip, under the letter, slid down until it clears the face.',
    'belt': 'Below the letter where there is room; on short bodies it runs under the lower letter, buckle beside it.',
    'sneakers': 'Only the lower shoe is used (sole, toe, laces): the stubby feet would vanish in a full high-top.',
    'boots': 'Cut low, like the sneakers.',
    'brows-happy': 'Brows are drawn in code in the eyes\' own plum ink, so they stay crisp at every size. No angry pair.',
}
cats = {}
for pid, v in NEWFIT.items():
    cats.setdefault(v['category'], []).append((pid, v))
for cat in ['Held items', 'Wraps', 'Footwear', 'Companions', 'Brows + extras']:
    if cat not in cats:
        continue
    h.append(f'<h3>{cat}</h3>')
    h.append('<div class="ngrid">')
    for pid, v in cats[cat]:
        bodies = v['bodies']
        uns = [b for b, r in bodies.items() if r.get('unsupported')]
        nf = sum(1 for r in bodies.values() if r['fails'])
        ok = 12 - len(uns) - nf
        tag = f'<span class="set">{v["set"]}</span>' if v.get('set') else ''
        note = f'<p class="note">{NOTES[pid]}</p>' if pid in NOTES else ''
        h.append(f'<figure class="nitem"><img loading="lazy" alt="{v["label"]} on three bodies" src="{uri(os.path.join(NOUT, pid + ".webp"), 660, 80)}">'
                 f'<figcaption><b>{v["label"]}</b>{tag}<span class="ok">fit {ok}/{12 - len(uns)}</span>{note}</figcaption></figure>')
    h.append('</div>')
h.append('<h3>Personality sets ("wear the set")</h3><p>Each set is the new pieces plus parts the maker already has.</p><div class="ngrid">')
SETNOTE = {'bookworm': 'Mug + book (both hands), round glasses (have), tie under the letter. The big pencil is a swap-in for the book.',
           'athlete': 'Trophy, sweatband (have), high-tops, belt.', 'chef': 'Spatula, apron with the letter on top, chef hat (have).',
           'explorer': 'Magnifier + flashlight, bucket hat (have), rebuilt backpack.', 'rock-star': 'Microphone, star glasses (have), rebuilt chain (not on wide or mini).',
           'rainy-day': 'Umbrella + rain boots.', 'pro-magic': 'Star wand, wizard hat (have), drape cape.', 'summer': 'Ice cream + flower lei.'}
for nm in ['bookworm', 'athlete', 'chef', 'explorer', 'rock-star', 'rainy-day', 'pro-magic', 'summer']:
    f = os.path.join(NOUT, f'set-{nm}.webp')
    if os.path.exists(f):
        label = {'pro-magic': 'Pro: Magic', 'rock-star': 'Rock star', 'rainy-day': 'Rainy day'}.get(nm, nm.capitalize())
        h.append(f'<figure class="nitem"><img loading="lazy" alt="{label} set" src="{uri(f, 660, 80)}"><figcaption><b>{label}</b><p class="note">{SETNOTE[nm]}</p></figcaption></figure>')
h.append('</div>')
h.append('<h3>Backpack straps on narrow bodies</h3><p>The straps now keep a clear gap around the eyes: on tall, drop, pear, bean and mini they get thinner '
         'and ride farther out on the shoulder (row above, section 1). Tall is still the tightest fit.</p>')
h.append('<p class="muted">Not built yet: the animated poses (wave, cheer, arms crossed), which need the body art\'s arms cut out.</p>')
# 4
h.append('<h2>4. Halloween header, back on-model</h2><p>The shipped header used ChatGPT redraws (C\'s mouth under the letter, the amber O with two arms, I without his sprout). '
         'The new row is the <b>real header art</b> with the costume layered on, and every face, letter and signature feature is protected.</p>')
for nm, label in (('strip-normal.png', 'Normal header'), ('strip-shipped.png', 'Shipped Halloween header (off-model)'), ('strip-halloween.png', 'Rebuilt Halloween header (layered)')):
    h.append(f'<div class="tag">{label}</div><div class="dark"><img loading="lazy" alt="{label}" src="{uri(os.path.join(HDR, nm), 1179, 84)}"></div>')
h.append('<h3>Face check (eyes, mouth and letter box vs the canonical art; 0 = untouched)</h3><div class="scroll"><table><tr><th>Cast</th><th>Face diff</th><th>Features kept</th><th>Costume</th></tr>')
for cid, v in hdr.items():
    h.append(f'<tr><td>{NAMES[cid]}</td><td>{v["faceRegionDiff"]}</td><td>{v["featuresUntouched"] * 100:.1f}%</td><td>{v["caption"]}</td></tr>')
h.append('</table></div><p>R\'s ghost (10-05): a full sheet back panel with a ragged hem and a hood behind his head, both new ChatGPT pieces, so he reads as a ghost now instead of wisps; nightcap and face untouched. S switched from the skeleton suit to the approved layered black cat, because a bone suit has to cover his body.</p>')
h.append('</main></body></html>')
p = os.path.join(AV, 'options.html')
open(p, 'w').write('\n'.join(h))
print(p, round(os.path.getsize(p) / 1e6, 2), 'MB')
