import { describe, expect, it } from 'vitest';
import { streakWeek, streakWeekCount, WEEK_LETTERS } from './streak-week';

// FINISH_SPEC C5: the streak popup shows this week as seven day tiles, filled per day played.
// 2026-10-02 is a Friday.

describe('streak week', () => {
  it('is Monday first, seven days', () => {
    expect(WEEK_LETTERS.join('')).toBe('MTWTFSS');
    expect(streakWeek('2026-10-02', 3, true)).toHaveLength(7);
  });

  it('fills the run ending today when today is played', () => {
    expect(streakWeek('2026-10-02', 3, true)).toEqual([false, false, true, true, true, false, false]);
  });

  it('fills the run ending yesterday when today is not played yet', () => {
    expect(streakWeek('2026-10-02', 2, false)).toEqual([false, false, true, true, false, false, false]);
  });

  it('fills the whole week up to today for a long streak, never the future', () => {
    expect(streakWeek('2026-10-02', 82, true)).toEqual([true, true, true, true, true, false, false]);
    expect(streakWeek('2026-10-04', 82, true)).toEqual([true, true, true, true, true, true, true]);
    expect(streakWeekCount('2026-10-02', 82, true)).toBe(5);
  });

  it('handles Monday and an empty streak', () => {
    expect(streakWeek('2026-09-28', 1, true)).toEqual([true, false, false, false, false, false, false]);
    expect(streakWeek('2026-09-28', 5, false)).toEqual([false, false, false, false, false, false, false]);
    expect(streakWeek('2026-10-02', 0, true)).toEqual(Array(7).fill(false));
  });
});
