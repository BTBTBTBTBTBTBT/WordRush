// FINISH_SPEC AQ2 (web): continuous CSS loops (rays, bobbing, shimmer, pulses)
// pause while off-screen and while the page is scrolling, so scrolling never
// pays for animations nobody can see. components/providers/motion-pause.tsx
// marks elements; globals.css pauses `[data-offscreen]` and
// `html[data-scrolling]` loops. Pure list so the test can check the stylesheet.
// Smoothness pass (desktop web): the Tailwind loops (skeleton pulse, ping,
// spinners) are covered too, and at most MAX_RUNNING_LOOPS visible loops run at
// once — the rest wait (`data-loop-capped`) until one leaves the screen.

/** The looping animation classes in globals.css. */
export const LOOP_CLASSES = [
  'animate-gradient-x', 'animate-gradient-slow', 'animate-pulse-slow', 'animate-pulse-slow-delayed',
  'animate-shimmer', 'animate-sparkle', 'animate-float', 'animate-glow-pulse', 'animate-blob',
  'animate-blob-reverse', 'animate-title-pulse', 'animate-foil-sweep', 'animate-banner-shimmer',
  'mascot-bob', 'art-float', 'celebrate-glow', 'candy-badge-pulse', 'champ-in', 'loop-wobble',
  'rp-rays', 'rp-bob', 'gauntlet-glow', 'lh-sweep',
] as const;

/** Tailwind's own infinite loops (its generated `animate-*` utilities). */
export const TAILWIND_LOOP_CLASSES = ['animate-pulse', 'animate-ping', 'animate-spin'] as const;

/** Every looping class the pause provider watches. */
export const ALL_LOOP_CLASSES: readonly string[] = [...LOOP_CLASSES, ...TAILWIND_LOOP_CLASSES];

export const LOOP_SELECTOR = ALL_LOOP_CLASSES.map((c) => `.${c}`).join(', ');

/** How long after the last scroll event the loops resume (ms). */
export const SCROLL_IDLE_MS = 160;

/**
 * The most visible infinite loops that run at once. A screen rarely needs
 * more (a popup's rays + bob + glow, the banner's shimmer + host bob, a badge
 * pulse); past that, extra loops wait until one goes off-screen.
 */
export const MAX_RUNNING_LOOPS = 8;

/**
 * Which on-screen loops run and which wait: the first `max` in document order
 * run (the page reads top to bottom, and a popup mounts at the end of <body>,
 * so it is listed last — popups are exempt below), the rest wait. Loops inside
 * a dialog always run (`priority`), and count toward the cap.
 */
export function capLoops<T>(visible: readonly T[], max: number = MAX_RUNNING_LOOPS, priority: (t: T) => boolean = () => false): { run: T[]; wait: T[] } {
  const first = visible.filter(priority);
  const rest = visible.filter((t) => !priority(t));
  const room = Math.max(0, max - first.length);
  return { run: [...first, ...rest.slice(0, room)], wait: rest.slice(room) };
}
