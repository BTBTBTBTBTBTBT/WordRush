import { describe, it, expect } from 'vitest';
import { formatScore } from './composite-scoring';
import { topPercentLabel, formatShortTime } from './format';
import fixtures from './__fixtures__/display-format-fixtures.json';

/**
 * Display-format parity guard (web side). The same JSON is asserted by iOS
 * DisplayFormatFixtureTests.swift and Android DisplayFormatFixtureTest.kt, so
 * a formatter change that isn't regenerated + ported fails on every platform.
 * Regenerate: node scripts/gen-display-format-fixtures.mjs
 */
describe('display-format fixtures', () => {
  it('formatScore reproduces every fixture case', () => {
    for (const c of fixtures.formatScore) {
      expect(formatScore(c.score), `formatScore(${c.score})`).toBe(c.expected);
    }
  });

  it('formatShortTime reproduces every fixture case', () => {
    for (const c of fixtures.formatShortTime) {
      expect(formatShortTime(c.seconds), `formatShortTime(${c.seconds})`).toBe(c.expected);
    }
  });

  it('topPercentLabel reproduces every fixture case (ROUND semantics)', () => {
    for (const c of fixtures.topPercentLabel) {
      const { label, gold } = topPercentLabel(c.rank, c.totalPlayers);
      expect(label, `topPercentLabel(${c.rank}, ${c.totalPlayers})`).toBe(c.expectedLabel);
      expect(gold, `gold(${c.rank}, ${c.totalPlayers})`).toBe(c.expectedGold);
    }
  });

  it('pins the decided semantics explicitly', () => {
    // ROUND, not truncate: rank 2/8 = 87.5th percentile → Top 12%.
    expect(topPercentLabel(2, 8).label).toBe('Top 12%');
    // Zero time is a value, not missing data.
    expect(formatShortTime(0)).toBe('0s');
    // Scores truncate (never round up) and group with commas.
    expect(formatScore(2332.8)).toBe('2,332');
  });
});
