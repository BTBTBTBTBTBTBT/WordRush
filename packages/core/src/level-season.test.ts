import { describe, expect, it } from 'vitest';
import { SEASON_IDS, SEASON_WINDOWS, calendarSeason, currentSeason, levelTier, levelTierLabel, seasonReady } from './level-season';

describe('levelTier (FINISH_SPEC V)', () => {
  it('uses the Stats thresholds', () => {
    expect([0, 1, 10, 11, 25, 26, 50, 51, 99, 100, 250].map(levelTier)).toEqual([
      'bronze', 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold', 'platinum', 'platinum', 'diamond', 'diamond',
    ]);
    expect(levelTierLabel('platinum')).toBe('Platinum');
  });
});

describe('currentSeason (FINISH_SPEC X)', () => {
  it('is Halloween from Oct 9 through Oct 31, local date', () => {
    expect(currentSeason('2026-10-08')).toBeNull();
    expect(currentSeason('2026-10-09')).toBe('halloween');
    expect(currentSeason('2026-10-24')).toBe('halloween');
    expect(currentSeason('2026-10-31')).toBe('halloween');
    expect(currentSeason('2026-10-31')).toBe('halloween');
    expect(currentSeason('2026-11-01')).toBeNull();
    expect(currentSeason(new Date(2027, 9, 30, 23, 59))).toBe('halloween');
    expect(currentSeason(new Date(2027, 0, 1))).toBeNull();
  });
});

describe('Thanksgiving window (founder 10-16: Nov 14 – Nov 29) and the ready gate', () => {
  it('is the calendar season Nov 14 through Nov 29, local date; Halloween ends Oct 31', () => {
    expect(calendarSeason('2026-10-31')).toBe('halloween');
    expect(calendarSeason('2026-11-01')).toBeNull();
    expect(calendarSeason('2026-11-13')).toBeNull();
    expect(calendarSeason('2026-11-14')).toBe('thanksgiving');
    expect(calendarSeason('2026-11-26')).toBe('thanksgiving');
    expect(calendarSeason('2026-11-29')).toBe('thanksgiving');
    expect(calendarSeason('2026-11-30')).toBeNull();
    expect(calendarSeason(new Date(2027, 10, 14))).toBe('thanksgiving');
  });

  it('a not-ready season never activates for the public, on any day of its window', () => {
    const row = SEASON_WINDOWS.find((w) => w.id === 'thanksgiving')!;
    expect(row.ready).toBe(false);
    expect(seasonReady('thanksgiving')).toBe(false);
    expect(seasonReady('halloween')).toBe(true);
    expect(seasonReady('bogus')).toBe(false);
    for (const day of ['2026-11-14', '2026-11-20', '2026-11-26', '2026-11-29']) {
      expect(calendarSeason(day)).toBe('thanksgiving');
      expect(currentSeason(day), day).toBeNull();
    }
    // The ready season still switches on by the clock.
    expect(currentSeason('2026-10-31')).toBe('halloween');
    expect(currentSeason('2026-11-01')).toBeNull();
  });

  it('the admin preview can still pick it: every window is listed, ready or not', () => {
    expect(SEASON_IDS).toEqual(['halloween', 'thanksgiving']);
  });
});
