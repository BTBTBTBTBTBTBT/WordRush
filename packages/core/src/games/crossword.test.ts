import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crosswordPuzzleForDay, crosswordPuzzleForSeed, crosswordDailyNumber, crosswordSolution, crosswordEntryCells, crosswordEntriesAt, crosswordIndex,
  createCrosswordState, crosswordReduce, crosswordMatchRow, reconstructCrossword, crosswordGuessCount, crosswordCorrectCount, crosswordLetterCount, crosswordIsSolved,
  CROSSWORD_BLOCK, CROSSWORD_EMPTY, type CrosswordBank,
} from './crossword';
import type { HolidayTable } from '../bank';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'crossword-puzzles.json'), 'utf8')) as CrosswordBank;
const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;

describe('Crosswordocious bank', () => {
  it('has a year of dailies, an Unlimited pool, holiday sets, and well-formed grids', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(50);
    expect(Object.keys(bank.holiday ?? {}).length).toBe(28);
    expect(crosswordPuzzleForDay(bank, '2026-09-23', table)?.id).toBe(bank.daily[0].id);
    expect(crosswordPuzzleForDay(bank, '2026-12-25', table)?.holiday).toBe('christmas');
    expect(crosswordDailyNumber('2026-09-23')).toBe(1);
    expect(bank.extra.some((q) => q.id === crosswordPuzzleForSeed(bank, 'unlimited-CROSSWORD-1')?.id)).toBe(true);
    for (let i = 1; i < bank.daily.length; i++) expect(bank.daily[i].theme, `day ${i}`).not.toBe(bank.daily[i - 1].theme);
    const ids = new Set<string>();
    for (const p of [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()]) {
      expect(ids.has(p.id), `${p.id} duplicate`).toBe(false); ids.add(p.id);
      expect(p.w).toBeLessThanOrEqual(10); expect(p.h).toBeLessThanOrEqual(11);
      expect(p.entries.length).toBeGreaterThanOrEqual(10); expect(p.entries.length).toBeLessThanOrEqual(13);
      const sol = crosswordSolution(p);
      // every entry fits the grid and crossings agree
      const seen = new Map<number, string>();
      for (const e of p.entries) {
        expect(e.answer, p.id).toMatch(/^[A-Z]{3,9}$/);
        expect((e.clue.match(/____/g) || []).length, `${p.id} ${e.answer}`).toBe(1);
        crosswordEntryCells(p, e).forEach((cell, k) => {
          expect(cell, `${p.id} ${e.answer} off grid`).toBeLessThan(p.w * p.h);
          const prev = seen.get(cell); if (prev !== undefined) expect(prev, `${p.id} crossing`).toBe(e.answer[k]); seen.set(cell, e.answer[k]);
        });
        expect(sol[crosswordIndex(p.w, e.r, e.c)]).toBe(e.answer[0]);
      }
      expect(new Set(p.entries.map((e) => e.answer)).size, p.id).toBe(p.entries.length);
      expect((p as { holiday?: string }).holiday === undefined || Object.keys(bank.holiday!).includes((p as { holiday?: string }).holiday!)).toBe(true);
    }
  });
});

describe('Crosswordocious reducer', () => {
  const p = bank.daily[0];
  const sol = crosswordSolution(p);
  const firstLetterCell = [...sol].findIndex((ch) => ch !== CROSSWORD_BLOCK);
  const e0 = p.entries[0];

  it('starts blank, sets and clears free, checks lock right and clear wrong, and completes itself', () => {
    let s = createCrosswordState(p, 'fixture', 0);
    expect(s.fill.replace(/\./g, '').split('').every((ch) => ch === CROSSWORD_EMPTY)).toBe(true);
    expect(crosswordLetterCount(s)).toBe([...sol].filter((c) => c !== '.').length);
    const cells = crosswordEntryCells(p, e0);
    s = crosswordReduce(s, { type: 'SET', cell: cells[0], letter: e0.answer[0].toLowerCase() });
    expect(s.fill[cells[0]]).toBe(e0.answer[0]); expect(s.events).toEqual([`=${Math.floor(cells[0] / p.w)},${cells[0] % p.w}:${e0.answer[0]}`]);
    s = crosswordReduce(s, { type: 'SET', cell: cells[1], letter: e0.answer[1] === 'Z' ? 'Y' : 'Z' });
    s = crosswordReduce(s, { type: 'SET', cell: 0, letter: 'A' }); // block or fine — no crash
    s = crosswordReduce(s, { type: 'CHECK' });
    expect(s.checks).toBe(1); expect(s.locked[cells[0]]).toBe('1'); expect(s.fill[cells[1]]).toBe(CROSSWORD_EMPTY); expect(s.lastWrong).toEqual([cells[1]]); expect(s.events.at(-1)).toBe('#1');
    expect(crosswordGuessCount(0)).toBe(1); expect(crosswordGuessCount(1)).toBe(2); expect(crosswordGuessCount(200)).toBe(99);
    s = crosswordReduce(s, { type: 'CLEAR', cell: cells[0] }); expect(s.fill[cells[0]]).toBe(e0.answer[0]);   // locked stays
    for (let i = 0; i < sol.length; i++) if (sol[i] !== CROSSWORD_BLOCK && s.fill[i] !== sol[i]) s = crosswordReduce(s, { type: 'SET', cell: i, letter: sol[i] }, 55);
    expect(crosswordIsSolved(s)).toBe(true); expect(s.status).toBe('won'); expect(s.ended).toBe(true); expect(s.endTime).toBe(55);
    const row = crosswordMatchRow(s);
    expect(row.solutions[0]).toBe(`${p.id}|${p.title}|${p.w}x${p.h}`); expect(row.solutions[1]).toBe(sol); expect(row.solutions.length).toBe(2 + p.entries.length);
    const r = reconstructCrossword(row.solutions, row.guesses)!;
    expect(r.solved).toBe(true); expect(r.checks).toBe(1); expect(r.correct).toBe(r.total);
  });

  it('reveals a letter, a word and the puzzle, with the right hint costs and a loss on the puzzle', () => {
    let s = createCrosswordState(p, 'fixture', 0);
    s = crosswordReduce(s, { type: 'REVEAL_LETTER', cell: firstLetterCell });
    expect(s.fill[firstLetterCell]).toBe(sol[firstLetterCell]); expect(s.locked[firstLetterCell]).toBe('1'); expect(s.revealed[firstLetterCell]).toBe('l'); expect(s.hintsUsed).toBe(1);
    const again = crosswordReduce(s, { type: 'REVEAL_LETTER', cell: firstLetterCell }); expect(again).toBe(s);
    const e = p.entries.find((x) => !crosswordEntryCells(p, x).includes(firstLetterCell)) ?? p.entries[1];
    s = crosswordReduce(s, { type: 'REVEAL_WORD', n: e.n, dir: e.dir });
    for (const c of crosswordEntryCells(p, e)) { expect(s.fill[c]).toBe(sol[c]); expect(s.revealed[c]).toBe('w'); }
    expect(s.hintsUsed).toBe(3); expect(s.events.at(-1)).toBe(`!${e.n}${e.dir}`);
    expect(crosswordEntriesAt(p, crosswordEntryCells(p, e)[0]).some((x) => x.n === e.n)).toBe(true);
    s = crosswordReduce(s, { type: 'REVEAL_PUZZLE' }, 300);
    expect(s.status).toBe('lost'); expect(s.ended).toBe(true); expect(crosswordIsSolved(s)).toBe(true); expect(s.events.at(-1)).toBe('!!');
    expect(crosswordCorrectCount(s)).toBe(crosswordLetterCount(s));
    const r = reconstructCrossword(...Object.values(crosswordMatchRow(s)) as [string[], string[]])!;
    expect(r.revealedPuzzle).toBe(true); expect(r.solved).toBe(false); expect(r.hintsUsed).toBe(3);
    expect(reconstructCrossword(['x|y', 'ABC'], [])).toBeNull();
    expect(reconstructCrossword(['x|y|2x2', 'ABC', 'AB'], [])).toBeNull();
  });
});
