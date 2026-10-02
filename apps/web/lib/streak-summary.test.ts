import { describe, expect, it } from 'vitest';
import { EMPTY_STREAK_SUMMARY, flawlessRows, sweepRows } from './streak-summary';

describe('streak popup rows (FINISH_SPEC AS7)', () => {
  it('hides a flawless row only when that streak has never happened', () => {
    expect(flawlessRows(EMPTY_STREAK_SUMMARY)).toEqual([]);
    const rows = flawlessRows({ ...EMPTY_STREAK_SUMMARY, wordFlawless: { current: 0, best: 3 }, puzzleFlawless: { current: 0, best: 0 } });
    expect(rows).toEqual([{ key: 'word', label: 'Wordocious', current: 0, best: 3 }]);
  });

  it('shows a live flawless run even with no recorded best, and best never reads below current', () => {
    const rows = flawlessRows({ ...EMPTY_STREAK_SUMMARY, wordFlawless: { current: 2, best: 1 }, puzzleFlawless: { current: 4, best: null } });
    expect(rows.map((r) => [r.key, r.current, r.best])).toEqual([['word', 2, 2], ['puzzles', 4, 4]]);
  });

  it('always lists both sweep streaks; best only when tracked', () => {
    const rows = sweepRows({ ...EMPTY_STREAK_SUMMARY, wordSweep: { current: 5, best: null }, puzzleSweep: { current: 1, best: 0 } });
    expect(rows).toEqual([
      { key: 'word', label: 'Wordocious', current: 5, best: null },
      { key: 'puzzles', label: 'Puzzles', current: 1, best: 1 },
    ]);
  });
});
