// Starsweep in the new look (docs/FINISH_SPEC.md H): the pure pieces the
// board draws from — the region tints (one clear hue per region, picked by
// regionColorSlots so touching regions read furthest apart), the cell state → candy piece mapping
// (art-starsweep-*), the region seams, and which motion a cell plays when its
// mark changes. No React here; tested in starsweep-look.test.ts.

import type { StarsweepPiece } from './art';
import { softMix } from './soft-surface';

/** One region's candy-tile colors: face, the lighter top of its gradient, the darker bottom lip, the region bed behind the tiles, and the saturated `deep` color the dark theme starts from. */
export interface RegionTint {
  name: string;
  face: string;
  top: string;
  lip: string;
  bed: string;
  deep: string;
}

/**
 * The light-theme tints, in pick order. Nine hues spread around the wheel (founder 10-12: two greens that touched were
 * hard to tell apart), ordered so the first 7 / 8 / 9 are each as far apart as the hues allow; a board's regions take
 * them through regionColorSlots (touching regions get the pair that reads furthest apart). Light: face = deep at 55% over
 * white. Dark: deep at 64% over the card base (darkTint), which is what the pairwise CIEDE2000 table in core is built on.
 */
export const STARSWEEP_TINTS: readonly RegionTint[] = [
  { name: 'violet', face: '#ae99d6', top: '#d7ccea', lip: '#8b7aab', bed: '#a08cc5', deep: '#6c45b4' },
  { name: 'orange', face: '#fac78d', top: '#fde3c6', lip: '#c89f71', bed: '#e6b782', deep: '#f69930' },
  { name: 'green', face: '#b6f5be', top: '#dbfade', lip: '#92c498', bed: '#a8e1ae', deep: '#7bec88' },
  { name: 'blue', face: '#92c6f9', top: '#c9e3fc', lip: '#759fc7', bed: '#86b6e5', deep: '#3998f4' },
  { name: 'yellow', face: '#fcf379', top: '#fdf9bc', lip: '#c9c261', bed: '#e8df70', deep: '#f9e90c' },
  { name: 'pink', face: '#ffc0df', top: '#ffdfef', lip: '#cc99b2', bed: '#ebb0cd', deep: '#ff8cc4' },
  { name: 'cyan', face: '#a5fbfe', top: '#d2fdfe', lip: '#84c8cb', bed: '#98e7ea', deep: '#5cf7fd' },
  { name: 'red', face: '#fe928e', top: '#fec8c7', lip: '#cb7472', bed: '#ea8683', deep: '#fd3832' },
  { name: 'slate', face: '#d8dbdf', top: '#ecedef', lip: '#adafb2', bed: '#c7cacd', deep: '#b9bec5' },
];

/** The dark theme's card base the dark tints are mixed toward ([data-theme="dark"] --color-card-base). */
export const STARSWEEP_DARK_BASE = '#252542';

/** The same tint on the dark theme: the deep color over the card base (iOS StarsweepTone, Android StarsweepPalette: top 78%, face 64%, lip 45%, bed 34%). */
export function darkTint(t: RegionTint): RegionTint {
  return {
    name: t.name,
    face: softMix(t.deep, 0.64, STARSWEEP_DARK_BASE),
    top: softMix(t.deep, 0.78, STARSWEEP_DARK_BASE),
    lip: softMix(t.deep, 0.45, STARSWEEP_DARK_BASE),
    bed: softMix(t.deep, 0.34, STARSWEEP_DARK_BASE),
    deep: t.deep,
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
