'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CAST, type MascotId } from '@/lib/mascots';
import { evaluateRig, gestureSeconds, loadRigBundle, loadRigImage, rigLayers, tapPose, type Rig, type RigBundle, type TapSpec } from '@/lib/cast-rig';
import { prefersReducedMotion } from '@/lib/motion';
import { haptic } from '@/lib/haptics';
import { castLaugh } from '@/lib/sounds';
import { CAST_FLOURISH_ATTR, INTRO_RUNNING_ATTR } from '@/lib/intro';

// The cast puppets in the living cast header (2.7.1). Each figure cell holds a
// <canvas data-puppet> laid over its hero image; once every layer has loaded the
// canvas takes over (`data-puppet-ready` on the row hides the images). If anything
// fails to load the hero images simply stay. One shared rAF loop draws the row:
// 15 fps while the cast just breathes and blinks, full rate while a signature move
// or a tap plays; nothing while the row is off screen or the tab is hidden.

/** The canvas box around the 512-px mascot square (mascot px): room for the hop and raised arms. */
export const PUPPET_PAD = { x: 160, top: 150, bottom: 28 } as const;
/** A signature move every 6–10 s, one character at a time (never the same twice in a row). */
const MOVE_FIRST_MS = 2600;
const moveGapMs = () => 6000 + Math.random() * 4000;
// Smooth over pretty: between moves the cast only breathes / blinks / sways a pixel or two,
// so 15 fps is plenty (each idle frame repaints the page); moves and taps run full rate.
const IDLE_FRAME_MS = 1000 / 15;

/** The puppet canvas box as percentages of a cell whose 512-px art is cut to `trim`. */
export function puppetBox([x0, y0, x1, y1]: readonly [number, number, number, number]) {
  const bw = x1 - x0;
  const bh = y1 - y0;
  const pct = (n: number) => `${Number(n.toFixed(3))}%`;
  const w = 512 + PUPPET_PAD.x * 2;
  const h = 512 + PUPPET_PAD.top + PUPPET_PAD.bottom;
  return {
    width: pct((w / bw) * 100),
    left: pct(((-x0 - PUPPET_PAD.x) / bw) * 100),
    top: pct(((-y0 - PUPPET_PAD.top) / bh) * 100),
    aspectRatio: `${w} / ${h}`,
  };
}

/** WAAPI keyframes for the tap hop of a costumed (season) figure: the same curve, transform only. */
export function tapKeyframes(tap: TapSpec, hopPct: number): Keyframe[] {
  const out: Keyframe[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * tap.dur;
    const { hop, sq } = tapPose(tap, t);
    const y = (hop / tap.hop) * hopPct;
    out.push({ offset: i / 30, transform: `translateY(${y.toFixed(2)}%) scale(${(1 - sq * 0.6).toFixed(4)}, ${(1 + sq).toFixed(4)})` });
  }
  return out;
}

type Live = { rig: Rig; imgs: Record<string, CanvasImageSource>; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scaled: Record<string, HTMLCanvasElement>; k: number; front?: boolean };

/** QA / perf A-B: `?puppets=off` (held for the session) or localStorage `debug-puppets` = off shows the static heroes. */
function puppetsKilled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('puppets');
    if (q === 'off') sessionStorage.setItem('debug-puppets', 'off');
    if (q === 'on') sessionStorage.removeItem('debug-puppets');
    return sessionStorage.getItem('debug-puppets') === 'off' || localStorage.getItem('debug-puppets') === 'off';
  } catch {
    return false;
  }
}

export function useCastPuppets(rowRef: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [bundle, setBundle] = useState<RigBundle | null>(null);
  const state = useRef({ gesture: {} as Record<string, number>, tap: {} as Record<string, number>, kick: () => {} });

  useEffect(() => {
    let off = false;
    loadRigBundle().then((b) => { if (!off) setBundle(b); }).catch(() => {});
    return () => { off = true; };
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!enabled || !row || !bundle || puppetsKilled()) { setReady(false); return; }
    let cancelled = false;
    let raf = 0;
    let moveTimer: ReturnType<typeof setTimeout> | undefined;
    let visible = true;
    let lastDraw = -Infinity;
    const t0 = performance.now();
    const live: Record<string, Live> = {};
    const S = state.current;
    S.gesture = {};
    S.tap = {};

    const sizeOf = (L: Live) => {
      const cssW = L.canvas.clientWidth;
      if (!cssW) return false;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = 512 + PUPPET_PAD.x * 2;
      const H = 512 + PUPPET_PAD.top + PUPPET_PAD.bottom;
      const pw = Math.max(1, Math.round(cssW * dpr));
      const k = pw / W; // canvas px per mascot px
      if (L.canvas.width !== pw) { L.canvas.width = pw; L.canvas.height = Math.round((H / W) * pw); }
      if (Math.abs(k - L.k) > 1e-4) {
        // Cache each layer at the size it is drawn (hero px → canvas px), so a frame is ~1:1 blits.
        L.k = k;
        const hk = L.rig.mascot.s * k;
        for (const name of rigLayers(L.rig)) {
          const box = L.rig.lay[name];
          const c = L.scaled[name] || (L.scaled[name] = document.createElement('canvas'));
          c.width = Math.max(1, Math.round(box.w * hk));
          c.height = Math.max(1, Math.round(box.h * hk));
          const x = c.getContext('2d');
          if (!x) continue;
          x.imageSmoothingQuality = 'high';
          x.clearRect(0, 0, c.width, c.height);
          x.drawImage(L.imgs[name], 0, 0, c.width, c.height);
        }
      }
      return true;
    };

    const drawOne = (L: Live, now: number, still: boolean) => {
      const R = L.rig;
      const t = (now - t0) / 1000;
      const gs = S.gesture[R.id];
      const tp = S.tap[R.id];
      let gr: number | null = gs !== undefined ? (now - gs) / 1000 : null;
      if (gr !== null && gr >= gestureSeconds(R)) { delete S.gesture[R.id]; gr = null; }
      let tap: number | null = tp !== undefined ? (now - tp) / 1000 : null;
      if (tap !== null && tap >= bundle.tap.dur) { delete S.tap[R.id]; tap = null; }
      // A character mid-move (raised arms, the hop) draws over its neighbors.
      const front = gr !== null || tap !== null;
      if (front !== L.front) { L.front = front; const cell = L.canvas.parentElement; if (cell) cell.style.zIndex = front ? '5' : ''; }
      const { ctx, k } = L;
      const M = R.mascot;
      // The puppet W hops inside his canvas: his crown (a sibling element) rides the same hop.
      if (R.id === 'w') {
        const crown = L.canvas.parentElement?.querySelector<HTMLElement>('[data-crown]');
        if (crown) {
          const hop = tap !== null && !still ? tapPose(bundle.tap, tap).hop : 0;
          const y = (hop * M.s * L.canvas.clientWidth) / (512 + PUPPET_PAD.x * 2);
          const v = hop ? `0 ${y.toFixed(2)}px` : '';
          if (crown.style.translate !== v) crown.style.translate = v;
        }
      }
      // hero px → canvas px
      const a = M.s * k;
      const ex = (M.ox + PUPPET_PAD.x) * k;
      const ey = (M.oy + PUPPET_PAD.top) * k;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
      for (const op of evaluateRig(bundle, R, t, gr, tap, still)) {
        const [m0, m1, m2, m3, m4, m5] = op.m;
        const box = R.lay[op.layer];
        const img = L.scaled[op.layer];
        if (!img) continue;
        ctx.setTransform(a * m0, a * m1, a * m2, a * m3, a * m4 + ex, a * m5 + ey);
        ctx.globalAlpha = op.alpha;
        ctx.drawImage(img, 0, 0, box.w, box.h);
      }
      ctx.globalAlpha = 1;
    };

    const busy = (now: number) => Object.keys(S.gesture).length > 0 || Object.values(S.tap).some((t) => now - t < bundle.tap.dur * 1000);

    const frame = (now: number) => {
      raf = 0;
      if (cancelled) return;
      const still = prefersReducedMotion();
      const active = busy(now);
      if (active || now - lastDraw >= IDLE_FRAME_MS - 2) {
        lastDraw = now;
        for (const L of Object.values(live)) if (L.k > 0) drawOne(L, now, still);
      }
      if (visible && document.visibilityState === 'visible' && (!still || active)) raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && !cancelled) raf = requestAnimationFrame(frame); };
    S.kick = kick;

    const schedule = (last: string | null) => {
      moveTimer = setTimeout(() => {
        let next = last;
        const now = performance.now();
        const intro = document.documentElement.hasAttribute(INTRO_RUNNING_ATTR) || document.documentElement.hasAttribute(CAST_FLOURISH_ATTR);
        if (!intro && visible && document.visibilityState === 'visible' && !prefersReducedMotion() && Object.keys(S.gesture).length === 0) {
          const pool = CAST.filter((id) => id !== last && live[id]);
          const id = pool[Math.floor(Math.random() * pool.length)];
          if (id) { S.gesture[id] = now; next = id; kick(); }
        }
        schedule(next);
      }, last === null ? MOVE_FIRST_MS : moveGapMs() + (last && live[last] ? gestureSeconds(live[last].rig) * 1000 : 0));
    };

    (async () => {
      try {
        await Promise.all(CAST.map(async (id) => {
          const R = bundle.rigs[id];
          const canvas = row.querySelector<HTMLCanvasElement>(`[data-cast="${id}"] canvas[data-puppet]`);
          const ctx = canvas?.getContext('2d');
          if (!R || !canvas || !ctx) throw new Error(`puppet ${id}`);
          const imgs: Record<string, CanvasImageSource> = {};
          await Promise.all(rigLayers(R).map(async (n) => { imgs[n] = await loadRigImage(id, n); }));
          live[id] = { rig: R, imgs, canvas, ctx, scaled: {}, k: 0 };
        }));
      } catch {
        return; // keep the hero images
      }
      if (cancelled) return;
      for (const L of Object.values(live)) sizeOf(L);
      for (const L of Object.values(live)) drawOne(L, performance.now(), prefersReducedMotion());
      setReady(true);
      kick();
      schedule(null);
    })();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { for (const L of Object.values(live)) sizeOf(L); lastDraw = -Infinity; kick(); }) : null;
    ro?.observe(row);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; if (visible) kick(); }) : null;
    io?.observe(row);
    const onVis = () => { if (document.visibilityState === 'visible') kick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(moveTimer);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      S.kick = () => {};
      setReady(false);
    };
  }, [rowRef, enabled, bundle]);

  /** Tap: hop + laugh (+ the character's signature move), a light haptic, the laugh-sound hook. */
  const tap = useCallback((id: MascotId) => {
    const S = state.current;
    const now = performance.now();
    S.tap[id] = now;
    if (S.gesture[id] === undefined && !prefersReducedMotion()) S.gesture[id] = now;
    haptic('light');
    castLaugh(id);
    S.kick();
  }, []);

  return { ready, tap, bundle };
}
