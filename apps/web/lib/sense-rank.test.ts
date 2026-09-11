import { describe, it, expect } from 'vitest';
import { rankSenses, senseScore, isCircular, isStub, isDerived } from './sense-rank';
import fixtures from './__fixtures__/sense-rank-fixtures.json';

/**
 * Sense-ranker parity guard (web side). The same JSON is asserted by iOS
 * SenseRankFixtureTests.swift and Android SenseRankFixtureTest.kt, so a rule
 * change that isn't regenerated + ported fails on every platform.
 * Regenerate: node scripts/gen-sense-rank-fixtures.mjs
 */
describe('sense-rank fixtures', () => {
  it('has a meaningful sample', () => {
    expect(fixtures.cases.length).toBeGreaterThan(100);
  });

  it('picks the fixture first sense and reproduces every score', () => {
    for (const c of fixtures.cases) {
      expect(rankSenses(c.word, c.senses)[0].def, c.word).toBe(c.expectedFirst);
      expect(c.senses.map((s) => senseScore(c.word, s)), `${c.word} scores`).toEqual(c.scores);
    }
  });

  it('pins the decided semantics explicitly', () => {
    expect(isCircular('nasty', 'Something nasty.')).toBe(true);
    expect(isCircular('climb', 'An act of climbing.')).toBe(true);
    // A real definition that merely uses the word is not circular.
    expect(isCircular('blade', 'The sharp cutting edge of a knife, chisel, or other tool, a razor blade/sword blade.')).toBe(false);
    // A capitalised mention is a name.
    expect(isCircular('bible', 'An exemplar of the Bible.')).toBe(false);
    expect(isStub('Alternative spelling of braze.')).toBe(true);
    expect(isStub('plural of calf')).toBe(false); // inflection notes are accurate and stay
    expect(isDerived('dizzy', 'To make dizzy, to bewilder.')).toBe(true);
    expect(isDerived('quiet', 'The absence of sound; quietness.')).toBe(true);
    expect(isDerived('orchid', 'A plant of the orchid family (Orchidaceae), bearing unusually-shaped flowers.')).toBe(false);
  });
});
