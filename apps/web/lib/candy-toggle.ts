import type { CSSProperties } from 'react';
import { ART_SIZE } from './art';

/**
 * The candy toggles (night art 10-03 sprites, "Small menus with flair" proposals 1 + 3; founder
 * 10-03): glossy candy segmented toggles and the short on/off switch, drawn from
 * `art-toggle-{light,dark}-{track,thumb-on,switch,switch-on,knob}`. Pills are THREE-SLICED (the
 * round end caps keep their shape, only the middle stretches), so one sprite fits any width.
 * Light/dark pick their sprites through the --candy-* CSS variables in globals.css. Only the
 * thumb / knob moves (transform). Mirrors iOS CandyToggleKit + Android CandyToggle.kt.
 */

/** A 3-sliced sprite as a background: the cap is half the sprite's height (a pill's round end). */
export function threeSlice(sprite: 'track' | 'thumb-on' | 'switch' | 'switch-on', height: number, cssVar: string): CSSProperties {
  const [, h] = ART_SIZE[`art-toggle-light-${sprite}`];
  const cap = Math.round(h / 2);
  const end = height / 2;
  return {
    boxSizing: 'border-box',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderWidth: `0 ${end}px`,
    borderImageSource: `var(${cssVar})`,
    borderImageSlice: `0 ${cap} fill`,
    borderImageWidth: `0 ${end}px`,
    borderImageRepeat: 'stretch',
  };
}

/** The groove inset of the track sprite: the thumb sits this far inside the track's rim. */
export function candyPad(height: number): number {
  return Math.max(2, Math.round(height * 0.12));
}

/** Label inks: white on the glossy purple thumb, the deep purple (light) / lilac (dark) off it. */
export const CANDY_INK = { on: '#ffffff', off: 'var(--candy-ink-off, #6d28d9)' } as const;

/** The short on/off switch (proposal 3): 52 × 30, a pearl knob that springs across. */
export const CANDY_SWITCH = { width: 52, height: 30 } as const;
