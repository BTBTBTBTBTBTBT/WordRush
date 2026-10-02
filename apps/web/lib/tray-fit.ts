import { MODE_BY_DBKEY } from './modes.generated';
import { TRAY, type TrayState } from './game-tray';
import { BRAND_ACCENT } from './soft-surface';

// Fitting a board INSIDE its game tray (docs/FINISH_SPEC.md L + B5). The B5
// fit (lib/board-fit.ts) hands a board an exact outer box; the tray's chrome
// (padding + border, plus the 4 px lip at the bottom) has to come out of that
// box, and the tiles stay square — so the grid is re-fitted to the inner box
// and the tray hugs it, centered. Pure; tested in tray-fit.test.ts.

/** The px a tray adds around its content on each side. */
export interface TrayChrome {
  x: number;
  top: number;
  bottom: number;
}

/** A tray's chrome for a padding and border (lib/game-tray.ts gameTrayStyle: the lip adds to the bottom padding). */
export function trayChrome(padding: number = TRAY.padding, border = 1.5): TrayChrome {
  return { x: padding + border, top: padding + border, bottom: padding + TRAY.lip + border };
}

export interface TrayGridFit {
  /** Square tile edge (px). */
  tile: number;
  /** The grid's size inside the tray (px). */
  w: number;
  h: number;
}

/**
 * The biggest square tile for a cols × rows grid (tiles `gap` apart) inside a
 * tray whose OUTER box is `outer`; null when nothing usable fits. `extraWidth`
 * = px across a row beyond the tile gaps (ProperNoundle's word gaps).
 */
export function fitGridInTray(
  outer: { w: number; h: number },
  cols: number,
  rows: number,
  gap: number,
  chrome: TrayChrome = trayChrome(),
  extraWidth = 0,
): TrayGridFit | null {
  if (!(outer.w > 0) || !(outer.h > 0) || cols < 1 || rows < 1) return null;
  const innerW = outer.w - 2 * chrome.x - extraWidth;
  const innerH = outer.h - chrome.top - chrome.bottom;
  const byW = (innerW - gap * (cols - 1)) / cols;
  const byH = (innerH - gap * (rows - 1)) / rows;
  const tile = Math.floor(Math.min(byW, byH) * 100) / 100;
  if (!(tile >= 4)) return null;
  return { tile, w: tile * cols + gap * (cols - 1) + extraWidth, h: tile * rows + gap * (rows - 1) };
}

/** A board status (BoardState.status 'WON' | 'LOST' | 'PLAYING', or lower case) as the tray's state. */
export function trayStateFor(status: string | null | undefined): TrayState {
  const s = (status ?? '').toUpperCase();
  return s === 'WON' ? 'won' : s === 'LOST' ? 'lost' : 'playing';
}

/** A game's tray accent: its catalog accent, the brand purple when unknown. */
export function modeTrayAccent(dbKey: string | null | undefined): string {
  return (dbKey && MODE_BY_DBKEY[dbKey]?.accentHex) || BRAND_ACCENT;
}

/**
 * Mini boards (QuadWord / OctoWord / Deliverance / Gauntlet stages, the
 * completed mini boards): a compact tray whose chrome fits the multi-board
 * fit's `boardPad` (12 px across both sides) — 4 px padding + the border, and
 * the lip drawn over the bottom padding instead of adding to it.
 */
export const MINI_TRAY = { padding: 4, radius: 12 } as const;
