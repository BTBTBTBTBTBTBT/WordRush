import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateSolutionsFromSeed, generateSolutionsFromSeedForLength } from './seed';
import { initDictionary, initDictionaryForLength } from './dictionary';

// ── Pin tests: the REAL solutions bank must keep producing the SAME words for
// pre-cutover daily seeds through the solutions-curation change (date-gated
// dual list). These literals were captured from the pre-curation list on
// 2026-07-06; after the legacy pin + curated swap they MUST stay identical
// (a pre-cutover date resolves against the byte-exact legacy list).
describe('solutions bank — pre-cutover pin (real list)', () => {
  const dataDir = join(__dirname, '../../../apps/web/data');
  const legacy: string[] = JSON.parse(readFileSync(join(dataDir, 'solutions-legacy.json'), 'utf-8'));
  const allowed: string[] = JSON.parse(readFileSync(join(dataDir, 'allowed.json'), 'utf-8'));

  beforeAll(() => {
    // Pre-cutover seeds resolve against the legacy (3rd arg) list. The 2nd arg
    // (curated) is intentionally the same file here — these dates are all
    // pre-cutover so only the legacy pool is exercised.
    initDictionary(allowed, legacy, legacy);
  });

  it('DUEL 2026-07-01 → unchanged', () => {
    expect(generateSolutionsFromSeed('daily-2026-07-01-DUEL', 2)).toEqual(['HEFTY', 'MISTY']);
  });
  it('QUORDLE 2026-07-01 → unchanged', () => {
    expect(generateSolutionsFromSeed('daily-2026-07-01-QUORDLE', 4)).toEqual(['SPIRO', 'BOSSY', 'YUCKY', 'GULCH']);
  });
  it('OCTORDLE 2026-07-05 → unchanged', () => {
    expect(generateSolutionsFromSeed('daily-2026-07-05-OCTORDLE', 8))
      .toEqual(['MORSE', 'SPECK', 'RINSE', 'RADON', 'WHISK', 'SILKY', 'CARAT', 'SPAWN']);
  });
  it('legacy list is the expected size', () => {
    expect(legacy.length).toBe(2594);
  });
});

// Six/Seven pre-cutover pins — captured from the pre-curation 6/7 lists on
// 2026-07-06; must stay identical through the 6/7 curation (per-length gate).
describe('6/7-letter banks — pre-cutover pin (real lists)', () => {
  const dataDir = join(__dirname, '../../../apps/web/data');
  const legacy6: string[] = JSON.parse(readFileSync(join(dataDir, 'solutions-6-legacy.json'), 'utf-8'));
  const legacy7: string[] = JSON.parse(readFileSync(join(dataDir, 'solutions-7-legacy.json'), 'utf-8'));
  const allowed6: string[] = JSON.parse(readFileSync(join(dataDir, 'allowed-6.json'), 'utf-8'));
  const allowed7: string[] = JSON.parse(readFileSync(join(dataDir, 'allowed-7.json'), 'utf-8'));

  beforeAll(() => {
    initDictionaryForLength(6, allowed6, legacy6, legacy6);
    initDictionaryForLength(7, allowed7, legacy7, legacy7);
  });

  it('DUEL_6 2026-07-01 → unchanged', () => {
    expect(generateSolutionsFromSeedForLength('daily-2026-07-01-DUEL_6', 2, 6)).toEqual(['WINNER', 'WINTER']);
  });
  it('DUEL_7 2026-07-01 → unchanged', () => {
    expect(generateSolutionsFromSeedForLength('daily-2026-07-01-DUEL_7', 2, 7)).toEqual(['PROTECT', 'PROTEST']);
  });
  it('legacy 6/7 lists are the expected sizes', () => {
    expect(legacy6.length).toBe(1745);
    expect(legacy7.length).toBe(1211);
  });
  it('per-length gate switches pools by date', () => {
    initDictionaryForLength(6, allowed6, ['ABASED', 'ABATED', 'ABBEYS'], legacy6);
    const pre = generateSolutionsFromSeedForLength('daily-2026-07-01-DUEL_6', 1, 6);
    const post = generateSolutionsFromSeedForLength('daily-2026-08-01-DUEL_6', 1, 6);
    expect(legacy6.map(w => w.toUpperCase())).toContain(pre[0]);
    expect(['ABASED', 'ABATED', 'ABBEYS']).toContain(post[0]);
    // restore for any later suites
    initDictionaryForLength(6, allowed6, legacy6, legacy6);
  });
});

// Regression: the 2026-07-06 production incident. Game pages called the 2-arg
// initDictionary after the central loader had loaded legacy — the re-init
// WIPED the legacy list and every pre-cutover daily seed threw ("Something
// went wrong" for real users). A legacy-less re-init must PRESERVE the loaded
// legacy list.
describe('2-arg re-init must not wipe legacy (prod incident 2026-07-06)', () => {
  it('pre-cutover daily still resolves after a 2-arg re-init', () => {
    const dataDir = join(__dirname, '../../../apps/web/data');
    const legacy: string[] = JSON.parse(readFileSync(join(dataDir, 'solutions-legacy.json'), 'utf-8'));
    const curated: string[] = JSON.parse(readFileSync(join(dataDir, 'solutions.json'), 'utf-8'));
    const allowed: string[] = JSON.parse(readFileSync(join(dataDir, 'allowed.json'), 'utf-8'));
    initDictionary(allowed, curated, legacy);   // central loader
    initDictionary(allowed, curated);           // page pre-warm (2-arg) — used to wipe legacy
    const words = generateSolutionsFromSeed('daily-2026-07-06-QUORDLE', 4);
    const legacySet = new Set(legacy.map(w => w.toUpperCase()));
    expect(words).toHaveLength(4);
    words.forEach(w => expect(legacySet.has(w)).toBe(true));
  });
});

// The date-gate itself, proven with tiny synthetic lists (curated ≠ legacy) so
// the switch is testable without the real curated file existing yet.
describe('solutions date-gate', () => {
  const CURATED = ['AAAAA', 'BBBBB', 'CCCCC'];
  const LEGACY = ['XXXXX', 'YYYYY', 'ZZZZZ'];
  beforeAll(() => { initDictionary(CURATED, CURATED, LEGACY); });

  it('pre-cutover daily seed → legacy pool', () => {
    const w = generateSolutionsFromSeed('daily-2026-07-01-DUEL', 1);
    expect(LEGACY).toContain(w[0]);
    expect(CURATED).not.toContain(w[0]);
  });
  it('post-cutover daily seed → curated pool', () => {
    const w = generateSolutionsFromSeed('daily-2026-07-08-DUEL', 1);
    expect(CURATED).toContain(w[0]);
  });
  it('non-daily (random/VS) seed → curated pool', () => {
    const w = generateSolutionsFromSeed('1751826000000-abc123', 1);
    expect(CURATED).toContain(w[0]);
  });
  it('a given pre-cutover seed is stable across curated changes', () => {
    const before = generateSolutionsFromSeed('daily-2026-07-01-QUORDLE', 2);
    initDictionary(['PPPPP', 'QQQQQ', 'RRRRR'], ['PPPPP', 'QQQQQ', 'RRRRR'], LEGACY);
    expect(generateSolutionsFromSeed('daily-2026-07-01-QUORDLE', 2)).toEqual(before);
  });
});

describe('seed generation', () => {
  beforeAll(() => {
    const solutions = ['APPLE', 'BREAD', 'CRANE', 'DELTA', 'EARTH'];
    initDictionary(solutions, solutions);
  });

  it('should generate deterministic solutions from same seed', () => {
    const seed = 'test-seed-123';
    const solutions1 = generateSolutionsFromSeed(seed, 3);
    const solutions2 = generateSolutionsFromSeed(seed, 3);
    expect(solutions1).toEqual(solutions2);
  });

  it('should generate different solutions from different seeds', () => {
    const solutions1 = generateSolutionsFromSeed('seed1', 3);
    const solutions2 = generateSolutionsFromSeed('seed2', 3);
    expect(solutions1).not.toEqual(solutions2);
  });

  it('should generate requested number of solutions', () => {
    const solutions = generateSolutionsFromSeed('test', 3);
    expect(solutions).toHaveLength(3);
  });

  it('should generate valid solution words', () => {
    const solutions = generateSolutionsFromSeed('test', 2);
    solutions.forEach(sol => {
      expect(sol).toHaveLength(5);
      expect(sol).toMatch(/^[A-Z]+$/);
    });
  });
});
