// The one-screen finished screen's multi-board recap (docs/FINISH_SPEC.md
// R2): pick the mini-grid arrangement that gives the BIGGEST tiles in the room
// the header, strip and dock leave — e.g. QuadWord 2 × 2 vs 1 × 4, OctoWord
// 4 × 2 vs 2 × 4. Pure.

/** A finished mini board's chrome per axis: 2 px padding a side + the 1.5 px tray border a side (components/game/multi-board miniBoardFrame). */
export const RECAP_CHROME = 7;
/** The gap between mini boards (CompletedBoardsRecap gap-2). */
export const RECAP_GAP = 8;
/** The recap grid's top padding (pt-1). */
export const RECAP_TOP = 4;

export interface RecapFitInput {
  width: number;
  height: number;
  boards: number;
  /** Letters per board (columns of tiles). */
  wordLength: number;
  /** Rows per board. */
  rows: number;
  /** Board columns of the arrangement. */
  cols: number;
  /** Tile cap, so tall phones don't blow the boards up. */
  maxTile?: number;
}

/** The biggest whole-pixel tile for one arrangement (tiles are 1 px apart), or 0 when nothing fits. */
export function recapTile({ width, height, boards, wordLength, rows, cols, maxTile = 26 }: RecapFitInput): number {
  if (boards <= 0 || cols <= 0 || wordLength <= 0 || rows <= 0) return 0;
  const c = Math.min(cols, boards);
  const r = Math.ceil(boards / c);
  const byW = (width - (c - 1) * RECAP_GAP - c * (wordLength - 1 + RECAP_CHROME)) / (c * wordLength);
  const byH = (height - RECAP_TOP - (r - 1) * RECAP_GAP - r * (rows - 1 + RECAP_CHROME)) / (r * rows);
  return Math.max(0, Math.min(maxTile, Math.floor(Math.min(byW, byH))));
}

/** The arrangement (board columns) with the biggest tile; ties keep the earlier candidate (the spec's grid first). */
export function bestRecapLayout(input: Omit<RecapFitInput, 'cols'>, candidates: number[]): { cols: number; tile: number } {
  let best = { cols: candidates[0] ?? 1, tile: -1 };
  for (const cols of candidates) {
    const tile = recapTile({ ...input, cols });
    if (tile > best.tile) best = { cols, tile };
  }
  return { cols: best.cols, tile: Math.max(0, best.tile) };
}

/** The candidates by board count: 2 × 2 or 1 × 4 for up to four boards, 4 × 2 or 2 × 4 for eight. */
export function recapCandidates(boards: number): number[] {
  if (boards <= 1) return [1];
  if (boards <= 4) return [2, boards];
  return [4, 2];
}

/**
 * FINISH_SPEC AT2: every board of a multi-board recap draws at ONE tile size
 * and the SAME height, win or loss. The shared shape comes from the largest
 * board — the most rows (its row budget or, if longer, its guesses) by the
 * longest word — and shorter boards pad with empty rows, so an unsolved or
 * lost board is never bigger or smaller than a solved one.
 */
export function recapShape(boards: ReadonlyArray<{ solution: string; guesses: readonly string[]; maxGuesses: number }>): { rows: number; cols: number } {
  let rows = 0;
  let cols = 0;
  for (const b of boards) {
    rows = Math.max(rows, b.maxGuesses, b.guesses.length);
    cols = Math.max(cols, b.solution.length);
  }
  return { rows: rows || 6, cols: cols || 5 };
}
