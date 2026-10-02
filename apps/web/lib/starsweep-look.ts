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
  { name: 'lilac', face: '#ead6ff', top: '#f6edff', lip: '#c3a1ec', bed: '#dcc2fa' },
  { name: 'peach', face: '#ffdcc4', top: '#ffeee2', lip: '#eab08c', bed: '#f9cbab' },
  { name: 'mint', face: '#c9f2dc', top: '#e4faee', lip: '#92d4b0', bed: '#b3e9cc' },
  { name: 'sky', face: '#cfe6ff', top: '#e7f3ff', lip: '#98c0ec', bed: '#b9d8fb' },
  { name: 'butter', face: '#fff0b0', top: '#fff8d8', lip: '#e3c96a', bed: '#fbe591' },
  { name: 'pink', face: '#ffd3e8', top: '#ffe9f3', lip: '#eba0c3', bed: '#fbbfdb' },
  { name: 'aqua', face: '#c4f1f1', top: '#e2f9f9', lip: '#86d0d0', bed: '#a9e7e7' },
  { name: 'coral', face: '#ffc9c2', top: '#ffe4e0', lip: '#ec9c91', bed: '#fbb2a8' },
  { name: 'lavender', face: '#d9dcfb', top: '#eceefe', lip: '#a5aae6', bed: '#c6cbf6' },
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
