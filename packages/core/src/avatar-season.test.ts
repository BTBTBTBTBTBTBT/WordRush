import { describe, expect, it } from 'vitest';
import { AVATAR_MANIFEST } from './avatar-layout';
import { AVATAR_HEADS, AVATAR_HELD, AVATAR_NECKS, AVATAR_PETS, AVATAR_WRAPS, validateAvatar, defaultAvatar } from './avatar-config';
import { SEASON_IDS } from './level-season';
import { avatarPartSeason, isPartAvailable, mascotSeason, seasonNudgeDue, seasonNudgeKey, seasonTag, seasonalShelf, wearsSeasonalPart } from './avatar-season';

const pumpkin = { field: 'head', id: 'pumpkinhat' };

describe('seasonal mascot items (10-05)', () => {
  it('the Halloween shelf: hats first, every part a shipped seasonal item in a catalog', () => {
    const shelf = seasonalShelf('halloween');
    expect(shelf.map((p) => p.id)).toEqual(['pumpkinhat', 'candycornhat', 'witchnight', 'batears', 'batwings', 'cattail', 'vampirecollar', 'candypail', 'bat', 'ghost', 'blackcat']);
    for (const p of shelf) expect(AVATAR_MANIFEST.items[`acc:${p.id}`]?.season).toBe('halloween');
  });

  it('every manifest season is a real season window, and every seasonal item sits in a catalog', () => {
    const all = [...AVATAR_HEADS, ...AVATAR_NECKS, ...AVATAR_WRAPS, ...AVATAR_HELD, ...AVATAR_PETS] as readonly string[];
    for (const [key, item] of Object.entries(AVATAR_MANIFEST.items)) {
      if (!item.season) continue;
      expect(SEASON_IDS as readonly string[]).toContain(item.season);
      expect(all).toContain(key.split(':')[1]);
    }
  });

  it('shows in its window (local dates, inclusive), hides outside it', () => {
    expect(isPartAvailable(pumpkin, '2026-10-08', null, null)).toBe(false);
    expect(isPartAvailable(pumpkin, '2026-10-09', null, null)).toBe(true);
    expect(isPartAvailable(pumpkin, '2026-10-31', null, null)).toBe(true);
    expect(isPartAvailable(pumpkin, '2026-11-01', null, null)).toBe(false);
  });

  it('the admin preview turns it on (or off) whatever the date', () => {
    expect(isPartAvailable(pumpkin, '2026-03-01', 'halloween', null)).toBe(true);
    expect(isPartAvailable(pumpkin, '2026-10-24', 'none', null)).toBe(false);
    expect(mascotSeason('2026-10-24', null)).toBe('halloween');
    expect(mascotSeason('2026-10-24', 'none')).toBeNull();
  });

  it('a saved seasonal part stays (never strip a look); everyday parts are always available', () => {
    expect(isPartAvailable(pumpkin, '2027-03-01', null, { head: 'pumpkinhat' })).toBe(true);
    expect(isPartAvailable(pumpkin, '2027-03-01', null, { head: 'witch' })).toBe(false);
    expect(isPartAvailable({ field: 'head', id: 'witch' }, '2027-03-01', null, null)).toBe(true);
    expect(validateAvatar({ head: 'pumpkinhat', pet: 'ghost' }, defaultAvatar('x')).head).toBe('pumpkinhat');
    expect(avatarPartSeason('head', 'none')).toBeNull();
  });

  it('the Home nudge: once per season per year, never for a player already wearing the season', () => {
    expect(seasonNudgeDue('2026-10-20', null, { head: 'none' }, [])).toBe('halloween');
    expect(seasonNudgeDue('2026-10-20', null, { head: 'none' }, ['halloween-2026'])).toBeNull();
    expect(seasonNudgeDue('2027-10-20', null, { head: 'none' }, ['halloween-2026'])).toBe('halloween');
    expect(seasonNudgeDue('2026-10-20', null, { neck: 'batwings' }, [])).toBeNull();
    expect(seasonNudgeDue('2026-12-01', null, null, [])).toBeNull();
    expect(wearsSeasonalPart({ pet: 'kitten' })).toBe(false);
    expect(seasonNudgeKey('halloween', '2026-10-20')).toBe('halloween-2026');
    expect(seasonTag('winter-holidays')).toBe('WINTER HOLIDAYS');
  });
});
