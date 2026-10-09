import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Friday queue item 30: the harder Spyglass generator (tooling, not yet applied to the bank).
import {
  generateHarder, generateHardest, difficultyScore, rejectReason, meetsMixRule, knobsForLevel, levelForDate, cellsOf, themePools, DIRS, N,
} from '../../../../scripts/puzzles/spyglass-harder.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'wordsearch-puzzles.json'), 'utf8'));
const pools = themePools();
const DIAG = new Set(['SE', 'NE', 'NW', 'SW']), BACK = new Set(['W', 'N', 'NW', 'SW']), PLAIN = new Set(['E', 'S']);

describe('spyglass harder generator', () => {
  it('ramps Mon gentler → Sat/Sun hardest', () => {
    expect(levelForDate('2026-10-12')).toBe(1); // Mon
    expect(levelForDate('2026-10-16')).toBe(5); // Fri
    expect(levelForDate('2026-10-17')).toBe(6); // Sat
    expect(levelForDate('2026-10-18')).toBe(6); // Sun
    for (let l = 2; l <= 6; l++) {
      const a = knobsForLevel(l - 1), b = knobsForLevel(l);
      expect(b.minDiagonal + b.minBackwards + b.minCrossings).toBeGreaterThanOrEqual(a.minDiagonal + a.minBackwards + a.minCrossings);
      expect(b.maxPlain).toBeLessThanOrEqual(a.maxPlain);
      expect(b.camouflage).toBeGreaterThan(a.camouflage);
    }
  });

  it('every grid meets the mix rule, places each word once and is clean in all 8 directions', () => {
    for (const p of bank.daily.slice(17, 31)) {
      const words = p.words.map((w: { w: string }) => w.w);
      for (const level of [1, 3, 6]) {
        const g = generateHardest({ words, pool: pools[p.theme] ?? [], level, seed: `test-${p.id}` });
        expect(g.grid).toMatch(/^[A-Z]{100}$/);
        expect(g.words.map((w: { w: string }) => w.w).sort()).toEqual([...words].sort());
        for (const pl of g.words) for (const [k, cell] of cellsOf(pl).entries()) expect(g.grid[cell]).toBe(pl.w[k]);
        expect(meetsMixRule(g.words, knobsForLevel(g.level))).toBe(true);
        expect(rejectReason(g.grid, g.words, pools[p.theme] ?? [])).toBeNull();
        const dirs = g.words.map((w: { d: string }) => w.d);
        expect(dirs.filter((d: string) => DIAG.has(d)).length).toBeGreaterThanOrEqual(3);
        expect(dirs.filter((d: string) => BACK.has(d)).length).toBeGreaterThanOrEqual(2);
        expect(dirs.filter((d: string) => PLAIN.has(d)).length).toBeLessThanOrEqual(3);
        expect(Object.keys(DIRS)).toEqual(expect.arrayContaining(dirs));
      }
    }
  });

  it('is deterministic for a seed and differs across seeds', () => {
    const words = bank.daily[20].words.map((w: { w: string }) => w.w);
    const a = generateHarder({ words, level: 4, seed: 'x' }), b = generateHarder({ words, level: 4, seed: 'x' }), c = generateHarder({ words, level: 4, seed: 'y' });
    expect(a.grid).toBe(b.grid);
    expect(a.grid).not.toBe(c.grid);
  });

  it('scores the harder grids well above the shipped forward-only grids', () => {
    let before = 0, after = 0;
    for (const p of bank.daily.slice(17, 31)) {
      const words = p.words.map((w: { w: string }) => w.w);
      before += difficultyScore(p).total;
      after += generateHardest({ words, pool: pools[p.theme] ?? [], level: 4, seed: `score-${p.id}` }).score.total;
    }
    expect(after / 14).toBeGreaterThanOrEqual(70);
    expect(after).toBeGreaterThan(before + 14 * 25);
  });

  it('rejects filler that spells a theme word or a ≥4-letter chunk off the word', () => {
    const p = bank.daily[16]; // In the Kitchen: SAUCEPAN E at r1 c0 …
    const grid = p.grid.split('');
    // Plant "PAN" + "S" → "PANS" reading somewhere else: copy the chunk "SAUC" into the last row.
    const planted = [...grid]; planted[90] = 'S'; planted[91] = 'A'; planted[92] = 'U'; planted[93] = 'C';
    expect(rejectReason(planted.join(''), p.words, pools[p.theme] ?? [])).toMatch(/chunk SAUC|off-list|occurs/);
    // The word's own letters are not a violation.
    const own = p.words.find((w: { w: string }) => w.w === 'SAUCEPAN');
    expect(own).toBeTruthy();
    expect(N).toBe(10);
  });
});
