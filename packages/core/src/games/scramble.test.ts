import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scramblePuzzleForDay, scramblePuzzleForSeed, scrambleDailyNumber, scrambleFinalLetters, scrambleFinalTray, scrambleRemaining, scrambleTarget, scrambleTray,
  createScrambleState, scrambleReduce, scrambleMatchRow, reconstructScramble, scrambleGuessCount, scrambleBoardsSolved, scrambleActiveRow, scrambleFinalOpen,
  SCRAMBLE_MAX_CHECKS, SCRAMBLE_FINAL, type ScrambleBank, type ScrambleState,
} from './scramble';
import type { HolidayTable } from '../bank';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'scramble-puzzles.json'), 'utf8')) as ScrambleBank;
const table = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')) as HolidayTable;

describe('Muddle bank', () => {
  it('has a year of dailies, an Unlimited pool, holiday sets, and honest puzzles', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(bank.holiday ?? {}).length).toBe(28);
    expect(scramblePuzzleForDay(bank, '2026-09-23', table)?.id).toBe(bank.daily[0].id);
    expect(scramblePuzzleForDay(bank, '2026-12-25', table)?.holiday).toBe('christmas');
    expect(scrambleDailyNumber('2026-09-23')).toBe(1);
    expect(bank.extra.some((q) => q.id === scramblePuzzleForSeed(bank, 'unlimited-SCRAMBLE-1')?.id)).toBe(true);
    const ids = new Set<string>();
    for (const p of [...bank.daily, ...bank.extra, ...Object.values(bank.holiday ?? {}).flat()]) {
      expect(ids.has(p.id), `${p.id} duplicate`).toBe(false); ids.add(p.id);
      expect(p.words.length).toBe(4);
      for (const w of p.words) {
        expect(w.answer, p.id).toMatch(/^[A-Z]{5,6}$/);
        expect([...w.scramble].sort().join(''), p.id).toBe([...w.answer].sort().join(''));
        expect(w.scramble, p.id).not.toBe(w.answer);
        for (const i of w.circled) expect(i, p.id).toBeLessThan(w.answer.length);
      }
      const letters = scrambleFinalLetters(p);
      expect(letters.length).toBeGreaterThanOrEqual(8); expect(letters.length).toBeLessThanOrEqual(16);
      expect([...scrambleFinalTray(p)].sort().join(''), p.id).toBe([...letters].sort().join(''));
      expect(p.final.pattern.reduce((a, b) => a + b, 0)).toBe(letters.length);
      expect((p.caption.match(/____/g) || []).length, p.id).toBe(1);
      // Every puzzle carries its hash-named cartoon (the art batch ran 2026-09-23) and the file is in public/muddle.
      expect(p.cartoon, p.id).toMatch(/^md-[a-z0-9]+-[0-9a-f]{10}\.webp$/);
      expect(fs.existsSync(new URL(`../../../../apps/web/public/muddle/${p.cartoon}`, import.meta.url)), `${p.id} cartoon file`).toBe(true);
    }
  });
});

describe('Muddle reducer', () => {
  const p = bank.daily[0];
  const typeWord = (s: ScrambleState, row: number, word: string) => { for (const ch of word) s = scrambleReduce(s, { type: 'TYPE', row, letter: ch }, 7); return s; };

  it('places letters from the tray, checks a full word, returns wrong letters, opens the punchline, and wins', () => {
    let s = createScrambleState(p, 'fixture', 0);
    expect(scrambleActiveRow(s)).toBe(0); expect(scrambleFinalOpen(s)).toBe(false);
    expect(scrambleRemaining('ABCA', 'A')).toBe('BCA'); expect(scrambleRemaining('ABCA', 'AA')).toBe('BC');
    // punchline is closed until the words are done
    s = scrambleReduce(s, { type: 'TYPE', row: SCRAMBLE_FINAL, letter: scrambleTarget(s, SCRAMBLE_FINAL)[0] }); expect(s.entries[SCRAMBLE_FINAL]).toBe('');
    // a letter not in the tray is refused
    const w0 = s.words[0]; const missing = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !w0.scramble.includes(c))!;
    s = scrambleReduce(s, { type: 'TYPE', row: 0, letter: missing }); expect(s.entries[0]).toBe('');
    // a wrong full word: one check, one mistake, letters back
    const wrong = w0.scramble === w0.answer ? [...w0.answer].reverse().join('') : w0.scramble;
    s = typeWord(s, 0, wrong);
    expect(s.checks).toBe(1); expect(s.mistakes).toBe(1); expect(s.entries[0]).toBe(''); expect(s.lastResult).toBe('wrong'); expect(s.events).toEqual([`0✗${wrong}`]);
    s = typeWord(s, 0, w0.answer.slice(0, 2)); s = scrambleReduce(s, { type: 'BACK', row: 0 }); expect(s.entries[0]).toBe(w0.answer[0]); s = scrambleReduce(s, { type: 'CLEAR', row: 0 }); expect(s.entries[0]).toBe('');
    for (let i = 0; i < 4; i++) s = typeWord(s, i, s.words[i].answer);
    expect(s.solved.slice(0, 4)).toEqual([true, true, true, true]); expect(s.checks).toBe(5); expect(scrambleFinalOpen(s)).toBe(true); expect(scrambleActiveRow(s)).toBe(SCRAMBLE_FINAL);
    expect(scrambleTray(s, SCRAMBLE_FINAL)).toBe(scrambleFinalTray(s));
    s = typeWord(s, SCRAMBLE_FINAL, scrambleTarget(s, SCRAMBLE_FINAL));
    expect(s.status).toBe('won'); expect(s.ended).toBe(true); expect(s.endTime).toBe(7); expect(s.checks).toBe(6);
    expect(scrambleGuessCount(s)).toBe(6); expect(scrambleBoardsSolved(s)).toBe(5);
    const row = scrambleMatchRow(s);
    expect(row.solutions).toEqual([...p.words.map((w) => w.answer), p.final.answer]);
    const r = reconstructScramble(row.solutions, row.guesses)!;
    expect(r.won).toBe(true); expect(r.checks).toBe(6); expect(r.mistakes).toBe(1); expect(r.boardsSolved).toBe(5);
  });

  it('hints reveal the next letter or solve a word without counting as checks; thirteen checks lose', () => {
    let s = createScrambleState(p, 'fixture', 0);
    s = scrambleReduce(s, { type: 'REVEAL_LETTER', row: 0 });
    expect(s.entries[0]).toBe(s.words[0].answer[0]); expect(s.revealed[0][0]).toBe(s.words[0].answer[0]); expect(s.hintsUsed).toBe(1); expect(s.events[0]).toBe(`0h${s.revealed[0]}`);
    s = scrambleReduce(s, { type: 'BACK', row: 0 }); expect(s.entries[0]).toBe(s.words[0].answer[0]);   // pinned letter stays
    s = scrambleReduce(s, { type: 'SOLVE_WORD', row: 1 }); expect(s.solved[1]).toBe(true); expect(s.hintsUsed).toBe(3); expect(s.events.at(-1)).toBe('1H');
    // lose: keep submitting wrong words on row 2
    const w2 = s.words[2]; const wrong = [...w2.answer].reverse().join('') === w2.answer ? w2.scramble : [...w2.answer].reverse().join('');
    while (s.status === 'playing') s = typeWord(s, 2, wrong);
    expect(s.status).toBe('lost'); expect(s.checks).toBe(SCRAMBLE_MAX_CHECKS); expect(scrambleGuessCount(s)).toBe(SCRAMBLE_MAX_CHECKS); expect(scrambleBoardsSolved(s)).toBe(1);
    const r = reconstructScramble(...Object.values(scrambleMatchRow(s)) as [string[], string[]])!;
    expect(r.lost).toBe(true); expect(r.hintsUsed).toBe(3); expect(r.solvedByHint).toEqual([1]);
    expect(reconstructScramble(['A', 'B'], [])).toBeNull();
  });
});
