import { describe, expect, it } from 'vitest';
import { SEASON_IDS } from '@wordle-duel/core';
import { parseSeasonParam, parseStoredSeason, resolveSeason } from './season';

// Web mapping of the 10-16 ready gate: Thanksgiving (not ready) never resolves by date, only through the admin preview.
describe('season gating on the web (10-16)', () => {
  const window = Array.from({ length: 16 }, (_, i) => `2026-11-${String(14 + i).padStart(2, '0')}`);

  it('by date, every Nov 14 – 29 is no season for the public', () => {
    for (const day of window) expect(resolveSeason(day, null), day).toBeNull();
    expect(resolveSeason('2026-11-13', null)).toBeNull();
    expect(resolveSeason('2026-11-30', null)).toBeNull();
  });

  it('the admin preview resolves it on any day, and "none" wins over the Halloween calendar', () => {
    for (const day of [...window, '2026-03-01', '2026-10-20']) expect(resolveSeason(day, 'thanksgiving'), day).toBe('thanksgiving');
    expect(resolveSeason('2026-10-20', 'none')).toBeNull();
    expect(resolveSeason('2026-10-20', 'halloween')).toBe('halloween');
  });

  it('the ?season= query and the stored preview accept every registry id (ready or not), nothing else', () => {
    for (const id of SEASON_IDS) {
      expect(parseSeasonParam(`?season=${id}`)).toBe(id);
      expect(parseSeasonParam(`?season=${id.toUpperCase()}`)).toBe(id);
      expect(parseStoredSeason(id)).toBe(id);
    }
    expect(parseSeasonParam('?season=thanksgiving')).toBe('thanksgiving');
    expect(parseSeasonParam('?season=christmas')).toBeNull();
    expect(parseStoredSeason('christmas')).toBeNull();
    expect(parseStoredSeason('none')).toBe('none');
    expect(parseSeasonParam('?season=auto')).toBe('auto');
  });

  it('Halloween by date is unchanged: Oct 9 – Oct 31', () => {
    expect(resolveSeason('2026-10-08', null)).toBeNull();
    expect(resolveSeason('2026-10-09', null)).toBe('halloween');
    expect(resolveSeason('2026-10-31', null)).toBe('halloween');
    expect(resolveSeason('2026-11-01', null)).toBeNull();
  });
});
