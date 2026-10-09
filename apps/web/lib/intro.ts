// The cold-start intro's rules and timeline (docs/FINISH_SPEC.md F2;
// components/providers/cold-start-intro.tsx). Pure, so they're testable.

/** BI20 (founder 10-03: "slow down the intro … don't lose the fluidity"): the timeline plays 1.4× slower — same curves, same order. */
export const INTRO_PACE = 1.4;

export const INTRO = {
  /** Marks the intro as shown for this browser session (never on a warm start / resume). */
  sessionKey: 'wordocious-intro-shown',
  /** The W bounces first; the row starts assembling here (ms). */
  rowAt: Math.round(420 * INTRO_PACE),
  /** The nine other heroes pop in this far apart (ms). */
  popStagger: Math.round(60 * INTRO_PACE),
  /** The assembled row glides up into the header here (ms)… */
  glideAt: Math.round(1040 * INTRO_PACE),
  /** …over this long (ms). */
  glideMs: Math.round(420 * INTRO_PACE),
  /** Everything has cleared by here (ms); the whole intro stays ≤ 2.2 s. */
  endAt: Math.round(1460 * INTRO_PACE),
  /** The last fade (ms): only when there is no header row to land on. */
  outMs: 140,
  /**
   * F2 fix: the glide eases INTO the real row's frame with no overshoot (a
   * plain ease-out curve whose control points never pass 1).
   */
  glideEase: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
  /** After landing: every character settles with ONE soft arc (item 47: eased squash, hop, soft landing, rebound — no overshoot snap), this long… */
  flourishMs: 560,
  /** …this far apart, left to right (ms). */
  flourishStagger: 50,
  /** Reduce Motion: hold, then a 200 ms crossfade (ms). */
  reducedHoldMs: 120,
  reducedFadeMs: 200,
} as const;

/** How long the all-cast hop flourish runs for `n` characters (ms). */
export function flourishTotalMs(n: number): number {
  return Math.max(0, n - 1) * INTRO.flourishStagger + INTRO.flourishMs;
}

/** The <html> attribute set while the intro runs: the real header cast row stays laid out but hidden (globals.css). */
export const INTRO_RUNNING_ATTR = 'data-intro-running';
/** The <html> attribute set during the landing flourish: the cast row's one-at-a-time moves wait. */
export const CAST_FLOURISH_ATTR = 'data-cast-flourish';

/**
 * The intro row's frame for the glide (F2 fix): EXACTLY the real row's
 * on-screen box (getBoundingClientRect), with its top padding, so the two rows
 * lay out identically (same width → same per-character spacing and lift).
 */
export function glideFrame(target: { left: number; top: number; width: number }, paddingTop: string): { left: number; top: number; width: number; paddingTop: string } {
  return { left: target.left, top: target.top, width: target.width, paddingTop };
}

/**
 * AU5: the intro's row as a TRANSFORM from where it sits (`from`, its
 * on-screen box with `fromPad` px top padding) onto the real row's frame
 * (`to`, with `toPad` top padding) — translate + uniform scale about the top
 * left, so the glide animates only transform (no left / top / width / padding
 * layout per frame). The content top lands on to.top + toPad.
 */
export function glideTransform(
  from: { left: number; top: number; width: number }, fromPad: number,
  to: { left: number; top: number; width: number }, toPad: number,
): { x: number; y: number; scale: number } {
  const scale = from.width > 0 ? to.width / from.width : 1;
  return { x: to.left - from.left, y: to.top + toPad - (from.top + fromPad * scale), scale };
}

/** AU5: the longest the intro waits for its images to decode before starting anyway (ms). */
export const INTRO_PRELOAD_MAX_MS = 300;

/** The window event the intro fires once it has landed (or was never going to play). */
export const INTRO_DONE_EVENT = 'wordocious:intro-done';

/**
 * AU5: run heavy startup work (network, warm caches, prefetches) only after
 * the cold-start intro has landed, so it never competes with the intro's
 * frames. Runs at once when no intro is running. Returns a cancel.
 */
export function afterIntro(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!document.documentElement.hasAttribute(INTRO_RUNNING_ATTR)) { fn(); return () => {}; }
  let done = false;
  const run = () => { if (done) return; done = true; window.removeEventListener(INTRO_DONE_EVENT, run); fn(); };
  window.addEventListener(INTRO_DONE_EVENT, run);
  // Safety net: never wait past the longest intro.
  const t = window.setTimeout(run, INTRO_PRELOAD_MAX_MS + INTRO.endAt + INTRO.outMs + 500);
  return () => { done = true; window.clearTimeout(t); window.removeEventListener(INTRO_DONE_EVENT, run); };
}

/** The longest the intro can take (ms). */
export function introTotalMs(reduced: boolean): number {
  return reduced ? INTRO.reducedHoldMs + INTRO.reducedFadeMs : INTRO.endAt + INTRO.outMs;
}

/**
 * Play the intro? Only on a cold start (the static launch screen is still up
 * — a real document load), only at Home, and only once per browser session.
 */
export function introShouldPlay({ pathname, seenThisSession, hasStaticSplash }: {
  pathname: string;
  seenThisSession: boolean;
  hasStaticSplash: boolean;
}): boolean {
  return hasStaticSplash && !seenThisSession && (pathname === '/' || pathname === '');
}

/** The static launch screen (app/layout.tsx #app-loader) — the intro starts from it. */
export const SPLASH = {
  /** The Home wallpaper's colors (lib/art.ts PAGE_TINTS.home). */
  background: 'linear-gradient(to bottom right, #F3EEFF, #FBEFFF, #FFF1F7)',
  /** The app icon's W mascot (docs/design/brand/logo/option-B-w-mascot.png). */
  icon: '/splash-w.webp',
  /** Rendered size, CSS px. */
  size: 132,
} as const;
