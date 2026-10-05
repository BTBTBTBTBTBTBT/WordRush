# Build the cast animation pages from each character's rig (animation/<id>/rig.json + layers/):
#   animation/<id>/preview.html   one character, light + dark stage, self-contained
#   animation/cast.html           all 10 live in a grid (tap to laugh) + "W, polished" vs "W, v1"
#   animation/cast-embed.html     the same grid as a fragment for seasons/gallery.html (build-gallery.py)
#   python3 docs/design/brand/animation/rig-engine/build.py [--frames]
# --frames also writes <scratch>/frames-<id>.html contact sheets (canvases frozen across the cycle) for checking.
import base64, io, json, os, sys
from PIL import Image

ENGINE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.dirname(ENGINE)
CAST = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']
STAGE = dict(w=1300, h=1160, heroX=138, heroY=100)
PLAYER = open(os.path.join(ENGINE, 'player.js')).read()


def uri(path, q=90):
    im = Image.open(path).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    crop = im.crop(bbox)
    b = io.BytesIO()
    crop.save(b, 'WEBP', quality=q, method=6, alpha_quality=100)
    return dict(src='data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode(), x=bbox[0], y=bbox[1], w=crop.width, h=crop.height)


def load(cid):
    d = os.path.join(ANIM, cid)
    rig = json.load(open(os.path.join(d, 'rig.json')))
    rig.setdefault('stage', STAGE)
    used = {L['img'] for L in rig['layers']} | set(rig.get('laugh', [])) | set((rig.get('blink') or {}).values())
    lay = {n: uri(os.path.join(d, 'layers', n + '.png')) for n in sorted(used)}
    for L in rig['layers']:
        if 'pivotInImg' in L:      # pivot given in the uncropped layer image: shift by the WebP crop
            l = lay[L['img']]
            L['pivotInImg'] = [L['pivotInImg'][0] - l['x'], L['pivotInImg'][1] - l['y']]
    return rig, lay


def rig_script(rig, lay):
    slim = {k: v for k, v in rig.items() if k not in ('info',)}
    return f'<script>WRIG.add({json.dumps(slim, separators=(",", ":"))},{json.dumps(lay, separators=(",", ":"))});</script>'


TOKENS = """
:root{--bg:#f7f4fd;--fg:#21183a;--muted:#6c5f89;--card:#ffffff;--stage:linear-gradient(165deg,#f4f0ff,#e9e2fb);--line:#e4dbf5;--accent:#7c3aed;--chip:#efe8fd}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#120e1f;--fg:#efe9fb;--muted:#a597c4;--card:#1c1630;--stage:linear-gradient(165deg,#221a3b,#130f22);--line:#2f2650;--accent:#c4a5ff;--chip:#2a2145}}
:root[data-theme="dark"]{--bg:#120e1f;--fg:#efe9fb;--muted:#a597c4;--card:#1c1630;--stage:linear-gradient(165deg,#221a3b,#130f22);--line:#2f2650;--accent:#c4a5ff;--chip:#2a2145}
"""
GRID_CSS = """
.cast-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px}
.cast-card{margin:0;background:var(--card);border-radius:18px;padding:10px 10px 12px;box-shadow:0 1px 2px rgba(0,0,0,.05),0 6px 18px rgba(60,30,120,.06)}
.cast-card .st{background:var(--stage,linear-gradient(165deg,#f4f0ff,#e9e2fb));border-radius:14px}
.cast-card canvas{display:block;width:100%;aspect-ratio:1300/1160;cursor:pointer;touch-action:manipulation;border-radius:14px}
.cast-card canvas:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.cast-card h3{margin:10px 2px 2px;font-size:15px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.cast-card h3 small{font-weight:600;font-size:11px;color:var(--muted);background:var(--chip,rgba(124,58,237,.1));border-radius:999px;padding:2px 8px;white-space:nowrap}
.cast-card p{margin:4px 2px 0;font-size:13px;line-height:1.4;color:var(--muted)}
.cast-card p b{color:var(--fg);font-weight:600}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 22px}
.cmp figure{margin:0;background:var(--card);border-radius:18px;padding:10px}
.cmp .st{background:var(--stage,linear-gradient(165deg,#f4f0ff,#e9e2fb));border-radius:14px;display:flex;justify-content:center}
.cmp canvas{display:block;width:100%;cursor:pointer;touch-action:manipulation}
.cmp figcaption{font-size:13px;color:var(--muted);margin:8px 2px 0}.cmp figcaption b{color:var(--fg)}
@media (max-width:520px){.cmp{grid-template-columns:1fr 1fr;gap:8px}.cast-grid{grid-template-columns:1fr 1fr;gap:8px}.cast-card p{font-size:12px}}
"""


def card(rig):
    d = f"{rig['restDiff']['meanAbsRGB']:.3f}"
    return (f'<figure class="cast-card"><div class="st"><canvas data-rig="{rig["id"]}" tabindex="0" role="button" '
            f'aria-label="{rig["name"]}: {rig["gesture"]}. Tap to make them laugh."></canvas></div>'
            f'<h3>{rig["name"]}<small>rest diff {d}/255</small></h3>'
            f'<p><b>{rig["gesture"]}</b></p><p>{rig.get("caption", "")}</p></figure>')


def v1_fragment():
    src = open(os.path.join(ANIM, 'w-wave', 'embed.html')).read()
    script = src[src.index('<script>'):src.rindex('</script>') + 9]
    return script


def grid_fragment(rigs, with_cmp=True):
    parts = [f'<style>{GRID_CSS}</style>']
    if with_cmp:
        w = next(r for r, _ in rigs if r['id'] == 'w')
        parts.append('<div class="cmp">'
                     '<figure><div class="st"><canvas data-rig="w" tabindex="0" role="button" aria-label="W, polished"></canvas></div>'
                     '<figcaption><b>W, polished.</b> The fist tucks behind his hip, then the hand swings up from behind him '
                     '(0.45 s, ease-out-back); on the way down it swings back behind him and the fist slides out with a soft settle. '
                     'Never two arms in one frame. The raised hand now matches the hero purple.</figcaption></figure>'
                     '<figure><div class="st"><canvas class="wwave" aria-label="W, v1"></canvas></div>'
                     '<figcaption><b>W, v1.</b> The pilot: a 50 ms swap between the hip fist and the raised arm.</figcaption></figure>'
                     '</div>')
    parts.append('<div class="cast-grid">' + ''.join(card(r) for r, _ in rigs) + '</div>')
    parts.append(f'<script>{PLAYER}</script>')
    for r, l in rigs:
        parts.append(rig_script(r, l))
    if with_cmp:
        parts.append(v1_fragment())
    parts.append('<script>WRIG.scan()</script>')
    return '\n'.join(parts)


def page(title, h1, sub, body):
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>{TOKENS}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:24px 16px 56px}}h1{{font-size:26px;margin:0 0 4px}}.sub{{color:var(--muted);margin:0 0 20px;max-width:760px}}
h2{{font-size:18px;margin:26px 0 10px;color:var(--accent)}}
</style></head><body><main><h1>{h1}</h1><p class="sub">{sub}</p>
{body}
</main></body></html>"""


def preview(rig, lay):
    body = (f'<style>{GRID_CSS}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}.dk{{--card:#1c1630;--stage:linear-gradient(165deg,#221a3b,#130f22);--muted:#a597c4;--fg:#efe9fb;--chip:#2a2145}}'
            f'.lt{{--card:#fff;--stage:linear-gradient(165deg,#f4f0ff,#e9e2fb);--muted:#6c5f89;--fg:#21183a;--chip:#efe8fd}}.pair .cast-card{{color:var(--fg)}}@media (max-width:520px){{.pair{{grid-template-columns:1fr}}}}</style>'
            f'<div class="pair"><div class="lt">{card(rig)}</div><div class="dk">{card(rig)}</div></div>'
            f'<script>{PLAYER}</script>{rig_script(rig, lay)}<script>WRIG.scan()</script>')
    return page(f'{rig["name"]} Puppet', f'{rig["name"]}: {rig["gesture"]}',
                'Cut from the approved hero art and animated in code. Breathing, a blink, the signature gesture, and tap to laugh. '
                'Freeze a frame with ?t=seconds (and &amp;tap=seconds since a tap).', body)


def frames(rig, lay, times, taps):
    cells = ''.join(f'<figure><canvas data-rig="{rig["id"]}" data-t="{t}"></canvas><figcaption>t={t}</figcaption></figure>' for t in times)
    cells += ''.join(f'<figure><canvas data-rig="{rig["id"]}" data-t="2" data-tap="{t}"></canvas><figcaption>tap {t}</figcaption></figure>' for t in taps)
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>body{{margin:0;background:#ddd;font:12px sans-serif}}
.g{{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:4px}}figure{{margin:0;background:#cfcfd6}}canvas{{width:100%;display:block}}figcaption{{text-align:center}}</style></head>
<body><div class="g">{cells}</div><script>{PLAYER}</script>{rig_script(rig, lay)}<script>WRIG.scan()</script></body></html>"""


def main():
    ids = [c for c in CAST if os.path.exists(os.path.join(ANIM, c, 'rig.json'))]
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    rigs = []
    for c in ids:
        rig, lay = load(c)
        rigs.append((rig, lay))
        if not only or c in only:
            open(os.path.join(ANIM, c, 'preview.html'), 'w').write(preview(rig, lay))
            if '--frames' in sys.argv:
                scratch = os.environ.get('FRAMES_DIR', '/tmp')
                cyc = rig['cycle']
                times = rig.get('checkTimes') or [round(cyc * i / 18, 2) for i in range(18)]
                open(os.path.join(scratch, f'frames-{c}.html'), 'w').write(frames(rig, lay, times, [0.05, 0.28, 0.5, 0.7, 0.9, 1.2]))
    frag = grid_fragment(rigs)
    open(os.path.join(ANIM, 'cast-embed.html'), 'w').write(frag)
    html = page('Cast Puppets', 'The cast, animated',
                'All ten are cut from the approved hero art and animated in code (no redrawn characters). Each one breathes, blinks and '
                'does one signature move. Tap any of them to make them hop and laugh. The rest diff is the mean difference between '
                'the layers at rest and the hero image, out of 255 (target under 2). With reduced motion they hold still and a tap '
                'only switches on the laughing face.', '<h2>W, polished vs W, v1</h2>' + frag.replace('<div class="cast-grid">', '<h2>The cast</h2><div class="cast-grid">', 1))
    open(os.path.join(ANIM, 'cast.html'), 'w').write(html)
    print('cast.html', round(len(html) / 1e6, 2), 'MB;', ', '.join(f'{r["id"]} {round(sum(len(l["src"]) for l in ly.values()) / 1e3)}KB' for r, ly in rigs))


if __name__ == '__main__':
    main()
