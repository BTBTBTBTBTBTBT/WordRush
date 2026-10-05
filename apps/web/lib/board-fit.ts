// One board-sizing rule for every game (docs/FINISH_SPEC.md B5): the board
// fills the space between the title / status line and the keyboard — as wide
// as the screen allows (a small side margin) and centered in the height that
// is left; multi-board games size their whole grid the same way. Pure math
// here (tested in board-fit.test.ts); hooks/use-board-fit.ts measures the
// area and calls it.

/** The shared defaults. */
export const BOARD_FIT = {
  /** Side margin each side (px): "a small side margin". */
  side: 8,
  /** Gap between tiles (px) on a single board (the mockup's 5 px). */
  gap: 5,
  /** Largest tile on a single board (px), so a desktop window doesn't balloon. */
  maxTile: 72,
  /** Smallest usable tile (px); below it there is no fit. */
  minTile: 8,
  /** Multi-board: gap between boards, a board's padding + border (both sides), tile gap, tile cap. */
  boardGap: 8,
  boardPad: 12,
  boardTileGap: 2,
  boardMaxTile: 56,
} as const;

export interface SingleFitInput {
  /** The measured area (px). */
  width: number;
  height: number;
  /** Tiles across / rows down. */
  cols: number;
  rows: number;
  gap?: number;
  side?: number;
  /** Vertical breathing room kept free (px, total). */
  vPad?: number;
  maxTile?: number;
  /** Widest the whole board may draw (px). */
  maxWidth?: number;
  /** Extra px across a row beyond the tile gaps (e.g. ProperNoundle's wider gaps between words). */
  extraWidth?: number;
}

export interface SingleFit {
  /** Square tile edge (px). */
  tile: number;
  /** The board's outer size (px). */
  w: number;
  h: number;
  /** Gap used between tiles (px). */
  gap: number;
}

/**
 * The biggest square tile that lets a cols × rows board fit the area in both
 * dimensions (side margins and `vPad` kept free), capped at `maxTile`; null
 * when even the smallest tile doesn't fit (not measured yet).
 */
export function fitBoard({
  width, height, cols, rows, gap = BOARD_FIT.gap, side = BOARD_FIT.side, vPad = 0, maxTile = BOARD_FIT.maxTile, maxWidth, extraWidth = 0,
}: SingleFitInput): SingleFit | null {
  if (!(width > 0) || !(height > 0) || cols < 1 || rows < 1) return null;
  const availW = Math.min(width - 2 * side, maxWidth ?? Infinity) - extraWidth;
  const availH = height - vPad;
  const byW = (availW - (cols - 1) * gap) / cols;
  const byH = (availH - (rows - 1) * gap) / rows;
  const tile = Math.floor(Math.min(byW, byH, maxTile));
  if (tile < BOARD_FIT.minTile) return null;
  return { tile, w: tile * cols + gap * (cols - 1) + extraWidth, h: tile * rows + gap * (rows - 1), gap };
}

/**
 * Width-bound boards (ProperNoundle's long answers: ten tiles across a phone) used to leave
 * the spare HEIGHT as dead bands above and below (founder, 2026-10-05: "always fix empty
 * space issues"). Given the tile WIDTH the row allows, spend that height: tiles grow taller
 * (up to `maxRatio` × the width), then the row gaps grow (up to `maxGapRatio` × the tile
 * height). Height-bound boards stay square. Mirrors iOS BoardSizing.fillRows and Android
 * BoardSizing.fillRows.
 */
export function fillRows({ tileWidth, height, rows, gap, maxRatio = 1.5, maxGapRatio = 0.7 }: {
  tileWidth: number; height: number; rows: number; gap: number; maxRatio?: number; maxGapRatio?: number;
}): { tileWidth: number; tileHeight: number; rowGap: number } {
  const r = Math.max(1, rows);
  if (!(height > 0)) return { tileWidth, tileHeight: tileWidth, rowGap: gap };
  const byH = (height - (r - 1) * gap) / r;
  if (byH <= tileWidth) { const t = Math.max(1, Math.floor(byH)); return { tileWidth: t, tileHeight: t, rowGap: gap }; }
  const tileHeight = Math.floor(Math.min(tileWidth * maxRatio, byH));
  const spare = r > 1 ? (height - r * tileHeight) / (r - 1) : gap;
  const rowGap = Math.floor(Math.min(Math.max(gap, spare), Math.max(gap, tileHeight * maxGapRatio)));
  return { tileWidth, tileHeight, rowGap };
}

export interface GridFitInput {
  width: number;
  height: number;
  /** How many boards. */
  boards: number;
  /** Tiles across one board. */
  cols?: number;
  /** Rows on the tallest board. */
  rows: number;
  /** Non-tile px under each board's grid (e.g. a solution line). */
  extraBoardHeight?: number;
  /** Boards-per-row arrangements to try (default 2, 4 and all in a row). */
  perRow?: number[];
  side?: number;
  boardGap?: number;
  boardPad?: number;
  tileGap?: number;
  maxTile?: number;
}

export interface GridFit {
  /** Square tile edge (px). */
  tile: number;
  /** Boards per row in the arrangement that gave the biggest tile. */
  cols: number;
  /** Outer width of one board (tiles + tile gaps + padding/border) in px. */
  boardW: number;
}

/**
 * Multi-board games (QuadWord, OctoWord, Deliverance, Succession, Gauntlet's
 * stages): one square tile for every board, trying each arrangement and
 * keeping the one with the LARGEST tile (4 × 1 on a wide window, 2 × 2 on a
 * phone, OctoWord 4 × 2), capped so a desktop doesn't balloon.
 */
export function fitBoardGrid({
  width, height, boards, cols = 5, rows, extraBoardHeight = 0, perRow, side = 0,
  boardGap = BOARD_FIT.boardGap, boardPad = BOARD_FIT.boardPad, tileGap = BOARD_FIT.boardTileGap, maxTile = BOARD_FIT.boardMaxTile,
}: GridFitInput): GridFit | null {
  if (!(width > 0) || !(height > 0)) return null;
  const n = Math.max(1, boards);
  const tries = [...new Set((perRow ?? [2, 4, n]).filter((c) => c >= 1 && c <= n))];
  const availW = width - 2 * side;
  let best: GridFit | null = null;
  for (const c of tries) {
    const lines = Math.ceil(n / c);
    const byW = ((availW - (c - 1) * boardGap) / c - boardPad - (cols - 1) * tileGap) / cols;
    const byH = ((height - (lines - 1) * boardGap) / lines - boardPad - extraBoardHeight - (rows - 1) * tileGap) / rows;
    const t = Math.floor(Math.min(byW, byH, maxTile));
    if (t >= 10 && (!best || t > best.tile)) best = { tile: t, cols: c, boardW: t * cols + (cols - 1) * tileGap + boardPad };
  }
  return best;
}

/**
 * Crosswordocious in play (FINISH_SPEC BI18; founder 10-03: "the daily today
 * required you to scroll"): the grid's cell from the band left between the
 * compact header and the pinned clue bar / controls / keyboard, by width AND
 * height for the puzzle's real cols × rows (10 × 11 grids are common). 3 px
 * gaps, 12 px sides, 8 px of air, the tray chrome off first; 42 px cap and a
 * 14 px floor (letters and numbers scale with it) — iOS CrosswordFit / Android
 * BoardSizing.crosswordCell use the same numbers.
 */
export const CROSSWORD_FIT = { gap: 3, side: 12, vPad: 8, maxCell: 42, minCell: 14 } as const;

export function crosswordCell(width: number, height: number, cols: number, rows: number, chrome: { x: number; y: number }): number {
  const { gap, side, vPad, maxCell, minCell } = CROSSWORD_FIT;
  const fit = fitBoard({ width: width - chrome.x, height: height - chrome.y, cols, rows, gap, side, vPad, maxTile: maxCell });
  return Math.max(minCell, fit?.tile ?? minCell);
}

/** A crossword cell's letter / clue-number size (px): unchanged on big cells, never unreadable on small ones. */
export function crosswordCellFonts(cell: number): { letter: number; number: number } {
  return {
    letter: Math.max(Math.round(cell * 0.46), Math.min(11, Math.round(cell * 0.56))),
    // Doug 10-05: a ~27% superscript inside the corner (Android/iOS CrosswordCellSpec); the letter steps clear in CSS.
    number: Math.max(5, Math.round(cell * 0.27)),
  };
}

/** A tile's glyph size (px) on the shared tile: 58% of the tile, like the mockup's 58cqi. */
export function tileFontPx(tile: number): number {
  return Math.max(8, Math.round(tile * 0.58));
}
