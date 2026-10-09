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
  SOLUTION_SWAPS_3, SOLUTION_SWAP_3_CUTOVER_DATE, applySolutionSwapBatches, solutionSwapBatchesFor,
  SOLUTION_SWAPS_4, SOLUTION_SWAP_4_CUTOVER_DATE, applySolutionSwaps4, ALL_SOLUTION_SWAP_BATCHES,
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

  it('between the two cutovers batch 2 is not live yet (batch-2 words still dealt; batches 1 and 4 are)', () => {
    for (const len of [5, 6, 7]) expect(poolFor(len, DAY_BEFORE_2)).toEqual(applySolutionSwapBatches(up(pools[len]), 1 | 8));
    expect(poolFor(6, DAY_BEFORE_2)).toContain('FUCKER');
    expect(poolFor(7, DAY_BEFORE_2)).toContain('BLOWJOB');
    expect(poolFor(6, DAY_BEFORE_2)).not.toContain('CASHEW');
  });

  it('from the second cutover on, both batches hold in place and nothing else moves', () => {
    // Batch 4 started earlier (2026-10-13), so its words have already moved.
    const bothOld = [...Object.keys(SOLUTION_SWAPS), ...Object.keys(SOLUTION_SWAPS_2), ...Object.keys(SOLUTION_SWAPS_4)];
    // Batch 3 may share this date; when it does, its words move too.
    const sameDay3 = SOLUTION_SWAP_3_CUTOVER_DATE === SOLUTION_SWAP_2_CUTOVER_DATE;
    for (const len of [5, 6, 7]) {
      const before = up(pools[len]);
      const after = poolFor(len, SOLUTION_SWAP_2_CUTOVER_DATE);
      expect(after).toHaveLength(before.length);
      expect(after).toEqual(applySolutionSwapBatches(before, sameDay3 ? 15 : 11));
      for (const oldW of bothOld) expect(after).not.toContain(oldW);
      const moved = before.filter((w, i) => w !== after[i]);
      const expected = [...bothOld, ...(sameDay3 ? Object.keys(SOLUTION_SWAPS_3) : [])].filter((w) => before.includes(w));
      expect(moved.sort()).toEqual(expected.filter((w) => w.length === len).sort());
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
    // Between the cutovers: the batch-2 original still deals (V******); LUNATIC's slot
    // already holds batch 4's DIEHARD (batch 4 starts 2026-10-13).
    expect(generateSolutionsFromSeedForLength('daily-2026-10-28-DUEL_7', 8, 7))
      .toEqual(['PRESSED', 'DENOTED', 'PALETTE', 'FAILING', 'DIEHARD', 'BREEDER', 'WAITING', atob('VkFHSU5BTA==')]);
    // From the second cutover on: the replacement deals at the same slot.
    expect(generateSolutionsFromSeedForLength('daily-2026-11-27-DUEL_6', 8, 6))
      .toEqual(['JAGGED', 'OPENER', 'FESTER', 'QUARTZ', 'MARVEL', 'SALUTE', 'FONDUE', 'ONWARD']);
    expect(generateSolutionsFromSeedForLength('daily-2027-02-23-DUEL_7', 1, 7)).toEqual(['CROWBAR']);
  });
});

// Batch 3 (British answers — COLOUR, THEATRE, YOGHURT, BLOKE…, plus batch 2's
// CRUMPET) has its own table applied AFTER batch 2 and its own cutover
// constant. The Swift (SolutionSwapTests) and Kotlin (SolutionSwapTest) suites
// assert the same table and the same pinned deals.
describe('solution swaps batch 3 (British answers, applied after batch 2, real lists)', () => {
  const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
  const J = (f: string): string[] => JSON.parse(readFileSync(join(D, f), 'utf-8'));
  const up = (ws: string[]) => ws.map((w) => w.toUpperCase());
  const pools: Record<number, string[]> = { 5: up(J('solutions.json')), 6: up(J('solutions-6.json')), 7: up(J('solutions-7.json')) };
  const legacy: Record<number, string[]> = { 5: J('solutions-legacy.json'), 6: J('solutions-6-legacy.json'), 7: J('solutions-7-legacy.json') };
  const allowed: Record<number, string[]> = { 5: J('allowed.json'), 6: J('allowed-6.json'), 7: J('allowed-7.json') };
  const DAY_BEFORE_3 = '2026-11-15';
  const poolFor = (len: number, date: string | null) => (len === 5 ? getSolutionPoolForDate(date) : getSolutionPoolForLengthAndDate(len, date));

  beforeAll(() => {
    initDictionary(allowed[5], J('solutions.json'), legacy[5]);
    initDictionaryForLength(6, allowed[6], J('solutions-6.json'), legacy[6]);
    initDictionaryForLength(7, allowed[7], J('solutions-7.json'), legacy[7]);
    _setTodayForTests('2026-09-01');
  });
  afterAll(() => { _setTodayForTests(null); });

  it('cutover: not before batch 2, after the 10-09 release; batches 1 and 2 never grow', () => {
    expect(SOLUTION_SWAP_3_CUTOVER_DATE).toBe('2026-11-16');
    expect(SOLUTION_SWAP_3_CUTOVER_DATE >= SOLUTION_SWAP_2_CUTOVER_DATE).toBe(true);
    expect(Object.keys(SOLUTION_SWAPS)).toHaveLength(23);
    expect(Object.keys(SOLUTION_SWAPS_2)).toHaveLength(13);
    expect(solutionSwapBatchesFor('2026-10-04')).toBe(0);
    expect(solutionSwapBatchesFor('2026-10-05')).toBe(1);
    expect(solutionSwapBatchesFor(DAY_BEFORE_3)).toBe(1 | 8);
    expect(solutionSwapBatchesFor(SOLUTION_SWAP_3_CUTOVER_DATE)).toBe(ALL_SOLUTION_SWAP_BATCHES);
  });

  it('every batch-3 swap is same-length, leaves the pool as dealt after batch 2, and enters it exactly once', () => {
    expect(Object.keys(SOLUTION_SWAPS_3)).toHaveLength(46);
    expect(SOLUTION_SWAPS_3.COLOUR).toBe('SORBET');
    expect(SOLUTION_SWAPS_3.CRUMPET).toBe('WALLABY');
    const earlier = new Set([...Object.values(SOLUTION_SWAPS), ...Object.values(SOLUTION_SWAPS_2)]);
    for (const [oldW, newW] of Object.entries(SOLUTION_SWAPS_3)) {
      const len = oldW.length;
      const dealt = applySolutionSwapBatches(pools[len], 1 | 2);
      expect(newW.length, `${oldW}→${newW}`).toBe(len);
      expect(dealt, oldW).toContain(oldW);
      expect(dealt, `${newW} must not already be an answer`).not.toContain(newW);
      expect(up(allowed[len]), `${newW} must be guessable`).toContain(newW);
      expect(earlier.has(newW), `${newW} is already a batch-1/2 replacement`).toBe(false);
      expect(Object.keys(SOLUTION_SWAPS).includes(oldW) || Object.keys(SOLUTION_SWAPS_2).includes(oldW), `${oldW} is an earlier batch's key`).toBe(false);
    }
    expect(new Set(Object.values(SOLUTION_SWAPS_3)).size).toBe(46);
  });

  it('the day before: batch-3 words still deal; from the cutover all three batches hold in place', () => {
    expect(poolFor(6, DAY_BEFORE_3)).toContain('COLOUR');
    expect(poolFor(7, DAY_BEFORE_3)).toContain('THEATRE');
    const allOld = [...Object.keys(SOLUTION_SWAPS), ...Object.keys(SOLUTION_SWAPS_2), ...Object.keys(SOLUTION_SWAPS_3), ...Object.keys(SOLUTION_SWAPS_4)];
    for (const len of [5, 6, 7]) {
      const after = poolFor(len, SOLUTION_SWAP_3_CUTOVER_DATE);
      expect(after).toEqual(applyAllSolutionSwaps(pools[len]));
      expect(after).toHaveLength(pools[len].length);
      for (const oldW of allOld) expect(after, oldW).not.toContain(oldW);
      const moved = pools[len].filter((w, i) => w !== after[i]);
      expect(moved.sort()).toEqual(allOld.filter((w) => w.length === len && pools[len].includes(w)).sort());
    }
  });

  it('undated seeds gate on wall-clock UTC', () => {
    _setTodayForTests(DAY_BEFORE_3);
    expect(getSolutionPoolForDate(null)).toContain('BLOKE');
    _setTodayForTests(SOLUTION_SWAP_3_CUTOVER_DATE);
    expect(getSolutionPoolForDate(null)).not.toContain('BLOKE');
    expect(getSolutionPoolForDate(null)).toContain('LLAMA');
    expect(getSolutionPoolForLengthAndDate(7, null)).toContain('WALLABY');
    expect(getSolutionPoolForLengthAndDate(7, null)).not.toContain('CRUMPET');
    _setTodayForTests('2026-09-01');
  });

  it('swapped-out words stay valid guesses', () => {
    for (const w of Object.keys(SOLUTION_SWAPS_3)) expect(isValidWord(w), w).toBe(true);
  });

  it('pinned deals around the third cutover (the natives assert the same three)', () => {
    expect(generateSolutionsFromSeed('daily-2026-10-15-DUEL', 8))
      .toEqual(['ADORE', 'LITRE', 'RIDGE', 'CUMIN', 'ETHIC', 'VALID', 'THICK', 'STORY']);
    expect(generateSolutionsFromSeedForLength('daily-2026-11-16-DUEL_7', 8, 7))
      .toEqual(['OVARIAN', 'DEFLECT', 'IGNORED', 'ALGEBRA', 'MARACAS', 'CLIPPER', 'LAUGHED', 'EMPATHY']);
    expect(generateSolutionsFromSeedForLength('daily-2027-01-22-DUEL_6', 8, 6))
      .toEqual(['FILMED', 'SMILED', 'WIGGLE', 'OPENLY', 'SITTER', 'SORBET', 'SPRITE', 'SUNSET']);
  });
});

// Batch 4 (content audit 2026-10-06: profanity, slurs, sexual/drug words, political and
// brand names, proper nouns, British and obscure answers) has its own table and the
// EARLIEST pending cutover: it starts on 2026-10-13, before batches 2–3, which is why
// solutionSwapBatchesFor returns a bitmask. Its keys are original pool words, so it is
// independent of batches 2–3. The Swift (SolutionSwapTests) and Kotlin
// (SolutionSwapTest) suites assert the same table size and the same pinned deals.
describe('solution swaps batch 4 (content audit, earliest cutover, real lists)', () => {
  const D = join(__dirname, '..', '..', '..', 'apps', 'web', 'data');
  const J = (f: string): string[] => JSON.parse(readFileSync(join(D, f), 'utf-8'));
  const up = (ws: string[]) => ws.map((w) => w.toUpperCase());
  const pools: Record<number, string[]> = { 5: up(J('solutions.json')), 6: up(J('solutions-6.json')), 7: up(J('solutions-7.json')) };
  const legacy: Record<number, string[]> = { 5: up(J('solutions-legacy.json')), 6: up(J('solutions-6-legacy.json')), 7: up(J('solutions-7-legacy.json')) };
  const allowed: Record<number, string[]> = { 5: up(J('allowed.json')), 6: up(J('allowed-6.json')), 7: up(J('allowed-7.json')) };
  const DAY_BEFORE_4 = '2026-10-12';
  const poolFor = (len: number, date: string | null) => (len === 5 ? getSolutionPoolForDate(date) : getSolutionPoolForLengthAndDate(len, date));

  beforeAll(() => {
    initDictionary(allowed[5], J('solutions.json'), J('solutions-legacy.json'));
    initDictionaryForLength(6, allowed[6], J('solutions-6.json'), J('solutions-6-legacy.json'));
    initDictionaryForLength(7, allowed[7], J('solutions-7.json'), J('solutions-7-legacy.json'));
    _setTodayForTests('2026-09-01');
  });
  afterAll(() => { _setTodayForTests(null); });

  it('cutover: after the 2026-10-12 builds, before batches 2–3; earlier batches never grow', () => {
    expect(SOLUTION_SWAP_4_CUTOVER_DATE).toBe('2026-10-13');
    expect(SOLUTION_SWAP_4_CUTOVER_DATE > SOLUTION_SWAP_CUTOVER_DATE).toBe(true);
    expect(SOLUTION_SWAP_4_CUTOVER_DATE < SOLUTION_SWAP_2_CUTOVER_DATE).toBe(true);
    expect(Object.keys(SOLUTION_SWAPS)).toHaveLength(23);
    expect(Object.keys(SOLUTION_SWAPS_2)).toHaveLength(13);
    expect(Object.keys(SOLUTION_SWAPS_3)).toHaveLength(46);
    expect(solutionSwapBatchesFor(DAY_BEFORE_4)).toBe(1);
    expect(solutionSwapBatchesFor(SOLUTION_SWAP_4_CUTOVER_DATE)).toBe(1 | 8);
    expect(solutionSwapBatchesFor('2026-11-16')).toBe(ALL_SOLUTION_SWAP_BATCHES);
  });

  it('every batch-4 swap is same-length, keys an ORIGINAL pool word, and enters the pool exactly once', () => {
    expect(Object.keys(SOLUTION_SWAPS_4)).toHaveLength(283);
    expect(SOLUTION_SWAPS_4.TOGGLE).toBe('BEANIE');
    expect(SOLUTION_SWAPS_4.LATINO).toBe('SUITOR');
    const earlier = [SOLUTION_SWAPS, SOLUTION_SWAPS_2, SOLUTION_SWAPS_3];
    const earlierKeys = new Set(earlier.flatMap((t) => Object.keys(t)));
    const earlierVals = new Set(earlier.flatMap((t) => Object.values(t)));
    for (const [oldW, newW] of Object.entries(SOLUTION_SWAPS_4)) {
      const len = oldW.length;
      expect(newW.length, `${oldW}→${newW}`).toBe(len);
      expect(pools[len].filter((w) => w === oldW), oldW).toHaveLength(1);
      expect(earlierKeys.has(oldW) || earlierVals.has(oldW), `${oldW} belongs to an earlier batch`).toBe(false);
      expect(applyAllSolutionSwaps(pools[len]).filter((w) => w === newW), `${newW} must deal at exactly one index`).toHaveLength(1);
      expect(pools[len], `${newW} must not be in the raw pool`).not.toContain(newW);
      expect(legacy[len], `${newW} must not be a legacy answer`).not.toContain(newW);
      expect(allowed[len], `${newW} must be guessable`).toContain(newW);
      expect(earlierKeys.has(newW) || earlierVals.has(newW), `${newW} belongs to an earlier batch`).toBe(false);
    }
    expect(new Set(Object.values(SOLUTION_SWAPS_4)).size).toBe(283);
  });

  it('the day before: only batch 1; from the cutover batches 1 + 4 hold in place and nothing else moves', () => {
    expect(poolFor(6, DAY_BEFORE_4)).toContain('TOGGLE');
    expect(poolFor(5, DAY_BEFORE_4)).toContain('DUCHY');
    for (const len of [5, 6, 7]) {
      expect(poolFor(len, DAY_BEFORE_4)).toEqual(applySolutionSwaps(pools[len]));
      const after = poolFor(len, SOLUTION_SWAP_4_CUTOVER_DATE);
      expect(after).toEqual(applySolutionSwaps4(applySolutionSwaps(pools[len])));
      expect(after).toHaveLength(pools[len].length);
      const old = [...Object.keys(SOLUTION_SWAPS), ...Object.keys(SOLUTION_SWAPS_4)].filter((w) => w.length === len);
      for (const w of old) expect(after, w).not.toContain(w);
      const moved = pools[len].filter((w, i) => w !== after[i]);
      expect(moved.sort()).toEqual(old.filter((w) => pools[len].includes(w)).sort());
    }
    // Batch-2/3 words still deal until their own cutover.
    expect(poolFor(6, SOLUTION_SWAP_4_CUTOVER_DATE)).toContain('COLOUR');
  });

  it('undated seeds gate on wall-clock UTC', () => {
    _setTodayForTests(DAY_BEFORE_4);
    expect(getSolutionPoolForLengthAndDate(6, null)).toContain('TOGGLE');
    _setTodayForTests(SOLUTION_SWAP_4_CUTOVER_DATE);
    expect(getSolutionPoolForLengthAndDate(6, null)).not.toContain('TOGGLE');
    expect(getSolutionPoolForLengthAndDate(6, null)).toContain('BEANIE');
    expect(getSolutionPoolForDate(null)).not.toContain('DUCHY');
    _setTodayForTests('2026-09-01');
  });

  it('swapped-out words stay valid guesses', () => {
    for (const w of Object.keys(SOLUTION_SWAPS_4)) expect(isValidWord(w), w).toBe(true);
  });

  it('pinned deals around the fourth cutover (the natives assert the same three)', () => {
    // The day before: AMINO (→ WISPY) still deals in that day's Gauntlet.
    expect(generateSolutionsFromSeed('daily-2026-10-12-GAUNTLET', 21).slice(9, 13)).toEqual(['NURSE', 'LOCAL', 'AMINO', 'AGENT']);
    // From the cutover: LATINO's slot deals SUITOR; an offensive key's slot (base64 in the table) deals PHASE.
    expect(generateSolutionsFromSeedForLength('daily-2026-10-14-DUEL_6', 1, 6)).toEqual(['SUITOR']);
    expect(generateSolutionsFromSeed('daily-2026-11-03-GAUNTLET', 21).slice(14, 18)).toEqual(['SLANG', 'TRICK', 'PHASE', 'TORSO']);
  });
});
