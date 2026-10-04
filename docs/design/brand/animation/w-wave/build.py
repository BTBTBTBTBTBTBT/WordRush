# Build preview.html (self-contained, WebP data URIs, canvas + JS) and embed.html (the same player as a fragment
# for seasons/gallery.html) from layers/ + rig.json.   python3 docs/design/brand/animation/w-wave/build.py
# Freeze for screenshots:  preview.html?t=1.6        (time in seconds)   &tap=0.2  (seconds since a tap)
import base64, io, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
L = os.path.join(HERE, 'layers')
rig = json.load(open(os.path.join(HERE, 'rig.json')))
# Rest offsets/pivots, all in hero-canvas pixels (1024 x 1024). Only arm-wave is placed by a pivot.
rig['stage'] = dict(w=1300, h=1090, heroX=40, heroY=50)
rig['armWave'] = dict(img='arm-wave', pivotInImg=[60, 245], pivotOnHero=[858, 520], scale=1.15, imgAngle=-52, baseAngle=-42, amp=25)
rig['cape'] = dict(pivot=[330, 470], swayDeg=3.5, swayPeriod=2.6, rippleAmpPx=6, ripplePeriod=1.8, top=430, hem=905)
rig['breath'] = dict(origin=[530, 955], period=3.4, sy=0.012, sx=0.006)
json.dump(rig, open(os.path.join(HERE, 'rig.json'), 'w'), indent=1)

NAMES = ['cape', 'body', 'arm-rest', 'arm-wave', 'eyes-half', 'eyes-closed', 'eyes-happy', 'mouth-laugh']


def uri(name, max_side=None):
    im = Image.open(os.path.join(L, name + '.png')).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    crop = im.crop(bbox)
    b = io.BytesIO()
    crop.save(b, 'WEBP', quality=90, method=6, alpha_quality=100)
    return dict(src='data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode(), x=bbox[0], y=bbox[1], w=crop.width, h=crop.height)


layers = {n: uri(n) for n in NAMES}
# arm-wave is placed by its pivot, so keep its own (uncropped-origin) coordinates: shift the pivot by the crop.
aw = layers['arm-wave']
rig['armWave']['pivotInImg'] = [rig['armWave']['pivotInImg'][0] - aw['x'], rig['armWave']['pivotInImg'][1] - aw['y']]

PLAYER = r"""
<script>
(function(){
const RIG = __RIG__, LAY = __LAY__;
const imgs = {}; let loaded = 0; let capeBuf = null; const names = Object.keys(LAY);
const q = new URLSearchParams(location.search);
const FREEZE = q.has('t') ? parseFloat(q.get('t')) : null;
const FTAP = q.has('tap') ? parseFloat(q.get('tap')) : null;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = RIG.stage, CYCLE = 6.0;
const ease = x => x < .5 ? 2*x*x : 1 - Math.pow(-2*x + 2, 2) / 2;          // ease-in-out
const outBack = x => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// deterministic blink schedule: every 3-5 s
const blinks = []; { let t = 1.3, s = 7; while (t < 600) { blinks.push(t); s = (s * 9301 + 49297) % 233280; t += 3 + 2 * (s / 233280); } }
function blinkPhase(t) { for (const b of blinks) { if (b > t) break; const d = t - b; if (d < 0.16) return d < 0.04 || d > 0.12 ? 'half' : 'closed'; } return null; }
function armState(t) {         // returns {rest: alpha of hip arm, wave: alpha of raised arm, ang: degrees offset from base}
  const c = t % CYCLE, A = RIG.armWave.amp;
  if (c < 0.9) return { rest: 1, wave: 0, ang: 0 };
  if (c < 1.25) { const p = (c - 0.9) / 0.35; return { rest: clamp(1 - p * 7, 0, 1), wave: clamp(p * 7, 0, 1), ang: 55 * (1 - outBack(p)) }; }  // swing up
  if (c < 3.65) { const p = (c - 1.25) / 2.4; return { rest: 0, wave: 1, ang: -A * Math.sin(p * Math.PI * 4) * (p < .08 ? ease(p / .08) : p > .92 ? ease((1 - p) / .08) : 1) }; } // 2 waves
  if (c < 4.0) { const p = (c - 3.65) / 0.35; const e = ease(p); return { rest: clamp((p - 0.86) * 7, 0, 1), wave: clamp(1 - (p - 0.86) * 7, 0, 1), ang: 55 * e }; } // swing down
  return { rest: 1, wave: 0, ang: 0 };
}
function draw(ctx, t, tap, sc) {
  ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.clearRect(0, 0, S.w, S.h);
  ctx.translate(S.heroX, S.heroY);
  const B = RIG.breath, still = reduce;
  // tap: hop + laugh (0.9 s)
  let hop = 0, sq = 0, laugh = false;
  if (tap != null && tap < 0.95) {
    laugh = true;
    if (!still) {
      if (tap < 0.08) sq = -0.05 * Math.sin(tap / 0.08 * Math.PI / 2);                           // crouch
      else if (tap < 0.48) { const p = (tap - 0.08) / 0.4; hop = -70 * Math.sin(p * Math.PI); sq = 0.03 * Math.sin(p * Math.PI); }
      else if (tap < 0.62) sq = -0.04 * Math.sin((tap - 0.48) / 0.14 * Math.PI);                 // land
    }
  }
  const br = still ? 0 : Math.sin(t / B.period * Math.PI * 2);
  const sy = 1 + B.sy * br + sq, sx = 1 - B.sx * br - sq * 0.6;
  ctx.translate(B.origin[0], B.origin[1] + hop); ctx.scale(sx, sy); ctx.translate(-B.origin[0], -B.origin[1]);
  const L = (n, a) => { const l = LAY[n]; if (a !== undefined) ctx.globalAlpha = a; ctx.drawImage(imgs[n], l.x, l.y); ctx.globalAlpha = 1; };
  // cape: sway about the collar + a ripple that grows toward the hem (row slices, so it stays crisp)
  const C = RIG.cape, cl = LAY['cape'];
  ctx.save();
  const sway = still ? 0 : C.swayDeg * Math.sin(t / C.swayPeriod * Math.PI * 2 + 1.1);
  ctx.translate(C.pivot[0], C.pivot[1]); ctx.rotate(sway * Math.PI / 180); ctx.translate(-C.pivot[0], -C.pivot[1]);
  if (still) L('cape'); else {
    // ripple rendered at native resolution into an offscreen canvas (1 px rows), then drawn once: no seams
    const oc = capeBuf || (capeBuf = Object.assign(document.createElement('canvas'), { width: cl.w + 40, height: cl.h }));
    const ox = oc.getContext('2d'); ox.clearRect(0, 0, oc.width, oc.height);
    for (let y = 0; y < cl.h; y++) {
      const yy = cl.y + y, f = clamp((yy - C.top) / (C.hem - C.top), 0, 1);
      const dx = C.rippleAmpPx * Math.pow(f, 1.6) * Math.sin(t / C.ripplePeriod * Math.PI * 2 - yy / 60);
      ox.drawImage(imgs['cape'], 0, y, cl.w, 1, 20 + dx, y, cl.w, 1);
    }
    ctx.drawImage(oc, cl.x - 20, cl.y);
  }
  ctx.restore();
  // raised arm (behind the body, shoulder hidden behind the edge)
  const st = still ? { rest: 1, wave: 0, ang: 0 } : armState(t);
  if (st.wave > 0) {
    const W = RIG.armWave, l = LAY['arm-wave'];
    ctx.save(); ctx.globalAlpha = st.wave;
    ctx.translate(W.pivotOnHero[0], W.pivotOnHero[1]);
    ctx.rotate((W.baseAngle - W.imgAngle + st.ang) * Math.PI / 180);
    ctx.scale(W.scale, W.scale); ctx.translate(-W.pivotInImg[0], -W.pivotInImg[1]);
    ctx.drawImage(imgs['arm-wave'], 0, 0); ctx.restore();
  }
  L('body');
  if (st.rest > 0) L('arm-rest', st.rest);
  if (laugh) { L('eyes-happy'); L('mouth-laugh'); }
  else { const b = blinkPhase(t); if (b) L('eyes-' + b); }
}
function start() {
  document.querySelectorAll('canvas.wwave').forEach(cv => {
    const dpr = Math.min(2, window.devicePixelRatio || 1), cssW = cv.clientWidth || 360;
    const k = cssW / S.w; cv.width = Math.round(S.w * k * dpr); cv.height = Math.round(S.h * k * dpr);
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    let tapAt = null; const t0 = performance.now(); const DT = cv.dataset.t ? parseFloat(cv.dataset.t) : null, DTAP = cv.dataset.tap ? parseFloat(cv.dataset.tap) : null;
    cv.addEventListener('pointerdown', () => { tapAt = performance.now(); });
    const frame = now => {
      const t = DT != null ? DT : FREEZE != null ? FREEZE : (now - t0) / 1000;
      const tap = DTAP != null ? DTAP : FTAP != null ? FTAP : (tapAt ? (now - tapAt) / 1000 : null);
      draw(ctx, t, tap, k * dpr);
      if (FREEZE == null && DT == null && !(reduce && tapAt == null)) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    if (reduce) cv.addEventListener('pointerdown', () => requestAnimationFrame(frame));
  });
  document.documentElement.dataset.wwaveReady = '1';
}
names.forEach(n => { const im = new Image(); im.onload = () => { if (++loaded === names.length) start(); }; im.src = LAY[n].src; imgs[n] = im; });
})();
</script>"""

player = PLAYER.replace('__RIG__', json.dumps(rig)).replace('__LAY__', json.dumps(layers))

STYLE = """
.wwave-pair{display:flex;gap:16px;flex-wrap:wrap;justify-content:center}
.wwave-stage{border-radius:20px;padding:12px;flex:1 1 300px;max-width:420px;display:flex;flex-direction:column;align-items:center}
.wwave-stage.light{background:linear-gradient(160deg,#f6f3ff,#ece6fb)}
.wwave-stage.dark{background:linear-gradient(160deg,#1b1530,#0e0b1c)}
.wwave-stage canvas{width:100%;max-width:380px;aspect-ratio:1300/1090;cursor:pointer;touch-action:manipulation}
.wwave-stage span{font:600 12px/1.4 system-ui,sans-serif;opacity:.6;margin-top:4px}
.wwave-stage.dark span{color:#e9e4ff}
"""
FRAG = f"""<style>{STYLE}</style>
<div class="wwave-pair">
  <div class="wwave-stage light"><canvas class="wwave" aria-label="W waving (tap him)"></canvas><span>Light. Tap W to make him hop and laugh.</span></div>
  <div class="wwave-stage dark"><canvas class="wwave" aria-label="W waving on dark (tap him)"></canvas><span>Dark</span></div>
</div>
{player}
"""
open(os.path.join(HERE, 'embed.html'), 'w').write(FRAG)
html = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>W Wave Pilot</title>
<style>
:root{{--bg:#faf9fd;--fg:#1d1830}}
@media (prefers-color-scheme: dark){{:root{{--bg:#110e1d;--fg:#ece8ff}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:24px 16px}}
h1{{font-size:20px;margin:0 0 4px;text-align:center}} p{{text-align:center;opacity:.7;margin:0 0 18px;font-size:13px}}
</style></head><body>
<h1>W puppet pilot: wave, blink, cape, tap to laugh</h1>
<p>Cut from the approved hero art. The canvas draws the layers; nothing here is a redrawn W except the raised hand.</p>
{FRAG}
</body></html>"""
open(os.path.join(HERE, 'preview.html'), 'w').write(html)
print('preview.html', round(len(html) / 1024), 'KB')
