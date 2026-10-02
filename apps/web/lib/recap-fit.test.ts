import { describe, expect, it } from 'vitest';
import { bestRecapLayout, recapCandidates, recapTile } from './recap-fit';

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
