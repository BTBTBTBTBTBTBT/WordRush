// The cold-start intro's rules and timeline (docs/FINISH_SPEC.md F2;
// components/providers/cold-start-intro.tsx). Pure, so they're testable.

export const INTRO = {
  /** Marks the intro as shown for this browser session (never on a warm start / resume). */
  sessionKey: 'wordocious-intro-shown',
  /** The W bounces first; the row starts assembling here (ms). */
  rowAt: 420,
  /** The nine other heroes pop in this far apart (ms). */
  popStagger: 60,
  /** The assembled row glides up into the header here (ms)… */
  glideAt: 1040,
  /** …over this long (ms). */
  glideMs: 420,
  /** Everything has cleared by here (ms); the whole intro stays ≤ 1.6 s. */
  endAt: 1460,
  /** The last fade (ms). */
  outMs: 140,
  /** Reduce Motion: hold, then a 200 ms crossfade (ms). */
  reducedHoldMs: 120,
  reducedFadeMs: 200,
} as const;

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
