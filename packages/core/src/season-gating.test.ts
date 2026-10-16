import { describe, expect, it } from 'vitest';
import { SEASON_IDS, SEASON_WINDOWS, calendarSeason, currentSeason, seasonReady } from './level-season';
import { mascotSeason } from './avatar-season';

// Every day of a leap year as YYYY-MM-DD (local calendar dates; the windows ignore the year).
const DAYS: string[] = [];
for (let m = 1; m <= 12; m++) {
  const n = new Date(2028, m, 0).getDate();
  for (let d = 1; d <= n; d++) DAYS.push(`2028-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
}
const between = (day: string, from: string, to: string) => day.slice(5) >= from && day.slice(5) <= to;

describe('season gating (10-16): a not-ready season never turns on for the public', () => {
  it('the public season is only Halloween, Oct 9 – Oct 31, on every day of the year', () => {
    for (const day of DAYS) {
      const want = between(day, '10-09', '10-31') ? 'halloween' : null;
      expect(currentSeason(day), day).toBe(want);
      expect(currentSeason(new Date(`${day}T12:00:00`)), day).toBe(want);
    }
  });

  it('Thanksgiving is on the calendar Nov 14 – Nov 29 but stays off for the public every one of those days', () => {
    const window = DAYS.filter((d) => between(d, '11-14', '11-29'));
    expect(window.length).toBe(16);
    for (const day of window) {
      expect(calendarSeason(day), day).toBe('thanksgiving');
      expect(currentSeason(day), day).toBeNull();
      expect(mascotSeason(day, null), day).toBeNull();
      expect(mascotSeason(day, undefined), day).toBeNull();
    }
    // the day before and after are no season at all
    expect(calendarSeason('2026-11-13')).toBeNull();
    expect(calendarSeason('2026-11-30')).toBeNull();
  });

  it('the admin preview switches Thanksgiving on any day (inside or outside its window) and "none" forces it off', () => {
    for (const day of ['2026-11-14', '2026-11-26', '2026-11-29', '2026-07-04', '2026-10-20']) {
      expect(mascotSeason(day, 'thanksgiving'), day).toBe('thanksgiving');
      expect(mascotSeason(day, 'none'), day).toBeNull();
    }
    expect(seasonReady('thanksgiving')).toBe(false);
    expect(SEASON_IDS).toContain('thanksgiving');
  });

  it('the Halloween window is unchanged: Oct 9 – Oct 31, ready, first in the registry', () => {
    expect(SEASON_WINDOWS[0]).toEqual({ id: 'halloween', start: [10, 9], end: [10, 31], ready: true });
    expect(currentSeason('2026-10-08')).toBeNull();
    expect(currentSeason('2026-10-09')).toBe('halloween');
    expect(currentSeason('2026-10-31')).toBe('halloween');
    expect(currentSeason('2026-11-01')).toBeNull();
    // no window overlaps another
    for (const day of DAYS) expect([calendarSeason(day)].filter(Boolean).length).toBeLessThanOrEqual(1);
  });
});
