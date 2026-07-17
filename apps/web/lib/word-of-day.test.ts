import { describe, it, expect } from 'vitest';
import { daysSinceEpoch, dateKey, parseDateKey, recentDates } from './word-of-day';

/**
 * Guards the Word-of-the-Day LOCAL-day contract. This module briefly indexed
 * by raw-UTC timestamps while the home card (app/page.tsx) indexed by local
 * calendar day, so the archive's "today" ran a day ahead of the home card
 * every local evening.
 */

/** The home card's formula, verbatim from app/page.tsx — the source of truth. */
function homeCardIndex(now: Date): number {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

describe('word-of-day local-day contract', () => {
  it('daysSinceEpoch matches the home card formula at any time of day', () => {
    for (const d of [
      new Date(2026, 6, 16, 0, 0, 1),   // just past local midnight
      new Date(2026, 6, 16, 12, 0, 0),
      new Date(2026, 6, 16, 23, 59, 59), // local evening — the old UTC bug window
    ]) {
      expect(daysSinceEpoch(d)).toBe(homeCardIndex(d));
    }
  });

  it('dateKey/parseDateKey round-trip, and the parsed date indexes the same day', () => {
    for (const key of ['2026-07-16', '2026-01-01', '2025-12-31', '2026-03-08', '2026-11-01']) {
      const parsed = parseDateKey(key)!;
      expect(parsed).not.toBeNull();
      expect(dateKey(parsed)).toBe(key);
      expect(daysSinceEpoch(parsed)).toBe(homeCardIndex(parsed));
    }
  });

  it('rejects malformed keys', () => {
    for (const bad of ['2026-7-16', '20260716', 'not-a-date', '2026-13-40']) {
      // 2026-13-40 parses shape-wise but rolls over; dateKey(parse) must not equal it.
      const parsed = parseDateKey(bad);
      if (parsed) expect(dateKey(parsed)).not.toBe(bad);
    }
    expect(parseDateKey('nope')).toBeNull();
  });

  it('recentDates is consecutive calendar days across DST boundaries', () => {
    // US DST ends 2026-11-01 and starts 2026-03-08; span both.
    for (const anchor of [new Date(2026, 10, 3), new Date(2026, 2, 10)]) {
      const dates = recentDates(7, anchor);
      expect(dates).toHaveLength(7);
      for (let i = 1; i < dates.length; i++) {
        expect(daysSinceEpoch(dates[i - 1]) - daysSinceEpoch(dates[i])).toBe(1);
      }
      expect(dateKey(dates[0])).toBe(dateKey(anchor));
    }
  });
});
