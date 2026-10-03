// Starsweep in the new look (docs/FINISH_SPEC.md H): the pure pieces the
// board draws from — the region pastels (one friendly hue per region, a
// deterministic pick by region index), the cell state → candy piece mapping
// (art-starsweep-*), the region seams, and which motion a cell plays when its
// mark changes. No React here; tested in starsweep-look.test.ts.

import type { StarsweepPiece } from './art';
import { softMix } from './soft-surface';

/** One region's candy-tile colors: face, the lighter top of its gradient, the darker bottom lip, and the region bed behind the tiles. */
export interface RegionTint {
  name: string;
  face: string;
  top: string;
  lip: string;
  bed: string;
}

/** The light-theme pastels, in pick order (lilac and lavender only meet on a 9 × 9 board). */
export const STARSWEEP_TINTS: readonly RegionTint[] = [
  { name: 'lilac', face: '#c7a8ff', top: '#e3d3ff', lip: '#9a72e6', bed: '#b58ffa' },
  { name: 'peach', face: '#ffb98a', top: '#ffd9bf', lip: '#e08a52', bed: '#fba673' },
  { name: 'mint', face: '#8ee6b4', top: '#c2f3d6', lip: '#4fbf86', bed: '#72daa0' },
  { name: 'sky', face: '#9ccbff', top: '#cde4ff', lip: '#5e9be6', bed: '#82bafb' },
  { name: 'butter', face: '#ffdd66', top: '#ffeeaa', lip: '#d9ae2a', bed: '#fbd04a' },
  { name: 'pink', face: '#ffa6cf', top: '#ffd0e6', lip: '#e06fa3', bed: '#fb8ebf' },
  { name: 'aqua', face: '#84e3dc', top: '#bdf1ed', lip: '#3fbdb3', bed: '#66d7cd' },
  { name: 'coral', face: '#ffa096', top: '#ffcdc7', lip: '#e66a5d', bed: '#fb8a7e' },
  { name: 'lavender', face: '#b4b9ff', top: '#d8dbff', lip: '#7c83e6', bed: '#9ba1fa' },
];

/** The dark theme's card base the dark pastels are mixed toward ([data-theme="dark"] --color-card-base). */
export const STARSWEEP_DARK_BASE = '#252542';

/** The same pastel, deeper and dimmer for the dark theme (still clearly that hue, never white). */
export function darkTint(t: RegionTint): RegionTint {
  return {
    name: t.name,
    face: softMix(t.face, 0.7, STARSWEEP_DARK_BASE),
    top: softMix(t.top, 0.74, STARSWEEP_DARK_BASE),
    lip: softMix(t.lip, 0.55, STARSWEEP_DARK_BASE),
    bed: softMix(t.bed, 0.5, STARSWEEP_DARK_BASE),
  };
}

/** Region `index`'s pastel (deterministic; wraps past nine). */
export function regionTint(index: number, dark = false): RegionTint {
  const n = STARSWEEP_TINTS.length;
  const t = STARSWEEP_TINTS[((Math.trunc(index) % n) + n) % n];
  return dark ? darkTint(t) : t;
}

/** A cell's mark as the core reducer stores it ('.' empty, 'x' crossed, 'o' a black unjudged star, '*' a played star). */
export type StarsweepMark = '.' | 'x' | 'o' | '*' | string;

export interface StarsweepCellLook {
  /** The candy piece drawn in the cell, or null for an empty cell. */
  piece: StarsweepPiece | null;
  /** A solution star shown after a loss (faded). */
  muted: boolean;
}

/**
 * The piece for a cell, straight from the core state (no rule changes):
 * a black (placed, unjudged) star → star-placed; a played star → star-correct,
 * or star-wrong when it is in the wrong mask; a hint star is a correct star;
 * a cross → cross; an empty cell that holds a solution star after a loss →
 * a faded star-correct.
 */
export function starsweepCellLook(mark: StarsweepMark, wrong: boolean, missing = false): StarsweepCellLook {
  if (mark === '*') return { piece: wrong ? 'star-wrong' : 'star-correct', muted: false };
  if (mark === 'o') return { piece: 'star-placed', muted: false };
  if (mark === 'x') return { piece: 'cross', muted: false };
  if (missing) return { piece: 'star-correct', muted: true };
  return { piece: null, muted: false };
}

/** The motion a cell plays when its mark changes (B3): place = the type pop; play = flip + purple / red glow; hint = flip + gold glow. */
export type StarsweepMotion = 'pop' | 'right' | 'wrong' | 'hint';

/** The marks the motion diff reads. */
export interface StarsweepMarks {
  board: string;
  wrongMask: string;
  hintMask: string;
}

/** What cell `i` plays going from `prev` to `next` (null = nothing new to show). */
export function starsweepMotion(prev: StarsweepMarks, next: StarsweepMarks, i: number): StarsweepMotion | null {
  const a = prev.board[i];
  const b = next.board[i];
  if (b === '*') {
    if (a === '*' && prev.wrongMask[i] === next.wrongMask[i] && prev.hintMask[i] === next.hintMask[i]) return null;
    if (next.hintMask[i] === '1') return 'hint';
    return next.wrongMask[i] === '1' ? 'wrong' : 'right';
  }
  if ((b === 'o' || b === 'x') && a !== b) return 'pop';
  return null;
}

/** Every cell whose mark changed: [cell, motion | null] (null = changed but plays nothing, e.g. cleared). Empty when the boards differ in size. */
export function starsweepChanges(prev: StarsweepMarks, next: StarsweepMarks): Array<[number, StarsweepMotion | null]> {
  const out: Array<[number, StarsweepMotion | null]> = [];
  if (prev.board.length !== next.board.length) return out;
  for (let i = 0; i < next.board.length; i++) {
    if (prev.board[i] === next.board[i] && prev.wrongMask[i] === next.wrongMask[i] && prev.hintMask[i] === next.hintMask[i]) continue;
    out.push([i, starsweepMotion(prev, next, i)]);
  }
  return out;
}

/** Which sides of cell `i` sit on a region seam (or the board edge). */
export interface CellSeams {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

/** The region seams around cell `i` of an n × n board (`regions` is one digit char per cell). */
export function cellSeams(n: number, regions: string, i: number): CellSeams {
  const r = Math.floor(i / n);
  const c = i % n;
  const g = regions[i];
  return {
    top: r === 0 || regions[i - n] !== g,
    right: c === n - 1 || regions[i + 1] !== g,
    bottom: r === n - 1 || regions[i + n] !== g,
    left: c === 0 || regions[i - 1] !== g,
  };
}

/** The piece's share of the cell (H: ~78%). */
export const STARSWEEP_PIECE_SCALE = 0.78;
