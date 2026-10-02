// FINISH_SPEC AQ2 (web): continuous CSS loops (rays, bobbing, shimmer, pulses)
// pause while off-screen and while the page is scrolling, so scrolling never
// pays for animations nobody can see. components/providers/motion-pause.tsx
// marks elements; globals.css pauses `[data-offscreen]` and
// `html[data-scrolling]` loops. Pure list so the test can check the stylesheet.

/** The looping animation classes in globals.css. */
export const LOOP_CLASSES = [
  'animate-gradient-x', 'animate-gradient-slow', 'animate-pulse-slow', 'animate-pulse-slow-delayed',
  'animate-shimmer', 'animate-sparkle', 'animate-float', 'animate-glow-pulse', 'animate-blob',
  'animate-blob-reverse', 'animate-title-pulse', 'animate-foil-sweep', 'animate-banner-shimmer',
  'mascot-bob', 'art-float', 'celebrate-glow', 'candy-badge-pulse', 'champ-in', 'loop-wobble',
  'rp-rays', 'rp-bob', 'lh-sweep',
] as const;

export const LOOP_SELECTOR = LOOP_CLASSES.map((c) => `.${c}`).join(', ');

/** How long after the last scroll event the loops resume (ms). */
export const SCROLL_IDLE_MS = 160;
