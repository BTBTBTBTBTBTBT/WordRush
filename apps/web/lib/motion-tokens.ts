// FINISH_SPEC AZ: ONE motion family for every popup, sheet, card and
// transition on web — the spring-in, the ease-out and the matching exit. The
// same numbers live in globals.css (`--m-*`, kept in step by
// motion-tokens.test.ts). Native parity: spring response ≈ 0.38 s, damping ≈ 0.82.
export const MOTION = {
  /** The spring-in (a light overshoot) — popups, cards, poses. */
  spring: 'cubic-bezier(0.3, 1.35, 0.5, 1)',
  springMs: 380,
  /** Plain ease-out for fades / scrims. */
  easeOut: 'cubic-bezier(0.22, 0.8, 0.3, 1)',
  fadeMs: 220,
  /** The matching exit. */
  easeIn: 'cubic-bezier(0.5, 0, 0.75, 0)',
  exitMs: 200,
  /** Confetti: never more pieces than this on screen. */
  confettiMax: 32,
} as const;
