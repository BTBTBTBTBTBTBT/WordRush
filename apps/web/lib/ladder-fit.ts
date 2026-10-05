import { trayChrome } from './tray-fit';

// The live Letter Ladder's tile size (Doug, Android 10-05: a few rungs pushed the
// REACH row out of the board). Every rung, the typing row, the REACH label and the
// target fit the slot between the header and Undo / Hint; when even the smallest
// tile is too tall, only the climbed rungs scroll and the rest stays pinned.
// Twins: Android LadderFit (LadderScreen.kt), iOS LadderFit (LadderView.swift).

export const LADDER_TILE = { max: 52, min: 26 } as const;
/** The px between two tiles in a row (gap-1). */
const ROW_GAP = 4;

export interface LadderFit {
  /** Square tile edge (px). */
  tile: number;
  /** The px between rows. */
  gap: number;
  /** Too long even at the smallest tile: the climbed rungs scroll. */
  scrolls: boolean;
}

/**
 * The tile for `rungs` climbed words (START included) + the typing row (+ the
 * `labelLine`-px REACH label and the target when `showEnd`) in a tray filling at
 * most `availW` × `availH`, never above `maxTile`.
 */
export function ladderFit(availW: number, availH: number, rungs: number, showEnd: boolean, labelLine = 14, maxTile: number = LADDER_TILE.max): LadderFit {
  const chrome = trayChrome();
  const rows = rungs + 1 + (showEnd ? 1 : 0);
  const byW = (availW - 2 * chrome.x - ROW_GAP * 4) / 5;
  const cap = Math.max(LADDER_TILE.min, Math.min(maxTile, LADDER_TILE.max, byW));
  for (const [gap, floor] of [[6, 36], [4, LADDER_TILE.min]] as const) {
    const fixed = chrome.top + chrome.bottom + (showEnd ? labelLine + gap : 0);
    const t = Math.min(cap, (availH - fixed - gap * (rows - 1)) / rows);
    if (t >= floor) return { tile: Math.floor(t), gap, scrolls: false };
  }
  return { tile: LADDER_TILE.min, gap: 4, scrolls: true };
}
