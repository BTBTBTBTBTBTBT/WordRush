import { describe, it, expect } from 'vitest';
import { bankRunwayReport, MIN_RUNWAY_DAYS, TARGET_DAILIES } from '../lib/bank-runway';

/**
 * Content runway (More Games §11; founder 2026-09-23). This test is the first
 * of the three "make more puzzles" alarms: it turns CI red while there is
 * still time to author and ship a longer bank on all three platforms.
 *
 * When it fails: run the game's build-bank script (listed in `source`) with
 * a higher daily count, copy the bank to iOS Resources / Android core
 * resources / iOS test fixtures, and let word-list-sync.test.ts confirm the
 * three copies match. Appending never moves a dated day.
 */
describe('daily bank runway', () => {
  const today = new Date().toISOString().slice(0, 10);
  const rows = bankRunwayReport(today);

  it('registers every bundled bank', () => {
    expect(rows.map((r) => r.game).sort()).toEqual(['crossword', 'cryptogram', 'groups', 'hub', 'ladder', 'scramble', 'wordsearch']);
  });

  for (const r of rows) {
    it(`${r.title} ships at least ${TARGET_DAILIES} dailies (founder: a year's worth per game)`, () => {
      expect(r.dailies).toBeGreaterThanOrEqual(TARGET_DAILIES);
    });
    it(`${r.title} has at least ${MIN_RUNWAY_DAYS} days of unplayed dailies left (recycles on ${r.recyclesOn})`, () => {
      expect(r.daysLeft, `${r.title}: ${r.daysLeft} days left — rebuild via ${r.source}`).toBeGreaterThanOrEqual(MIN_RUNWAY_DAYS);
    });
  }
});
