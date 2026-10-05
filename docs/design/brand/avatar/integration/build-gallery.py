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
"""
h = [f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
     f'<title>Mascot Integration Options</title><style>{css}</style></head><body><main>']
h.append('<h1>Mascot maker: no more bolt-on parts</h1><p class="lede">The answer for the backpack and the other '
         'stickers, the rebuilt parts on every body, what comes next, and the Halloween header back on-model. '
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
h.append('<h2>3. New additions: designed, waiting on ChatGPT</h2>'
         '<p>Tonight\'s ChatGPT time went to the cast animations, so the new pieces are written up with their prompts in <code>avatar/new/QUEUE.md</code> and not drawn yet. '
         'Each one is made for the rig above: held items for the fist, wraps for the wrap line, back/front pairs.</p>'
         '<ul><li><b>Held (12):</b> coffee mug, book, balloon, trophy, big pencil, magnifier, umbrella, ice cream, spatula, microphone, flashlight, star wand (Pro)</li>'
         '<li><b>Wraps (7):</b> bandana + knot, pageant sash, belt + buckle, chef apron, necktie, flower lei, drape cape + collar</li>'
         '<li><b>Footwear (4):</b> high-tops, rain boots, bunny slippers, roller skates</li>'
         '<li><b>Companions (4):</b> a tiny bird on the head, a kitten or puppy at the feet, a snail on the shoulder</li>'
         '<li><b>Brows + extras (2 sheets):</b> six friendly brow pairs (no angry ones), sweat drop and happy tear</li>'
         '<li><b>Personality sets:</b> Bookworm, Athlete, Chef, Explorer, Rock star, Rainy day; Pro: Magic</li>'
         '<li><b>Poses, once the rig gets arm cut-outs:</b> wave, cheer, arms crossed</li></ul>')
# 4
h.append('<h2>4. Halloween header, back on-model</h2><p>The shipped header used ChatGPT redraws (C\'s mouth under the letter, the amber O with two arms, I without his sprout). '
         'The new row is the <b>real header art</b> with the costume layered on, and every face, letter and signature feature is protected.</p>')
for nm, label in (('strip-normal.png', 'Normal header'), ('strip-shipped.png', 'Shipped Halloween header (off-model)'), ('strip-halloween.png', 'Rebuilt Halloween header (layered)')):
    h.append(f'<div class="tag">{label}</div><div class="dark"><img loading="lazy" alt="{label}" src="{uri(os.path.join(HDR, nm), 1179, 84)}"></div>')
h.append('<h3>Face check (eyes, mouth and letter box vs the canonical art; 0 = untouched)</h3><div class="scroll"><table><tr><th>Cast</th><th>Face diff</th><th>Features kept</th><th>Costume</th></tr>')
for cid, v in hdr.items():
    h.append(f'<tr><td>{NAMES[cid]}</td><td>{v["faceRegionDiff"]}</td><td>{v["featuresUntouched"] * 100:.1f}%</td><td>{v["caption"]}</td></tr>')
h.append('</table></div><p>Weakest: R\'s ghost sheet reads as wisps (one new back + hood piece is queued). S switched from the skeleton suit to the approved layered black cat, because a bone suit has to cover his body.</p>')
h.append('</main></body></html>')
p = os.path.join(AV, 'options.html')
open(p, 'w').write('\n'.join(h))
print(p, round(os.path.getsize(p) / 1e6, 2), 'MB')
