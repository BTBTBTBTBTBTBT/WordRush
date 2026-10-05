// Wordocious puppet player: draws a cast rig (layers cut from the approved hero art) on a <canvas>.
// Inlined into every preview by rig-engine/build.py. No dependencies.
//   <canvas class="rig" data-rig="o1"></canvas>      registered with  WRIG.add(rigJson, layersJson)
//   Freeze for screenshots:  ?t=1.6 (seconds)  &tap=0.2 (seconds since a tap)   or per canvas data-t / data-tap.
// Rig JSON (hero-canvas pixels, 1024 x 1024):
//   stage {w,h,heroX,heroY}, cycle (s), breath {origin,period,sy,sx}, hop (px), tracks {name: track},
//   root {origin, rot, dx, dy, sx, sy}  (values: number | track name | [summed list])
//   layers [{img, pivot, at, rot, dx, dy, s, sx, sy, alpha, when, ripple, shadow}]   (draw order, back to front)
//   blink {half, closed}, eyesTrack, laugh [patch names], patchAfter (layer img the face patches sit on)
// Track: {kf: [[t, v, ease], ...], period, offset}  periodic keyframes (period defaults to the cycle)
//        {osc: [amp, period, t0, bounce], env: [[t, v, ease], ...]}   sine, optionally shaped by a cycle envelope
(function () {
  if (window.WRIG) return;
  const q = new URLSearchParams(location.search);
  const QT = q.has('t') ? parseFloat(q.get('t')) : null, QTAP = q.has('tap') ? parseFloat(q.get('tap')) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EASE = {
    linear: x => x, in: x => x * x, out: x => 1 - (1 - x) * (1 - x),
    inOut: x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2,
    sine: x => .5 - .5 * Math.cos(Math.PI * x),
    inCubic: x => x * x * x, outCubic: x => 1 - Math.pow(1 - x, 3),
    outBack: x => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    outBackSoft: x => { const c = 0.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); },
    step: x => x < 1 ? 0 : 1,
  };
  function kfVal(kf, t) {
    if (t <= kf[0][0]) return kf[0][1];
    for (let i = 1; i < kf.length; i++) if (t < kf[i][0]) {
      const a = kf[i - 1], b = kf[i], p = (t - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * (EASE[b[2] || 'inOut'] || EASE.inOut)(p);
    }
    return kf[kf.length - 1][1];
  }
  const RIGS = {};
  function trackVal(R, name, t) {
    const tr = R.tracks[name]; if (!tr) return 0;
    let v = 0;
    if (tr.kf) { const P = tr.period || R.cycle, o = tr.offset || 0; v += kfVal(tr.kf, ((t - o) % P + P) % P); }
    if (tr.osc) {
      const [amp, per, t0 = 0, bounce = 0] = tr.osc;
      let o = bounce ? -Math.abs(amp * Math.sin(Math.PI * (t - t0) / per)) : amp * Math.sin(2 * Math.PI * (t - t0) / per);
      if (tr.env) o *= kfVal(tr.env, ((t % R.cycle) + R.cycle) % R.cycle);
      v += o;
    }
    return v;
  }
  function val(R, spec, t, still, dflt) {
    if (spec === undefined || spec === null) return dflt;
    if (typeof spec === 'number') return spec;
    if (typeof spec === 'string') return still ? restVal(R, spec) : trackVal(R, spec, t);
    let s = 0; for (const x of spec) s += val(R, x, t, still, 0); return s;
  }
  function restVal(R, name) { const tr = R.tracks[name]; return tr && tr.kf ? tr.kf[0][1] : 0; }
  // deterministic blink schedule, every 3 to 5 s
  function blinkTimes(seed, start) { const out = []; let t = start, s = seed; while (t < 900) { out.push(t); s = (s * 9301 + 49297) % 233280; t += 3 + 2 * (s / 233280); } return out; }
  function blinkState(R, t) {
    for (const b of R._blinks) { if (b > t) break; const d = t - b; if (d < 0.16) return d < 0.04 || d > 0.12 ? 'half' : 'closed'; }
    return null;
  }
  function add(rig, lay) {
    const R = Object.assign({ tracks: {}, hop: 70, cycle: 6 }, rig); R.lay = lay; R.imgs = {}; R.ready = false;
    R._blinks = blinkTimes(rig.blinkSeed || 7, rig.blinkStart || 1.3);
    let n = 0; const names = Object.keys(lay);
    R.whenReady = new Promise(res => names.forEach(k => {
      const im = new Image(); im.onload = () => { if (++n === names.length) { R.ready = true; res(); } }; im.src = lay[k].src; R.imgs[k] = im;
    }));
    RIGS[rig.id] = R; return R;
  }
  function placeLayer(ctx, R, L, t, still) {
    const l = R.lay[L.img];
    const piv = L.pivot || [l.x, l.y];
    const at = L.at || piv;
    const pin = L.pivotInImg || [piv[0] - l.x, piv[1] - l.y];
    const rot = val(R, L.rot, t, still, 0), dx = val(R, L.dx, t, still, 0), dy = val(R, L.dy, t, still, 0);
    const s = val(R, L.s, t, still, 1), sx = val(R, L.sx, t, still, 1) * s, sy = val(R, L.sy, t, still, 1) * s;
    const alpha = L.alpha === undefined ? 1 : clamp(val(R, L.alpha, t, still, 1), 0, 1);
    return { l, at, pin, rot, dx, dy, sx, sy, alpha };
  }
  function drawLayer(ctx, R, L, t, still, buf) {
    const P = placeLayer(ctx, R, L, t, still), l = P.l;
    if (P.alpha <= 0.002) return;
    const rest = Math.abs(P.rot) < 0.01 && Math.abs(P.dx) < 0.05 && Math.abs(P.dy) < 0.05 && Math.abs(P.sx - 1) < 1e-3 && Math.abs(P.sy - 1) < 1e-3;
    if (L.when === 'active' && rest) return;
    ctx.save(); ctx.globalAlpha = P.alpha;
    ctx.translate(P.at[0] + P.dx, P.at[1] + P.dy); ctx.rotate(P.rot * Math.PI / 180); ctx.scale(P.sx, P.sy); ctx.translate(-P.pin[0], -P.pin[1]);
    const im = R.imgs[L.img];
    if (L.ripple && !still) {
      // cloth ripple: 1 px rows shifted on an offscreen canvas at native resolution, then composited once (no seams)
      const C = L.ripple, pad = Math.ceil(C.amp) + 2;
      const oc = buf[L.img] || (buf[L.img] = Object.assign(document.createElement('canvas'), { width: l.w + 2 * pad, height: l.h }));
      const ox = oc.getContext('2d'); ox.clearRect(0, 0, oc.width, oc.height);
      for (let y = 0; y < l.h; y++) {
        const yy = l.y + y, f = clamp((yy - C.top) / (C.hem - C.top), 0, 1);
        const d = C.amp * Math.pow(f, 1.6) * Math.sin(t / C.period * Math.PI * 2 - yy / 60);
        ox.drawImage(im, 0, y, l.w, 1, pad + d, y, l.w, 1);
      }
      ctx.drawImage(oc, -pad, 0);
    } else ctx.drawImage(im, 0, 0);
    ctx.restore();
  }
  function draw(ctx, R, t, tap, k, buf) {
    const S = R.stage, still = reduce;
    ctx.setTransform(k, 0, 0, k, 0, 0); ctx.clearRect(0, 0, S.w, S.h);
    ctx.translate(S.heroX, S.heroY);
    let hop = 0, sq = 0, laugh = false;
    if (tap != null && tap >= 0 && tap < 0.95) {
      laugh = true;
      if (!still) {
        if (tap < 0.08) sq = -0.05 * Math.sin(tap / 0.08 * Math.PI / 2);                                  // crouch
        else if (tap < 0.48) { const p = (tap - 0.08) / 0.4; hop = -R.hop * Math.sin(p * Math.PI); sq = 0.03 * Math.sin(p * Math.PI); }
        else if (tap < 0.62) sq = -0.04 * Math.sin((tap - 0.48) / 0.14 * Math.PI);                        // land
      }
    }
    const layers = R.layers;
    // ground shadow stays on the floor and fades as the character leaves it
    for (const L of layers) if (L.shadow) {
      const l = R.lay[L.img], f = clamp(-hop / R.hop, 0, 1), cx = l.x + l.w / 2, cy = l.y + l.h / 2;
      const fl = still ? 0 : val(R, R.root && R.root.dy, t, still, 0);
      const g = clamp(1 - 0.35 * f + Math.min(0, fl) * 0.004, 0.5, 1.2);
      ctx.save(); ctx.globalAlpha = 1 - 0.45 * f; ctx.translate(cx, cy); ctx.scale(g, g); ctx.translate(-cx, -cy);
      ctx.drawImage(R.imgs[L.img], l.x, l.y); ctx.restore();
    }
    const B = R.breath || { origin: [512, 960], period: 3.4, sy: 0.012, sx: 0.006 };
    const br = still ? 0 : Math.sin(t / B.period * Math.PI * 2);
    const sy = 1 + B.sy * br + sq, sx = 1 - B.sx * br - sq * 0.6;
    const RT = R.root || {}, o = RT.origin || B.origin;
    const rdx = val(R, RT.dx, t, still, 0), rdy = val(R, RT.dy, t, still, 0), rrot = val(R, RT.rot, t, still, 0);
    const rsx = val(R, RT.sx, t, still, 1), rsy = val(R, RT.sy, t, still, 1);
    ctx.translate(rdx, rdy + hop);
    ctx.translate(o[0], o[1]); ctx.rotate(rrot * Math.PI / 180); ctx.scale(sx * rsx, sy * rsy); ctx.translate(-o[0], -o[1]);
    const patches = () => {
      if (laugh) { for (const p of R.laugh || []) { const l = R.lay[p]; ctx.drawImage(R.imgs[p], l.x, l.y); } return; }
      if (still || !R.blink) return;
      let e = blinkState(R, t);
      if (R.eyesTrack) { const v = trackVal(R, R.eyesTrack, t); if (v >= 1.5) e = 'closed'; else if (v >= 0.5 && e !== 'closed') e = 'half'; }
      const p = e && R.blink[e]; if (p) { const l = R.lay[p]; ctx.drawImage(R.imgs[p], l.x, l.y); }
    };
    let patched = false;
    for (const L of layers) {
      if (L.shadow) continue;
      if (L.when === 'laugh' && !laugh) continue;
      if (L.when === 'nolaugh' && laugh) continue;
      drawLayer(ctx, R, L, t, still, buf);
      if (R.patchAfter && L.img === R.patchAfter) { patches(); patched = true; }
    }
    if (!patched) patches();
  }
  const live = new Set();
  function mount(cv) {
    const R = RIGS[cv.dataset.rig]; if (!R || cv._wrig) return; cv._wrig = 1;
    const S = R.stage, buf = {};
    let k = 1; const ctx = cv.getContext('2d');
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1), cssW = cv.clientWidth || 300;
      k = cssW / S.w * dpr; cv.width = Math.round(S.w * k); cv.height = Math.round(S.h * k); ctx.imageSmoothingQuality = 'high';
    };
    size(); addEventListener('resize', () => { size(); kick(); });
    let tapAt = null; const t0 = performance.now();
    const DT = cv.dataset.t ? parseFloat(cv.dataset.t) : QT, DTAP = cv.dataset.tap ? parseFloat(cv.dataset.tap) : QTAP;
    const frozen = DT != null;
    let raf = 0, visible = true;
    const frame = now => {
      raf = 0;
      const t = frozen ? DT : (now - t0) / 1000;
      const tap = DTAP != null ? DTAP : (tapAt ? (now - tapAt) / 1000 : null);
      draw(ctx, R, t, tap, k, buf);
      const tapping = tapAt && (now - tapAt) / 1000 < 1;
      if (!frozen && visible && (!reduce || tapping)) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    cv.addEventListener('pointerdown', () => { tapAt = performance.now(); kick(); });
    cv.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapAt = performance.now(); kick(); } });
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(cv);
    R.whenReady.then(() => { kick(); cv.dataset.ready = '1'; });
    live.add(cv);
  }
  function scan() { document.querySelectorAll('canvas[data-rig]').forEach(mount); }
  window.WRIG = { add, scan, RIGS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else setTimeout(scan, 0);
})();
