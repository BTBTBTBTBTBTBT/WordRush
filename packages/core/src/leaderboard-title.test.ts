import { describe, expect, it } from 'vitest';
import { leaderboardTitle } from './leaderboard-title';

describe('leaderboard title', () => {
  it('one alliterative title per weekday, holidays first', () => {
    expect(leaderboardTitle('2026-10-01')).toBe('THURSDAY THUNDER');
    expect(leaderboardTitle('2026-10-02')).toBe('FRIDAY’S FINEST');
    expect(leaderboardTitle('2026-10-04')).toBe('SUNDAY SUPERSTARS');
    expect(leaderboardTitle('2026-10-05')).toBe('MONDAY MASTERS');
    expect(leaderboardTitle('2026-10-31', 'Halloween')).toBe('HALLOWEEN HEROES');
    expect(leaderboardTitle('2026-10-31', '  ')).toBe('SATURDAY STARS');
  });
});
