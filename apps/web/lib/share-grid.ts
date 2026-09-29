import { evaluateGuess, type BoardState } from '@wordle-duel/core';
import { MODES } from './modes.generated';
import type { ShareMode } from './share-image';

// Small, render-free share helpers split out of share-image.ts (founder,
// 2026-09-29): games build their grids with these at play time and load the
// canvas renderer only when Share is tapped.

/**
 * Uppercase tile-state string. Classic/Quordle/etc. produce these directly
 * from the core reducer; ProperNoundle uses lowercase internally and
 * normalizes to this set at the share-image boundary.
 */
export type TileStateString = 'CORRECT' | 'PRESENT' | 'ABSENT' | 'EMPTY';

/**
 * Short per-mode glyph drawn inside the accent badge on the all-dailies share
 * card — derived from the single-source mode catalog (modes.json → modes.generated).
 * Keyed by ShareMode (== catalog title); kept identical on iOS + Android.
 */
export const MODE_SHARE_GLYPH: Record<ShareMode, string> = Object.fromEntries(
  MODES.filter((m) => m.dbKey && m.glyph).map((m) => [m.title, m.glyph as string]),
) as Record<ShareMode, string>;

/**
 * Evaluate every row of a BoardState into tile-state grids. Prefilled
 * guesses (Deliverance) appear first, followed by the player's guesses.
 * Empty rows are padded with EMPTY so every board in a multi-board share
 * has the same total row count the player saw in-app — specifically
 * `prefilledGuesses.length + maxGuesses`, since `maxGuesses` is the player
 * guess budget *excluding* prefills (see reducer.ts where the LOST check
 * uses `newGuesses.length >= board.maxGuesses`). Without including the
 * prefill count in the pad target, Deliverance boards would render at
 * different heights depending on how far each player got, and downstream
 * drawBoardCard would size tiles differently per board — the "funky sizes"
 * bug the share image had.
 */
export function boardToGrid(board: BoardState): TileStateString[][] {
  const width = board.solution.length;
  const rows: TileStateString[][] = [];
  const prefillCount = board.prefilledGuesses?.length ?? 0;

  if (board.prefilledGuesses?.length) {
    for (const p of board.prefilledGuesses) {
      rows.push(p.evaluation.tiles.map(t => t.state as TileStateString));
    }
  }
  for (const guess of board.guesses) {
    const ev = evaluateGuess(board.solution, guess);
    rows.push(ev.tiles.map(t => t.state as TileStateString));
  }
  const totalRows = prefillCount + board.maxGuesses;
  while (rows.length < totalRows) {
    rows.push(Array(width).fill('EMPTY'));
  }
  return rows;
}

/**
 * Letter grid matching boardToGrid row-for-row — same prefill-first order and
 * the same pad target, with '' for empty tiles so drawTile draws no glyph.
 * Only consumed by the "Full results" (reveal) share variant.
 */
export function boardToLetters(board: BoardState): string[][] {
  const width = board.solution.length;
  const rows: string[][] = [];
  const prefillCount = board.prefilledGuesses?.length ?? 0;

  if (board.prefilledGuesses?.length) {
    for (const p of board.prefilledGuesses) {
      rows.push(p.evaluation.tiles.map(t => (t.letter ?? '').toUpperCase()));
    }
  }
  for (const guess of board.guesses) {
    rows.push(guess.toUpperCase().split(''));
  }
  const totalRows = prefillCount + board.maxGuesses;
  while (rows.length < totalRows) {
    rows.push(Array(width).fill(''));
  }
  return rows;
}
