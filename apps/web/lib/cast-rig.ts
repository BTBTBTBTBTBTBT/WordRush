// The cast puppets (2.7.1): the header's ten characters drawn from their rigs — layers
// cut from the canonical hero art (docs/design/brand/animation/<id>/), animated with
// breathing, blinks, a staggered signature move and tap → hop + laugh.
//
// The bundle (public/art/rig/cast-rigs.json + <id>-<layer>.webp) is written by
// docs/design/brand/animation/rig-engine/ship-rigs.py, which also writes the same JSON
// for iOS (Assets.xcassets/cast-rigs.dataset) and Android (res/raw/cast_rigs.json).
// `evaluateRig` is a line-for-line port of that script's reference evaluator; the three
// platforms are held to its draw ops by rig-engine/rig-golden.json (cast-rig.test.ts,
// CastRigTests.swift, CastRigTest.kt).

export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'sine' | 'inCubic' | 'outCubic' | 'outBack' | 'outBackSoft' | 'step';
export type Key = [number, number, Ease?] | [number, number];
export type Track = { kf?: Key[]; period?: number; offset?: number; osc?: number[]; env?: Key[] };
export type Spec = number | string | Spec[] | undefined | null;
export type RigLayer = {
  img: string; pivot?: [number, number]; at?: [number, number]; pivotInImg?: [number, number];
  rot?: Spec; dx?: Spec; dy?: Spec; s?: Spec; sx?: Spec; sy?: Spec; alpha?: Spec; when?: string; shadow?: boolean;
};
export type LayerBox = { x: number; y: number; w: number; h: number };
export type Rig = {
  id: string; name: string; gesture: string; cycle: number;
  breath?: { origin: [number, number]; period: number; sy: number; sx: number };
  root?: { origin?: [number, number]; dx?: Spec; dy?: Spec; rot?: Spec; sx?: Spec; sy?: Spec };
  blink?: { half?: string; closed?: string }; eyesTrack?: string; laugh: string[]; patchAfter?: string;
  blinkSeed: number; blinkStart: number;
  tracks: Record<string, Track>; layers: RigLayer[]; lay: Record<string, LayerBox>;
  mascot: { size: number; s: number; ox: number; oy: number };
  warp: [number, number][]; gestureWindow: [number, number] | null;
};
export type TapSpec = { dur: number; hop: number; hopT: [number, number]; sq: Key[]; laugh: Key[] };
export type RigBundle = { version: number; layerScale: number; tap: TapSpec; cast: string[]; rigs: Record<string, Rig> };
/** One draw: the layer image drawn into (0, 0, w, h) hero px under [a, b, c, d, e, f], at `alpha`. */
export type DrawOp = { layer: string; m: [number, number, number, number, number, number]; alpha: number };
type M = [number, number, number, number, number, number];

export const RIG_BASE = '/art/rig';
export const rigBundleUrl = () => `${RIG_BASE}/cast-rigs.json`;
export const rigLayerUrl = (id: string, layer: string) => `${RIG_BASE}/${id}-${layer}.webp`;

const EASE: Record<string, (x: number) => number> = {
  linear: (x) => x,
  in: (x) => x * x,
  out: (x) => 1 - (1 - x) * (1 - x),
  inOut: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  sine: (x) => 0.5 - 0.5 * Math.cos(Math.PI * x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  outBack: (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2),
  outBackSoft: (x) => 1 + 1.9 * Math.pow(x - 1, 3) + 0.9 * Math.pow(x - 1, 2),
  step: (x) => (x < 1 ? 0 : 1),
};

export function kfVal(kf: Key[], t: number): number {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 1; i < kf.length; i++) {
    if (t < kf[i][0]) {
      const a = kf[i - 1];
      const b = kf[i];
      const p = (t - a[0]) / (b[0] - a[0]);
      const e = EASE[(b[2] as string) || 'inOut'] || EASE.inOut;
      return a[1] + (b[1] - a[1]) * e(p);
    }
  }
  return kf[kf.length - 1][1];
}

function isFree(R: Rig, tr: Track): boolean {
  if (tr.kf) return !!tr.period && Math.abs(tr.period - R.cycle) > 1e-6;
  return !tr.env;
}

/** `t` null = ambient off: the free-running idle sways hold their rest value. */
function trackVal(R: Rig, name: string, t: number | null, g: number): number {
  const tr = R.tracks[name];
  if (!tr) return 0;
  const free = isFree(R, tr);
  if (free && t === null) return restVal(R, name);
  const c = free ? (t as number) : g;
  let v = 0;
  if (tr.kf) {
    const P = tr.period || R.cycle;
    const o = tr.offset || 0;
    v += kfVal(tr.kf, free ? (((c - o) % P) + P) % P : Math.min(c, P));
  }
  if (tr.osc) {
    const [amp, per, t0 = 0, bounce = 0] = tr.osc;
    let o = bounce ? -Math.abs(amp * Math.sin((Math.PI * (c - t0)) / per)) : amp * Math.sin((2 * Math.PI * (c - t0)) / per);
    if (tr.env) o *= kfVal(tr.env, Math.min(c, R.cycle));
    v += o;
  }
  return v;
}

function restVal(R: Rig, name: string): number {
  const tr = R.tracks[name];
  return tr && tr.kf ? tr.kf[0][1] : 0;
}

function val(R: Rig, spec: Spec, t: number | null, g: number, still: boolean, dflt: number): number {
  if (spec === undefined || spec === null) return dflt;
  if (typeof spec === 'number') return spec;
  if (typeof spec === 'string') return still ? restVal(R, spec) : trackVal(R, spec, t, g);
  let s = 0;
  for (const x of spec) s += val(R, x, t, g, still, 0);
  return s;
}

const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const Rd = (deg: number): M => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};

const blinkCache = new WeakMap<Rig, number[]>();
export function blinkTimes(seed: number, start: number): number[] {
  const out: number[] = [];
  let t = start;
  let s = seed;
  while (t < 900) {
    out.push(t);
    s = (s * 9301 + 49297) % 233280;
    t += 3 + 2 * (s / 233280);
  }
  return out;
}
function blinkState(R: Rig, t: number): 'half' | 'closed' | null {
  let bl = blinkCache.get(R);
  if (!bl) { bl = blinkTimes(R.blinkSeed, R.blinkStart); blinkCache.set(R, bl); }
  const tt = t % 900;
  for (const b of bl) {
    if (b > tt) break;
    const d = tt - b;
    if (d < 0.16) return d < 0.04 || d > 0.12 ? 'half' : 'closed';
  }
  return null;
}

export function warpG(R: Rig, r: number): number {
  const w = R.warp;
  if (r <= w[0][0]) return w[0][1];
  for (let i = 1; i < w.length; i++) {
    if (r < w[i][0]) {
      const a = w[i - 1];
      const b = w[i];
      return a[1] + ((b[1] - a[1]) * (r - a[0])) / (b[0] - a[0]);
    }
  }
  return w[w.length - 1][1];
}

/** How long (s) the signature move plays in real time (0 = none). */
export const gestureSeconds = (R: Rig) => (R.gestureWindow ? R.warp[R.warp.length - 1][0] : 0);

/** The tap's squash / hop (hero px) at `tap` s — also drives the costumed (season) figures. */
export function tapPose(tap: TapSpec, t: number): { hop: number; sq: number } {
  if (t < 0 || t >= tap.dur) return { hop: 0, sq: 0 };
  const [h0, h1] = tap.hopT;
  const hop = t >= h0 && t < h1 ? -tap.hop * Math.sin(((t - h0) / (h1 - h0)) * Math.PI) : 0;
  return { hop, sq: kfVal(tap.sq, t) };
}

/**
 * The draw ops for one frame, back to front. `t` wall clock (s); `gr` seconds since the
 * signature move started (null = rest); `tap` seconds since a tap (null = none); `still`
 * Reduce Motion (the pose holds; a tap only fades the laughing face in and out).
 */
export function evaluateRig(B: RigBundle, R: Rig, tw: number, gr: number | null, tap: number | null, still: boolean, laughOk = true, ambient = true): DrawOp[] {
  const TP = B.tap;
  // ambient = false: no breathing / idle sways (the rest pose between moves); blinks keep `tw`.
  const t = ambient ? tw : null;
  const g = gr === null || still || gr >= R.warp[R.warp.length - 1][0] ? 0 : warpG(R, gr);
  let hop = 0;
  let sq = 0;
  let la = 0;
  if (tap !== null && tap >= 0 && tap < TP.dur) {
    la = laughOk ? kfVal(TP.laugh, tap) : 0;
    if (!still) ({ hop, sq } = tapPose(TP, tap));
  }
  const ops: DrawOp[] = [];
  const lay = R.lay;
  for (const L of R.layers) {
    if (!L.shadow) continue;
    const l = lay[L.img];
    const f = Math.min(1, Math.max(0, -hop / TP.hop));
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    const fl = still ? 0 : val(R, R.root?.dy, t, g, still, 0);
    const gg = Math.min(1.2, Math.max(0.5, 1 - 0.35 * f + Math.min(0, fl) * 0.004));
    ops.push({ layer: L.img, m: mul(mul(mul(T(cx, cy), S(gg, gg)), T(-cx, -cy)), T(l.x, l.y)), alpha: 1 - 0.45 * f });
  }
  const Br = R.breath || { origin: [512, 960] as [number, number], period: 3.4, sy: 0.012, sx: 0.006 };
  const br = still || t === null ? 0 : Math.sin((t / Br.period) * Math.PI * 2);
  const sy = 1 + Br.sy * br + sq;
  const sx = 1 - Br.sx * br - sq * 0.6;
  const RT = R.root || {};
  const o = RT.origin || Br.origin;
  const rdx = val(R, RT.dx, t, g, still, 0);
  const rdy = val(R, RT.dy, t, g, still, 0);
  const rrot = val(R, RT.rot, t, g, still, 0);
  const rsx = val(R, RT.sx, t, g, still, 1);
  const rsy = val(R, RT.sy, t, g, still, 1);
  const root = mul(mul(mul(mul(T(rdx, rdy + hop), T(o[0], o[1])), Rd(rrot)), S(sx * rsx, sy * rsy)), T(-o[0], -o[1]));

  // The laugh face fades in OVER the opaque face (blink lids stay opaque under it), so no
  // frame shows two half-transparent faces; the face under it hides once the laugh is full.
  const patches = () => {
    if (la < 0.998 && !still && R.blink) blink();
    if (la > 0.002) for (const p of R.laugh || []) { const l = lay[p]; ops.push({ layer: p, m: mul(root, T(l.x, l.y)), alpha: la }); }
  };
  const blink = () => {
    if (!R.blink) return;
    let e: 'half' | 'closed' | null = blinkState(R, tw);
    if (R.eyesTrack) {
      const v = trackVal(R, R.eyesTrack, t, g);
      if (v >= 1.5) e = 'closed';
      else if (v >= 0.5 && e !== 'closed') e = 'half';
    }
    const p = e ? R.blink[e] : undefined;
    if (p) { const l = lay[p]; ops.push({ layer: p, m: mul(root, T(l.x, l.y)), alpha: 1 }); }
  };

  let patched = false;
  for (const L of R.layers) {
    if (L.shadow) continue;
    const aMul = L.when === 'laugh' ? la : L.when === 'nolaugh' ? (la >= 0.998 ? 0 : 1) : 1;
    const l = lay[L.img];
    const piv = L.pivot || [l.x, l.y];
    const at = L.at || piv;
    const pin = L.pivotInImg || [piv[0] - l.x, piv[1] - l.y];
    const rot = val(R, L.rot, t, g, still, 0);
    const dx = val(R, L.dx, t, g, still, 0);
    const dy = val(R, L.dy, t, g, still, 0);
    const s = val(R, L.s, t, g, still, 1);
    const lsx = val(R, L.sx, t, g, still, 1) * s;
    const lsy = val(R, L.sy, t, g, still, 1) * s;
    let alpha = L.alpha === undefined || L.alpha === null ? 1 : Math.min(1, Math.max(0, val(R, L.alpha, t, g, still, 1)));
    alpha *= aMul;
    const atRest = Math.abs(rot) < 0.01 && Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(lsx - 1) < 1e-3 && Math.abs(lsy - 1) < 1e-3;
    if (alpha > 0.002 && !(L.when === 'active' && atRest)) {
      ops.push({ layer: L.img, m: mul(mul(mul(mul(root, T(at[0] + dx, at[1] + dy)), Rd(rot)), S(lsx, lsy)), T(-pin[0], -pin[1])), alpha });
    }
    if (R.patchAfter && L.img === R.patchAfter) { patches(); patched = true; }
  }
  if (!patched) patches();
  return ops;
}

/** Every layer image a rig draws. */
export const rigLayers = (R: Rig) => Object.keys(R.lay);

// ------------------------------------------------------------------ runtime loader

let bundlePromise: Promise<RigBundle> | null = null;
/** The rig bundle, fetched once per page load. */
export function loadRigBundle(): Promise<RigBundle> {
  if (!bundlePromise) {
    bundlePromise = fetch(rigBundleUrl()).then((r) => {
      if (!r.ok) throw new Error(`cast-rigs ${r.status}`);
      return r.json() as Promise<RigBundle>;
    });
    bundlePromise.catch(() => { bundlePromise = null; });
  }
  return bundlePromise;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
/** One decoded layer image (shared by every header on the page). */
export function loadRigImage(id: string, layer: string): Promise<HTMLImageElement> {
  const url = rigLayerUrl(id, layer);
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error(`rig layer ${url}`));
      im.src = url;
    });
    p.catch(() => imageCache.delete(url));
    imageCache.set(url, p);
  }
  return p;
}
