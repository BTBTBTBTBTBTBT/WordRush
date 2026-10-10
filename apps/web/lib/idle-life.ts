import type { CSSProperties } from 'react';

/**
 * Founder 10-10 (iOS IdleLife): the inline knobs for the `.idle-life` class in globals.css, a still mascot's gentle hop +
 * breathe and slower sway. `hop` px, `sway` degrees, `period` seconds per hop cycle (iOS defaults 3 / 1.5 / 2.2), `delay`
 * seconds before the loops begin (a beat after layout, as on iOS). Reduce Motion stops it in CSS.
 */
export function idleLifeStyle({ hop = 3, sway = 1.5, period = 2.2, delay = 0 }: { hop?: number; sway?: number; period?: number; delay?: number } = {}): CSSProperties {
  return {
    ['--il-hop' as string]: `${hop}px`,
    ['--il-sway' as string]: `${sway}deg`,
    ['--il-hopdur' as string]: `${(period / 2).toFixed(3)}s`,
    ['--il-swaydur' as string]: `${(period * 0.75).toFixed(3)}s`,
    ['--il-delay' as string]: `${(0.25 + delay).toFixed(2)}s`,
  };
}
