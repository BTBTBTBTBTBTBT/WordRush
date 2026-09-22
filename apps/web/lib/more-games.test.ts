import { describe, it, expect } from 'vitest';
import { moreSections, morePlayedCount, morePlayedText, moreDailyModes } from './more-games';
import { MODES, MORE_CATEGORIES, MORE_GAME_MODES, type ModeMeta } from './modes.generated';

// The catalog's More Games records regardless of their enabled flag — the
// sheet must be right the day the flags flip, not only today.
const ALL_MORE = MODES.filter((m) => m.group === 'more');

describe('More Games sheet helpers', () => {
  it('sections follow the catalog category order and drop empty ones', () => {
    const s = moreSections(ALL_MORE);
    expect(s.map((x) => x.key)).toEqual(MORE_CATEGORIES.map((c) => c.key));
    // Word 4 · Trivia 1 (ProperNoundle is still a core tile) · Logic 4.
    expect(s.map((x) => x.modes.length)).toEqual([4, 1, 4]);
    expect(s.find((x) => x.key === 'word')!.modes.map((m) => m.title)).toEqual(['Muddle', 'Hubbub', 'Letter Ladder', 'Spyglass']);
    expect(s.find((x) => x.key === 'logic')!.modes.map((m) => m.title)).toEqual(['Sudoku', 'Kindred', 'Codebreaker', 'Starsweep']);
  });

  it('an uncategorised mode lands in a trailing Other section instead of vanishing', () => {
    const stray: ModeMeta = { ...ALL_MORE[0], id: 'stray', dbKey: 'STRAY', category: null };
    const s = moreSections([...ALL_MORE, stray]);
    expect(s[s.length - 1]).toMatchObject({ key: 'other', title: 'Other' });
    expect(s[s.length - 1].modes.map((m) => m.id)).toEqual(['stray']);
  });

  it('the enabled set drives the sheet and the tile count (Sudoku and Starsweep are compiled in)', () => {
    expect(MORE_GAME_MODES.map((m) => m.id)).toEqual(['sudoku', 'regions']);
    expect(moreSections().map((s) => [s.key, s.modes.map((m) => m.id)])).toEqual([['logic', ['sudoku', 'regions']]]);
    expect(morePlayedCount(['DUEL', 'SUDOKU'])).toEqual({ played: 1, total: 2 });
    expect(morePlayedCount(['REGIONS', 'SUDOKU'])).toEqual({ played: 2, total: 2 });
    expect(morePlayedCount([])).toEqual({ played: 0, total: 2 });
  });

  it('counts only More Games dailies the player has recorded today', () => {
    expect(moreDailyModes(ALL_MORE).length).toBe(9);
    const c = morePlayedCount(['DUEL', 'SUDOKU', 'HUB', 'NOPE'], ALL_MORE);
    expect(c).toEqual({ played: 2, total: 9 });
    expect(morePlayedText(c.played, c.total)).toBe('2 of 9 played');
    expect(morePlayedText(0, 10)).toBe('0 of 10 played');
  });
});
