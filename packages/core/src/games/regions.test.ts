import { describe, it, expect } from 'vitest';
import {
  generateRegions, countRegionsSolutions, regionsN4, regionsSizeForDay, regionsSizeForSeed, regionsDailyNumber,
  createRegionsState, regionsReduce, regionsMatchRow, reconstructRegions, regionsRuledOut, regionsRemaining, REGIONS_MAX_MISTAKES,
} from './regions';

const cells = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0) - 48);

describe('Starsweep generator', () => {
  it('reproduces the Phase 0 sample boards exactly (same generator, ported)', () => {
    // From apps/web/scripts/regions/generate.mjs run on 2026-09-22.
    expect(generateRegions('daily-2026-10-01-REGIONS', 7)).toMatchObject({ rerolls: 12, solution: '5204631' });
    expect(generateRegions('daily-2026-10-02-REGIONS', 7)).toMatchObject({ rerolls: 0, solution: '3514602' });
    expect(generateRegions('daily-2026-10-03-REGIONS', 8)).toMatchObject({ rerolls: 1, solution: '17046253' });
    expect(generateRegions('unlimited-REGIONS-1-hard', 9)).toMatchObject({ rerolls: 22, solution: '574831620' });
  });

  it('every board is valid: one star per row/column/region, no touching, exactly one solution, connected regions', () => {
    for (const [seed, n] of [['a', 7], ['b', 8], ['c', 9], ['daily-2026-11-11-REGIONS', 7]] as Array<[string, number]>) {
      const p = generateRegions(seed, n)!;
      expect(p).not.toBeNull();
      expect(p.regions.length).toBe(n * n);
      expect(p.solution.length).toBe(n);
      const reg = cells(p.regions), sol = cells(p.solution);
      expect(new Set(sol).size).toBe(n);                                   // distinct columns
      expect(new Set(sol.map((c, r) => reg[r * n + c])).size).toBe(n);     // distinct regions
      for (let r = 1; r < n; r++) expect(Math.abs(sol[r] - sol[r - 1])).toBeGreaterThanOrEqual(2);
      expect(countRegionsSolutions(n, reg, 2)).toBe(1);
      expect(p.sizes.reduce((a, b) => a + b, 0)).toBe(n * n);
      expect(Math.max(...p.sizes)).toBeLessThanOrEqual(n * 2);
    }
  });

  it('sizes follow the weekday rule and the unlimited seed suffix', () => {
    expect(regionsSizeForDay('2026-09-21')).toBe(7); // Monday
    expect(regionsSizeForDay('2026-09-23')).toBe(7); // Wednesday
    expect(regionsSizeForDay('2026-09-24')).toBe(8); // Thursday
    expect(regionsSizeForDay('2026-09-27')).toBe(8); // Sunday
    expect(regionsSizeForDay('nope')).toBe(8);
    expect(regionsSizeForSeed('unlimited-REGIONS-1-9')).toBe(9);
    expect(regionsSizeForSeed('unlimited-REGIONS-1-7')).toBe(7);
    expect(regionsSizeForSeed('daily-2026-09-23-REGIONS')).toBe(8);
    expect(regionsDailyNumber('2026-09-23')).toBe(1);
    expect(regionsDailyNumber('2026-09-30')).toBe(8);
  });

  it('neighbours come back in the fixed up/down/left/right order', () => {
    expect(regionsN4(7, 0)).toEqual([7, 1]);
    expect(regionsN4(7, 24)).toEqual([17, 31, 23, 25]);
  });
});

describe('Starsweep reducer', () => {
  const p = generateRegions('daily-2026-10-03-REGIONS', 8)!;
  const n = p.n;
  const star = (r: number) => r * n + (p.solution.charCodeAt(r) - 48);
  const wrongIn = (r: number) => { for (let c = 0; c < n; c++) if (r * n + c !== star(r)) return r * n + c; return -1; };

  it('tap cycles empty → cross → star → empty; a correct star auto-crosses what it rules out', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    expect(s.board[star(0)]).toBe('x');
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    expect(s.board[star(0)]).toBe('*');
    expect(s.mistakes).toBe(0);
    for (const i of regionsRuledOut(n, p.regions, star(0))) expect(s.board[i]).toBe('x');
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    expect(s.board[star(0)]).toBe('.');
    expect(regionsRemaining(s)).toBe(n);
  });

  it('a wrong star counts a mistake that clearing never refunds; the third ends the game', () => {
    let s = createRegionsState(p, 0);
    const w = wrongIn(0);
    s = regionsReduce(s, { type: 'TAP', cell: w }); s = regionsReduce(s, { type: 'TAP', cell: w });
    expect(s.mistakes).toBe(1); expect(s.wrongMask[w]).toBe('1');
    s = regionsReduce(s, { type: 'TAP', cell: w });
    expect(s.board[w]).toBe('.'); expect(s.wrongMask[w]).toBe('0'); expect(s.mistakes).toBe(1);
    s = regionsReduce(s, { type: 'TAP', cell: wrongIn(2) }); s = regionsReduce(s, { type: 'TAP', cell: wrongIn(2) });
    s = regionsReduce(s, { type: 'TAP', cell: wrongIn(4) }); s = regionsReduce(s, { type: 'TAP', cell: wrongIn(4) }, 42);
    expect(s.mistakes).toBe(REGIONS_MAX_MISTAKES); expect(s.status).toBe('lost'); expect(s.endTime).toBe(42);
    expect(regionsReduce(s, { type: 'TAP', cell: star(6) })).toBe(s);
  });

  it('hint places the row star (locked), undo restores the board but keeps the hint count', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'HINT', cell: 5 * n + 2 });
    expect(s.board[star(5)]).toBe('*'); expect(s.hintMask[star(5)]).toBe('1'); expect(s.hintsUsed).toBe(1);
    expect(regionsReduce(s, { type: 'TAP', cell: star(5) })).toBe(s);       // locked
    expect(regionsReduce(s, { type: 'ERASE', cell: star(5) })).toBe(s);     // locked
    s = regionsReduce(s, { type: 'UNDO' });
    expect(s.board[star(5)]).toBe('.'); expect(s.hintsUsed).toBe(1); expect(s.history).toEqual([]);
    s = regionsReduce(s, { type: 'HINT' });
    expect(s.board[star(0)]).toBe('*');
  });

  it('placing every star wins, clears history, and round-trips through the matches row', () => {
    let s = createRegionsState(p, 0);
    for (let r = 0; r < n; r++) { s = regionsReduce(s, { type: 'TAP', cell: star(r) }); s = regionsReduce(s, { type: 'TAP', cell: star(r) }, 7); }
    expect(s.status).toBe('won'); expect(s.endTime).toBe(7); expect(regionsRemaining(s)).toBe(0);
    const row = regionsMatchRow(s);
    expect(row.solutions).toEqual([p.regions, p.solution]);
    const rec = reconstructRegions(row.solutions, row.guesses);
    expect(rec?.solved).toBe(true); expect(rec?.n).toBe(n);
    expect(reconstructRegions(['x'], [])).toBeNull();
    expect(reconstructRegions([p.regions, p.solution], null)?.board).toBe('.'.repeat(n * n));
  });

  it('auto-cross can be switched off', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'SET_AUTO_CROSS', value: false });
    s = regionsReduce(s, { type: 'TAP', cell: star(0) }); s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    const others = regionsRuledOut(n, p.regions, star(0));
    expect(others.every((i) => s.board[i] === '.')).toBe(true);
  });
});
