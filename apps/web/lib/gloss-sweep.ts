import { prefersReducedMotion } from './motion';
import { INTRO_RUNNING_ATTR } from './intro';

// FINISH_SPEC AR's idle gloss sweep on the LiveHeadline lettering
// (components/ui/live-headline.tsx), smoothness pass: ONE short run every
// ~6 s, started from here, instead of an infinite CSS loop on every glyph of
// every headline. A run only starts when the headline is on screen, nothing
// is scrolling, the tab is visible, the cold-start intro isn't playing,
// Reduce Motion is off — and at most MAX_CONCURRENT headlines sweep at once.
// globals.css `.lh-sweeping .lh-gloss` is the run itself.

export const GLOSS_SWEEP = {
  /** The first run waits this long after the headline appears (ms). */
  firstMs: 1200,
  /** Then one run about this often (ms). */
  everyMs: 6000,
  /** One glyph's run (ms; globals.css `lh-sweep 840ms`). */
  runMs: 840,
  /** Each glyph starts this far after the one before (ms; globals.css `--i * 30ms`). */
  glyphStaggerMs: 30,
  /** Headlines sweeping at the same time, at most. */
  maxConcurrent: 2,
} as const;

/** How long a whole headline's run lasts (ms): the last glyph starts late. */
export function sweepRunMs(glyphs: number): number {
  return GLOSS_SWEEP.runMs + Math.max(0, glyphs - 1) * GLOSS_SWEEP.glyphStaggerMs;
}

/** May a run start now? */
export function sweepAllowed(s: { offscreen: boolean; scrolling: boolean; hidden: boolean; reduced: boolean; intro: boolean; running: number }): boolean {
  return !s.offscreen && !s.scrolling && !s.hidden && !s.reduced && !s.intro && s.running < GLOSS_SWEEP.maxConcurrent;
}

let running = 0;

/** Schedule the idle sweep on a headline root; returns the cancel. Client only. */
export function scheduleGlossSweep(el: HTMLElement): () => void {
  let sweeping = false;
  let endTimer: ReturnType<typeof setTimeout> | null = null;
  const stop = () => {
    if (endTimer) clearTimeout(endTimer);
    endTimer = null;
    if (sweeping) { sweeping = false; running = Math.max(0, running - 1); el.classList.remove('lh-sweeping'); }
  };
  const tick = () => {
    const html = document.documentElement;
    if (!sweeping && sweepAllowed({
      offscreen: el.getAttribute('data-offscreen') === 'true',
      scrolling: html.hasAttribute('data-scrolling'),
      hidden: document.visibilityState !== 'visible',
      reduced: prefersReducedMotion(),
      intro: html.hasAttribute(INTRO_RUNNING_ATTR),
      running,
    })) {
      sweeping = true;
      running += 1;
      el.classList.add('lh-sweeping');
      endTimer = setTimeout(stop, sweepRunMs(el.querySelectorAll('.lh-gloss').length) + 40);
    }
    timer = setTimeout(tick, GLOSS_SWEEP.everyMs);
  };
  let timer: ReturnType<typeof setTimeout> = setTimeout(tick, GLOSS_SWEEP.firstMs);
  return () => { clearTimeout(timer); stop(); };
}
