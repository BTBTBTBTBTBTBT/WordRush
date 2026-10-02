import { describe, expect, it } from 'vitest';
import { bestRecapLayout, recapCandidates, recapShape, recapTile } from './recap-fit';

// iPhone SE (375 × 667), Pro daily: the board room the R2 layout leaves.
const SE = { width: 351, height: 237 };

describe('recap fit', () => {
  it('QuadWord on the SE picks 1 × 4 for ≥ 14 px tiles (2 × 2 gives 10)', () => {
    const input = { ...SE, boards: 4, wordLength: 5, rows: 9 };
    expect(recapTile({ ...input, cols: 2 })).toBe(10);
    expect(bestRecapLayout(input, recapCandidates(4))).toEqual({ cols: 4, tile: 14 });
  });
  it('Deliverance keeps 2 × 2 (bigger tiles there)', () => {
    expect(bestRecapLayout({ ...SE, boards: 4, wordLength: 5, rows: 6 }, recapCandidates(4))).toEqual({ cols: 2, tile: 16 });
  });
  it('Succession picks 1 × 4', () => {
    expect(bestRecapLayout({ ...SE, boards: 4, wordLength: 5, rows: 10 }, recapCandidates(4))).toEqual({ cols: 4, tile: 14 });
  });
  it('OctoWord keeps 4 × 2', () => {
    expect(bestRecapLayout({ ...SE, boards: 8, wordLength: 5, rows: 13 }, recapCandidates(8)).cols).toBe(4);
  });
  it('caps the tile on tall phones and keeps the spec grid on ties', () => {
    expect(bestRecapLayout({ width: 1000, height: 2000, boards: 4, wordLength: 5, rows: 9 }, [2, 4])).toEqual({ cols: 2, tile: 26 });
  });
  it('never goes negative', () => {
    expect(recapTile({ width: 10, height: 10, boards: 4, wordLength: 5, rows: 9, cols: 2 })).toBe(0);
  });
});

describe('recap shape (FINISH_SPEC AT2)', () => {
  const b = (guesses: number, maxGuesses: number, solution = 'CRANE') => ({ solution, guesses: Array(guesses).fill('SLATE'), maxGuesses });

  it('draws every board at the largest board’s height, win or loss', () => {
    // Deliverance loss: a solved board (3 guesses) and lost boards (6) all get 6 rows.
    expect(recapShape([b(3, 6), b(6, 6), b(6, 6), b(2, 6)])).toEqual({ rows: 6, cols: 5 });
    // A board whose budget shrank (VS stage pressure) pads up to the tallest one.
    expect(recapShape([b(4, 5), b(7, 7), b(2, 6)])).toEqual({ rows: 7, cols: 5 });
  });

  it('never cuts off a board that ran past its budget, and sizes columns by the longest word', () => {
    expect(recapShape([b(8, 6), b(1, 6, 'ABCDEFG')])).toEqual({ rows: 8, cols: 7 });
    expect(recapShape([])).toEqual({ rows: 6, cols: 5 });
  });

  it('gives one tile size for the whole grid', () => {
    const shape = recapShape([b(3, 6), b(6, 9)]);
    const tile = recapTile({ ...SE, boards: 2, wordLength: shape.cols, rows: shape.rows, cols: 2 });
    expect(tile).toBeGreaterThan(0);
    expect(shape.rows).toBe(9);
  });
});
