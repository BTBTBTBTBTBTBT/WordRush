import { describe, it, expect } from 'vitest';
import {
  generateRegions, countRegionsSolutions, regionsN4, regionsSizeForDay, regionsSizeForSeed, regionsDailyNumber,
  createRegionsState, regionsReduce, regionsMatchRow, reconstructRegions, regionsRuledOut, regionsRemaining, REGIONS_MAX_MISTAKES, normalizeRegionsState,
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

  it('neighbors come back in the fixed up/down/left/right order', () => {
    expect(regionsN4(7, 0)).toEqual([7, 1]);
    expect(regionsN4(7, 24)).toEqual([17, 31, 23, 25]);
  });
});

describe('Starsweep reducer', () => {
  const p = generateRegions('daily-2026-10-03-REGIONS', 8)!;
  const n = p.n;
  const star = (r: number) => r * n + (p.solution.charCodeAt(r) - 48);
  const wrongIn = (r: number) => { for (let c = 0; c < n; c++) if (r * n + c !== star(r)) return r * n + c; return -1; };

  // Tap = black star (never judged), double tap (COMMIT) = play it, tap a black star = ×,
  // tap an × = clear (founder, 2026-09-28 afternoon).
  it('tap cycles empty → black star → cross → empty; a black star auto-crosses and is never judged', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'TAP', cell: wrongIn(0) });
    expect(s.board[wrongIn(0)]).toBe('o');
    expect(s.mistakes).toBe(0);
    for (const i of regionsRuledOut(n, p.regions, wrongIn(0))) { expect(s.board[i]).toBe('x'); expect(s.autoMask[i]).toBe('1'); }
    s = regionsReduce(s, { type: 'TAP', cell: wrongIn(0) });
    expect(s.board[wrongIn(0)]).toBe('x');
    expect(s.board.replace(/[.]/g, '')).toBe('x');                      // its crosses went with it
    s = regionsReduce(s, { type: 'TAP', cell: wrongIn(0) });
    expect(s.board).toBe('.'.repeat(n * n));
    expect(s.mistakes).toBe(0);
  });

  it('commit judges: a right star turns purple and keeps its crosses', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    s = regionsReduce(s, { type: 'COMMIT', cell: star(0) });
    expect(s.board[star(0)]).toBe('*'); expect(s.wrongMask[star(0)]).toBe('0'); expect(s.mistakes).toBe(0);
    for (const i of regionsRuledOut(n, p.regions, star(0))) expect(s.board[i]).toBe('x');
    expect(regionsRemaining(s)).toBe(n - 1);
    expect(regionsReduce(s, { type: 'COMMIT', cell: star(0) })).toBe(s);    // already played
  });

  it('a red star is a mistake and takes back only the crosses it drew', () => {
    let s = createRegionsState(p, 0);
    const w = wrongIn(3);
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });                   // black star, correct cell
    const hand = (() => { for (let i = 0; i < n * n; i++) if (s.board[i] === '.' && !regionsRuledOut(n, p.regions, w).includes(i) && i !== w) return i; return -1; })();
    s = regionsReduce(s, { type: 'TAP', cell: hand }); s = regionsReduce(s, { type: 'TAP', cell: hand });  // hand ×
    expect(s.board[hand]).toBe('x'); expect(s.autoMask[hand]).toBe('0');
    const before = s.board;
    s = regionsReduce(s, { type: 'TAP', cell: w });
    s = regionsReduce(s, { type: 'COMMIT', cell: w });
    expect(s.board[w]).toBe('*'); expect(s.wrongMask[w]).toBe('1'); expect(s.mistakes).toBe(1);
    // Every cell other than the red star is exactly as before it: star(0)'s crosses and the hand × stay.
    for (let i = 0; i < n * n; i++) if (i !== w) expect(s.board[i]).toBe(before[i]);
    s = regionsReduce(s, { type: 'TAP', cell: w });                         // red → × (mistake stands)
    expect(s.board[w]).toBe('x'); expect(s.wrongMask[w]).toBe('0'); expect(s.mistakes).toBe(1);
  });

  it('commit on an empty cell plays straight away; erase clears a black star and its crosses', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'COMMIT', cell: star(1) });
    expect(s.board[star(1)]).toBe('*'); expect(s.mistakes).toBe(0);
    s = regionsReduce(s, { type: 'TAP', cell: star(4) });
    s = regionsReduce(s, { type: 'ERASE', cell: star(4) });
    expect(s.board[star(4)]).toBe('.');
    const keep = new Set(regionsRuledOut(n, p.regions, star(1)));
    for (let i = 0; i < n * n; i++) if (i !== star(1)) expect(s.board[i]).toBe(keep.has(i) ? 'x' : '.');
  });

  it('three red stars lose; black stars are cleared from the final board', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'TAP', cell: star(7) });
    for (const r of [0, 2]) s = regionsReduce(s, { type: 'COMMIT', cell: wrongIn(r) });
    expect(s.mistakes).toBe(2);
    s = regionsReduce(s, { type: 'COMMIT', cell: wrongIn(4) }, 42);
    expect(s.mistakes).toBe(REGIONS_MAX_MISTAKES); expect(s.status).toBe('lost'); expect(s.endTime).toBe(42);
    expect(s.board.includes('o')).toBe(false);
    expect(regionsReduce(s, { type: 'TAP', cell: star(6) })).toBe(s);
  });

  it('a red star left on the board does not block the win (the stuck-board bug)', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'COMMIT', cell: wrongIn(0) });
    expect(s.mistakes).toBe(1);
    for (let r = 0; r < n; r++) s = regionsReduce(s, { type: 'COMMIT', cell: star(r) }, 9);
    expect(s.status).toBe('won'); expect(s.endTime).toBe(9);
  });

  it('old saves without autoMask are normalized (every × counts as hand-placed)', () => {
    const s = createRegionsState(p, 0);
    const { autoMask: _drop, ...legacy } = s;
    const fixed = normalizeRegionsState({ ...legacy, history: [{ board: s.board, hintMask: s.hintMask, wrongMask: s.wrongMask }] } as unknown as typeof s);
    expect(fixed.autoMask).toBe('0'.repeat(n * n));
    expect(fixed.history[0].autoMask).toBe('0'.repeat(n * n));
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
    for (let r = 0; r < n; r++) s = regionsReduce(s, { type: 'COMMIT', cell: star(r) }, 7);
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
    s = regionsReduce(s, { type: 'TAP', cell: star(0) });
    const others = regionsRuledOut(n, p.regions, star(0));
    expect(others.every((i) => s.board[i] === '.')).toBe(true);
  });
});
