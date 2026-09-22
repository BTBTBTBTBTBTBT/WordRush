import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  wordsearchPuzzleForDay, wordsearchPuzzleForSeed, wordsearchDailyNumber, wordsearchCells, wordsearchLine,
  createWordsearchState, wordsearchReduce, wordsearchMatchRow, reconstructWordsearch, wordsearchGuessCount, wordsearchNextUnfound,
  WORDSEARCH_DIRS, WORDSEARCH_N, type WordsearchBank, type WordsearchPuzzle,
} from './wordsearch';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bankPath = join(repo, 'apps', 'web', 'data', 'wordsearch-puzzles.json');
const bank = fs.existsSync(bankPath) ? (JSON.parse(fs.readFileSync(bankPath, 'utf8')) as WordsearchBank) : null;

/** A synthetic puzzle: a Z-filled grid with four words laid by hand. */
function synthetic(): WordsearchPuzzle {
  const n = WORDSEARCH_N;
  const g = Array(n * n).fill('Z');
  const words = [
    { w: 'APPLE', r: 0, c: 0, d: 'E' },
    { w: 'MANGO', r: 2, c: 1, d: 'S' },
    { w: 'PEAR', r: 9, c: 0, d: 'NE' },
    { w: 'PLUM', r: 5, c: 5, d: 'SE' },
  ];
  for (const p of words) wordsearchCells(n, p).forEach((i, k) => { g[i] = p.w[k]; });
  return { id: 'syn', theme: 'fruit', family: 'food', title: 'Fruit Bowl', grid: g.join(''), words };
}

describe('Spyglass geometry', () => {
  it('lines are straight or nothing', () => {
    expect(wordsearchLine(10, 0, 4)).toEqual([0, 1, 2, 3, 4]);
    expect(wordsearchLine(10, 4, 0)).toEqual([4, 3, 2, 1, 0]);
    expect(wordsearchLine(10, 0, 33)).toEqual([0, 11, 22, 33]);
    expect(wordsearchLine(10, 90, 63)).toEqual([90, 81, 72, 63]);
    expect(wordsearchLine(10, 0, 12)).toBeNull();
    expect(wordsearchLine(10, 0, 100)).toBeNull();
    expect(wordsearchLine(10, 7, 7)).toEqual([7]);
  });
  it('placement cells follow the direction table', () => {
    expect(wordsearchCells(10, { w: 'PEAR', r: 9, c: 0, d: 'NE' })).toEqual([90, 81, 72, 63]);
    expect(Object.keys(WORDSEARCH_DIRS)).toHaveLength(8);
  });
});

describe('Spyglass reducer', () => {
  const p = synthetic();
  const cell = (r: number, c: number) => r * 10 + c;

  it('finds words forwards and backwards, ignores short or crooked drags, counts long misses', () => {
    let s = createWordsearchState(p, 'fixture', 0);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(0, 0), to: cell(0, 4) });
    expect(s.found).toEqual(['APPLE']); expect(s.events).toEqual(['+APPLE']);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(6, 1), to: cell(2, 1) });     // MANGO backwards
    expect(s.found).toEqual(['APPLE', 'MANGO']);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(0, 0), to: cell(0, 4) });     // already found
    expect(s.events.length).toBe(2);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(0, 0), to: cell(2, 3) });     // crooked
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(8, 8), to: cell(8, 9) });     // 2 cells
    expect(s.misses).toBe(0);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(8, 0), to: cell(8, 5) });     // ZZZZZZ
    expect(s.misses).toBe(1); expect(s.events[2]).toBe('x 8,0>8,5');
    expect(wordsearchGuessCount(s)).toBe(11);
    expect(s.status).toBe('playing');
  });

  it('hint pulses the next unfound word once each and costs a hint', () => {
    let s = createWordsearchState(p, 'fixture', 0);
    s = wordsearchReduce(s, { type: 'SELECT', from: cell(0, 0), to: cell(0, 4) });
    expect(wordsearchNextUnfound(s)?.w).toBe('MANGO');
    s = wordsearchReduce(s, { type: 'HINT' });
    expect(s.hinted).toEqual(['MANGO']); expect(s.hintsUsed).toBe(1); expect(s.events.at(-1)).toBe('?MANGO');
    s = wordsearchReduce(s, { type: 'HINT' }); s = wordsearchReduce(s, { type: 'HINT' });
    expect(s.hinted).toEqual(['MANGO', 'PEAR', 'PLUM']);
    expect(wordsearchReduce(s, { type: 'HINT' })).toBe(s);   // everything unfound is already pulsed
  });

  it('finding every word wins; reveal loses and keeps what was found; the row replays', () => {
    let s = createWordsearchState(p, 'fixture', 0);
    for (const w of p.words) { const cells = wordsearchCells(10, w); s = wordsearchReduce(s, { type: 'SELECT', from: cells[0], to: cells[cells.length - 1] }, 9); }
    expect(s.status).toBe('won'); expect(s.endTime).toBe(9); expect(wordsearchGuessCount(s)).toBe(10);
    let l = createWordsearchState(p, 'fixture', 0);
    l = wordsearchReduce(l, { type: 'SELECT', from: cell(0, 0), to: cell(0, 4) });
    l = wordsearchReduce(l, { type: 'SELECT', from: cell(8, 0), to: cell(8, 9) });
    l = wordsearchReduce(l, { type: 'REVEAL' }, 300);
    expect(l.status).toBe('lost'); expect(l.endTime).toBe(300);
    const row = wordsearchMatchRow(l);
    expect(row.solutions[0]).toBe(`g:${p.grid}`); expect(row.solutions[1]).toBe('t:Fruit Bowl'); expect(row.solutions[2]).toBe('APPLE@0,0,E');
    const r = reconstructWordsearch(row.solutions, row.guesses)!;
    expect(r.found).toEqual(['APPLE']); expect(r.misses).toBe(1); expect(r.revealed).toBe(true); expect(r.solved).toBe(false); expect(r.words).toEqual(p.words);
    expect(reconstructWordsearch(['nope'], [])).toBeNull();
  });
});

describe.skipIf(!bank)('Spyglass bank', () => {
  const b = bank!;
  it('has a year of dailies from the epoch, an Unlimited pool, and honest puzzles', () => {
    expect(b.epoch).toBe('2026-09-23');
    expect(b.daily.length).toBeGreaterThanOrEqual(365);
    expect(b.extra.length).toBeGreaterThanOrEqual(100);
    expect(wordsearchPuzzleForDay(b, '2026-09-23')?.id).toBe(b.daily[0].id);
    expect(wordsearchDailyNumber('2026-09-23')).toBe(1);
    expect(b.extra.some((q) => q.id === wordsearchPuzzleForSeed(b, 'unlimited-WORDSEARCH-1')?.id)).toBe(true);
    for (const q of [...b.daily, ...b.extra]) {
      expect(q.grid.length, q.id).toBe(100);
      expect(q.words.length, q.id).toBe(10);
      for (const w of q.words) {
        expect(['E', 'S', 'SE', 'NE'], `${q.id} ${w.w} dir`).toContain(w.d);
        const letters = wordsearchCells(10, w).map((i) => q.grid[i]).join('');
        expect(letters, `${q.id} ${w.w}`).toBe(w.w);
      }
    }
  });
  it('keeps the variety rules: no theme within 120 days, no consecutive family, no word within 45 days', () => {
    const lastTheme = new Map<string, number>(), lastWord = new Map<string, number>();
    b.daily.forEach((q, i) => {
      if (lastTheme.has(q.theme)) expect(i - lastTheme.get(q.theme)!, `${q.id} theme gap`).toBeGreaterThanOrEqual(120);
      lastTheme.set(q.theme, i);
      if (i > 0) expect(q.family, `${q.id} family`).not.toBe(b.daily[i - 1].family);
      for (const w of q.words) {
        if (lastWord.has(w.w)) expect(i - lastWord.get(w.w)!, `${q.id} ${w.w} word gap`).toBeGreaterThan(45);
        lastWord.set(w.w, i);
      }
    });
  });
});
