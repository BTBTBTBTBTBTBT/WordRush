// FINISH_SPEC BJ9 / BJ10 — the game open/close ("grow + soft rise") and the menu /
// sheet "soft pop" timing and geometry. Mirrors iOS Sources/Core/MotionSpec.swift
// and Android core MotionSpec.kt (same numbers; each platform's tests pin them).
//
// Rules (founder, 10-03, "making sure it isn't choppy at all"): only a cheap shell
// (a solid rounded box in the card's color) and snapshots move; the live game is
// never transformed — it's built under the shell and revealed. Transform / opacity
// only, one driver (a View Transition, else one WAAPI timeline), no blur.

export const MOTION = {
  // BJ9 open
  liftScale: 1.03,
  liftRise: 4,
  liftMs: 120,
  growMs: 440,
  shellFadeInMs: 100,
  /** The real game fades in over the LAST 60% of the grow. */
  revealFraction: 0.6,
  /** ease-out-expo-like: most of the grow lands early, then it settles. */
  growEase: 'cubic-bezier(0.16, 1, 0.3, 1)',
  // BJ9 close
  closeFadeMs: 180,
  shrinkMs: 380,
  shrinkFadeFraction: 0.3,
  // BJ9 without a source: a centered soft rise
  riseScale: 0.96,
  riseOffset: 14,
  riseMs: 340,
  /** Reduce Motion: a plain cross-fade. */
  crossFadeMs: 220,
  // BJ10 soft pop
  popScale: 0.94,
  popMs: 420,
  popDismissMs: 200,
  /** A soft settling spring as a curve (a whisper of overshoot). */
  popEase: 'cubic-bezier(0.2, 1.12, 0.36, 1)',
  dimAlpha: 0.28,
} as const;

export type OpenKind = 'grow' | 'rise' | 'crossFade';

export interface Box { left: number; top: number; width: number; height: number }

export function openKind(hasSource: boolean, reduceMotion: boolean): OpenKind {
  if (reduceMotion) return 'crossFade';
  return hasSource ? 'grow' : 'rise';
}

/** The card after the lift: scaled about its center, raised `liftRise`. */
export function liftedFrame(card: Box): Box {
  const w = card.width * MOTION.liftScale;
  const h = card.height * MOTION.liftScale;
  return { left: card.left + card.width / 2 - w / 2, top: card.top + card.height / 2 - h / 2 - MOTION.liftRise, width: w, height: h };
}

/** The soft rise's starting frame: the screen scaled 0.96 about its center, 14 px lower. */
export function riseStartFrame(screen: Box): Box {
  const w = screen.width * MOTION.riseScale;
  const h = screen.height * MOTION.riseScale;
  return { left: screen.left + screen.width / 2 - w / 2, top: screen.top + screen.height / 2 - h / 2 + MOTION.riseOffset, width: w, height: h };
}

/** When (ms after the tap) the game starts fading in, and for how long. */
export function revealTiming(kind: OpenKind): { delay: number; duration: number } {
  switch (kind) {
    case 'grow': return { delay: MOTION.liftMs + MOTION.growMs * (1 - MOTION.revealFraction), duration: MOTION.growMs * MOTION.revealFraction };
    case 'rise': return { delay: MOTION.riseMs * (1 - MOTION.revealFraction), duration: MOTION.riseMs * MOTION.revealFraction };
    default: return { delay: 0, duration: MOTION.crossFadeMs };
  }
}

export function openDurationMs(kind: OpenKind): number {
  const r = revealTiming(kind);
  return r.delay + r.duration;
}

export function closeDurationMs(kind: OpenKind): number {
  switch (kind) {
    case 'grow': return MOTION.closeFadeMs + MOTION.shrinkMs;
    case 'rise': return MOTION.closeFadeMs + MOTION.riseMs * 0.7;
    default: return MOTION.crossFadeMs;
  }
}

/** A source worth growing from: non-degenerate and at least a quarter on screen. */
export function usableSource(frame: Box | null | undefined, screen: Box): Box | null {
  if (!frame || !(frame.width >= 24) || !(frame.height >= 24)) return null;
  const l = Math.max(frame.left, screen.left);
  const t = Math.max(frame.top, screen.top);
  const r = Math.min(frame.left + frame.width, screen.left + screen.width);
  const b = Math.min(frame.top + frame.height, screen.top + screen.height);
  if (r <= l || b <= t) return null;
  return (r - l) * (b - t) >= frame.width * frame.height * 0.25 ? frame : null;
}

/** The transform that maps the full screen onto `to` (for a shell drawn at full size). */
export function shellTransform(to: Box, screen: Box): string {
  const sx = to.width / screen.width;
  const sy = to.height / screen.height;
  return `translate(${to.left - screen.left}px, ${to.top - screen.top}px) scale(${sx}, ${sy})`;
}

export function expoOut(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * Math.max(0, t));
}

// ── BJ10: which presentations keep the SYSTEM sheet ─────────────────────────

/** System presenters keep their own look and motion (share, purchase, OAuth, pickers, mail). */
export const SYSTEM_SHEETS = ['share', 'purchase', 'signInApple', 'signInGoogle', 'photoPicker', 'mail', 'safari'] as const;
export const FULL_SCREEN_GAMES = 'game';

export function usesSoftPop(kind: string): boolean {
  return kind !== FULL_SCREEN_GAMES && !(SYSTEM_SHEETS as readonly string[]).includes(kind);
}
