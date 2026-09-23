import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  initDictionary, initDictionaryForLength, getSolutionPoolForDate,
  getSolutionPoolForLengthAndDate, _setTodayForTests, isValidWord,
} from './dictionary';
import { generateSolutionsFromSeed, generateSolutionsFromSeedForLength } from './seed';
import {
  SOLUTION_SWAPS, SOLUTION_SWAP_CUTOVER_DATE, applySolutionSwaps,
  SOLUTION_SWAPS_2, SOLUTION_SWAP_2_CUTOVER_DATE, applyAllSolutionSwaps,
} from './solution-swaps';

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

// Batch 2 (profanity — FUCKER, BLOWJOB…) has its OWN later cutover because
// store builds carrying batch 1 are already out. Between the two dates only
// batch 1 applies; from the second date on, batch 1 then batch 2. The Swift
// (SolutionSwapTests) and Kotlin (SolutionSwapTest) suites assert the same
// table and the same pinned deals.
describe('solution swaps batch 2 (profanity, own later cutover, real lists)', () => {
  const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
  const J = (f: string): string[] => JSON.parse(readFileSync(join(D, f), 'utf-8'));
  const up = (ws: string[]) => ws.map((w) => w.toUpperCase());
  const pools: Record<number, string[]> = { 5: J('solutions.json'), 6: J('solutions-6.json'), 7: J('solutions-7.json') };
  const legacy: Record<number, string[]> = { 5: J('solutions-legacy.json'), 6: J('solutions-6-legacy.json'), 7: J('solutions-7-legacy.json') };
  const allowed: Record<number, string[]> = { 5: J('allowed.json'), 6: J('allowed-6.json'), 7: J('allowed-7.json') };
  const DAY_BEFORE_2 = '2026-11-15';
  const poolFor = (len: number, date: string | null) => (len === 5 ? getSolutionPoolForDate(date) : getSolutionPoolForLengthAndDate(len, date));

  beforeAll(() => {
    initDictionary(allowed[5], pools[5], legacy[5]);
    initDictionaryForLength(6, allowed[6], pools[6], legacy[6]);
    initDictionaryForLength(7, allowed[7], pools[7], legacy[7]);
    _setTodayForTests('2026-09-01');
  });
  afterAll(() => { _setTodayForTests(null); });

  it('the second cutover is the day after DAY_BEFORE_2 and later than the first', () => {
    expect(SOLUTION_SWAP_2_CUTOVER_DATE).toBe('2026-11-16');
    expect(SOLUTION_SWAP_2_CUTOVER_DATE > SOLUTION_SWAP_CUTOVER_DATE).toBe(true);
  });

  it('batch 1 never grows (builds carrying it are in the stores)', () => {
    expect(Object.keys(SOLUTION_SWAPS)).toHaveLength(23);
  });

  it('every batch-2 swap is same-length, leaves the current pool, and enters it exactly once', () => {
    expect(Object.keys(SOLUTION_SWAPS_2)).toHaveLength(13);
    const batch1Replacements = new Set(Object.values(SOLUTION_SWAPS));
    for (const [oldW, newW] of Object.entries(SOLUTION_SWAPS_2)) {
      const len = oldW.length;
      expect(newW.length, `${oldW}→${newW}`).toBe(len);
      expect(up(pools[len]), oldW).toContain(oldW);
      expect(up(pools[len]), `${newW} must not already be an answer`).not.toContain(newW);
      expect(up(legacy[len]), `${newW} must not be a legacy answer either`).not.toContain(newW);
      expect(up(allowed[len]), `${newW} must be guessable`).toContain(newW);
      expect(batch1Replacements.has(newW), `${newW} is already a batch-1 replacement`).toBe(false);
      expect(SOLUTION_SWAPS[oldW], `${oldW} is in both batches`).toBeUndefined();
    }
    expect(new Set(Object.values(SOLUTION_SWAPS_2)).size).toBe(13);
  });

  it('between the two cutovers only batch 1 applies (batch-2 words still dealt)', () => {
    for (const len of [5, 6, 7]) expect(poolFor(len, DAY_BEFORE_2)).toEqual(applySolutionSwaps(up(pools[len])));
    expect(poolFor(6, DAY_BEFORE_2)).toContain('FUCKER');
    expect(poolFor(7, DAY_BEFORE_2)).toContain('BLOWJOB');
    expect(poolFor(6, DAY_BEFORE_2)).not.toContain('CASHEW');
  });

  it('from the second cutover on, both batches hold in place and nothing else moves', () => {
    const bothOld = [...Object.keys(SOLUTION_SWAPS), ...Object.keys(SOLUTION_SWAPS_2)];
    for (const len of [5, 6, 7]) {
      const before = up(pools[len]);
      const after = poolFor(len, SOLUTION_SWAP_2_CUTOVER_DATE);
      expect(after).toHaveLength(before.length);
      expect(after).toEqual(applyAllSolutionSwaps(before));
      for (const oldW of bothOld) expect(after).not.toContain(oldW);
      const moved = before.filter((w, i) => w !== after[i]);
      expect(moved.sort()).toEqual(bothOld.filter((w) => w.length === len).sort());
    }
  });

  it('undated seeds gate on wall-clock UTC', () => {
    _setTodayForTests(DAY_BEFORE_2);
    expect(getSolutionPoolForLengthAndDate(6, null)).toContain('FUCKER');
    _setTodayForTests(SOLUTION_SWAP_2_CUTOVER_DATE);
    expect(getSolutionPoolForLengthAndDate(6, null)).not.toContain('FUCKER');
    expect(getSolutionPoolForLengthAndDate(6, null)).toContain('CASHEW');
    expect(getSolutionPoolForLengthAndDate(7, null)).toContain('APRICOT');
    _setTodayForTests('2026-09-01');
  });

  it('swapped-out words stay valid guesses', () => {
    for (const w of Object.keys(SOLUTION_SWAPS_2)) expect(isValidWord(w), w).toBe(true);
  });

  it('pinned deals around the second cutover (the natives assert the same three)', () => {
    // Between the cutovers: the original still deals.
    expect(generateSolutionsFromSeedForLength('daily-2026-10-28-DUEL_7', 8, 7))
      .toEqual(['PRESSED', 'DENOTED', 'PALETTE', 'FAILING', 'LUNATIC', 'BREEDER', 'WAITING', 'VAGINAL']);
    // From the second cutover on: the replacement deals at the same slot.
    expect(generateSolutionsFromSeedForLength('daily-2026-11-27-DUEL_6', 8, 6))
      .toEqual(['JAGGED', 'OPENER', 'FESTER', 'QUARTZ', 'MARVEL', 'SALUTE', 'FONDUE', 'ONWARD']);
    expect(generateSolutionsFromSeedForLength('daily-2027-02-23-DUEL_7', 1, 7)).toEqual(['CROWBAR']);
  });
});
