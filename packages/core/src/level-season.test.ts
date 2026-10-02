import { describe, expect, it } from 'vitest';
import { currentSeason, levelTier, levelTierLabel } from './level-season';

describe('levelTier (FINISH_SPEC V)', () => {
  it('uses the Stats thresholds', () => {
    expect([0, 1, 10, 11, 25, 26, 50, 51, 99, 100, 250].map(levelTier)).toEqual([
      'bronze', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'diamond', 'diamond',
    ]);
    expect(levelTierLabel('platinum')).toBe('Platinum');
  });
});

describe('currentSeason (FINISH_SPEC X)', () => {
  it('is Halloween from Oct 24 through Nov 1, local date', () => {
    expect(currentSeason('2026-10-23')).toBeNull();
    expect(currentSeason('2026-10-24')).toBe('halloween');
    expect(currentSeason('2026-10-31')).toBe('halloween');
    expect(currentSeason('2026-11-01')).toBe('halloween');
    expect(currentSeason('2026-11-02')).toBeNull();
    expect(currentSeason(new Date(2027, 9, 30, 23, 59))).toBe('halloween');
    expect(currentSeason(new Date(2027, 0, 1))).toBeNull();
  });
});
