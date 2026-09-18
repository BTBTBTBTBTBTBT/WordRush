import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  initDictionary, initDictionaryForLength, getSolutionPoolForDate,
  getSolutionPoolForLengthAndDate, _setTodayForTests, isValidWord,
} from './dictionary';
import { generateSolutionsFromSeed } from './seed';
import { SOLUTION_SWAPS, SOLUTION_SWAP_CUTOVER_DATE, applySolutionSwaps } from './solution-swaps';

// §265: proper-noun-reading answers are swapped IN PLACE from a dated cutover.
// The Swift (SolutionSwapTests) and Kotlin (SolutionSwapTest) suites assert the
// same table and the same pinned deals.
describe('solution swaps (§265, real lists)', () => {
  const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
  const J = (f: string): string[] => JSON.parse(readFileSync(join(D, f), 'utf-8'));
  const pools: Record<number, string[]> = { 5: J('solutions.json'), 6: J('solutions-6.json'), 7: J('solutions-7.json') };
  const allowed: Record<number, string[]> = { 5: J('allowed.json'), 6: J('allowed-6.json'), 7: J('allowed-7.json') };
  const DAY_BEFORE = '2026-10-04';

  beforeAll(() => {
    initDictionary(allowed[5], pools[5], J('solutions-legacy.json'));
    initDictionaryForLength(6, allowed[6], pools[6], J('solutions-6-legacy.json'));
    initDictionaryForLength(7, allowed[7], pools[7], J('solutions-7-legacy.json'));
    _setTodayForTests('2026-09-01');
  });
  afterAll(() => { _setTodayForTests(null); });

  it('the cutover is the day after DAY_BEFORE', () => {
    expect(SOLUTION_SWAP_CUTOVER_DATE).toBe('2026-10-05');
  });

  it('every swap is same-length, leaves the pool, and enters it exactly once', () => {
    expect(Object.keys(SOLUTION_SWAPS)).toHaveLength(23);
    for (const [oldW, newW] of Object.entries(SOLUTION_SWAPS)) {
      const pool = pools[oldW.length].map((w) => w.toUpperCase());
      expect(newW.length, `${oldW}→${newW}`).toBe(oldW.length);
      expect(pool, oldW).toContain(oldW);
      expect(pool, `${newW} must not already be an answer`).not.toContain(newW);
      expect(allowed[newW.length].map((w) => w.toUpperCase()), `${newW} must be guessable`).toContain(newW);
    }
    expect(new Set(Object.values(SOLUTION_SWAPS)).size).toBe(23);
  });

  it('before the cutover the pools are untouched (history never moves)', () => {
    expect(getSolutionPoolForDate(DAY_BEFORE)).toEqual(pools[5].map((w) => w.toUpperCase()));
    expect(getSolutionPoolForLengthAndDate(6, DAY_BEFORE)).toEqual(pools[6].map((w) => w.toUpperCase()));
    expect(getSolutionPoolForLengthAndDate(7, DAY_BEFORE)).toEqual(pools[7].map((w) => w.toUpperCase()));
  });

  it('from the cutover on, each swapped index holds its replacement and nothing else moves', () => {
    for (const len of [5, 6, 7]) {
      const before = pools[len].map((w) => w.toUpperCase());
      const after = len === 5 ? getSolutionPoolForDate(SOLUTION_SWAP_CUTOVER_DATE) : getSolutionPoolForLengthAndDate(len, SOLUTION_SWAP_CUTOVER_DATE);
      expect(after).toHaveLength(before.length);
      expect(after).toEqual(applySolutionSwaps(before));
      for (const oldW of Object.keys(SOLUTION_SWAPS)) expect(after).not.toContain(oldW);
      const moved = before.filter((w, i) => w !== after[i]);
      expect(moved.sort()).toEqual(Object.keys(SOLUTION_SWAPS).filter((w) => w.length === len).sort());
    }
  });

  it('undated seeds gate on wall-clock UTC', () => {
    _setTodayForTests(DAY_BEFORE);
    expect(getSolutionPoolForDate(null)).toContain('JAPAN');
    _setTodayForTests(SOLUTION_SWAP_CUTOVER_DATE);
    expect(getSolutionPoolForDate(null)).not.toContain('JAPAN');
    expect(getSolutionPoolForDate(null)).toContain('ALOOF');
    _setTodayForTests('2026-09-01');
  });

  it('swapped-out words stay valid guesses', () => {
    for (const w of ['JAPAN', 'ASPEN', 'CHINA']) expect(isValidWord(w)).toBe(true);
  });

  it('pinned post-cutover deals (the natives assert the same two)', () => {
    expect(generateSolutionsFromSeed('daily-2026-10-07-SEQUENCE', 4)).toEqual(['SLUSH', 'WHOSE', 'RULER', 'HORSE']);
    expect(generateSolutionsFromSeed('daily-2026-10-06-GAUNTLET', 21).slice(0, 3)).toEqual(['VOWEL', 'DUVET', 'TENTH']);
  });
});
