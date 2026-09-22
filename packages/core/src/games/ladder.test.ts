import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ladderPuzzleForDay, ladderPuzzleForSeed, ladderDailyNumber, ladderOneLetterApart, ladderNeighbours, ladderNextStep,
  createLadderState, ladderReduce, ladderMatchRow, reconstructLadder, ladderGuessCount, ladderMaxMoves, LADDER_EXTRA_MOVES,
  type LadderBank,
} from './ladder';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'ladder-puzzles.json'), 'utf8')) as LadderBank;
const allowed = new Set<string>((JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'allowed.json'), 'utf8')) as string[])
  .map((w) => w.toUpperCase()).filter((w) => w.length === 5));
const solutions = new Set<string>((JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'solutions.json'), 'utf8')) as string[]).map((w) => w.toUpperCase()));

describe('Letter Ladder bank', () => {
  it('has a year of dailies from the epoch and a separate Unlimited pool', () => {
    expect(bank.epoch).toBe('2026-09-23');
    expect(bank.daily.length).toBeGreaterThanOrEqual(365);
    expect(bank.extra.length).toBeGreaterThanOrEqual(100);
    expect(ladderPuzzleForDay(bank, '2026-09-23')?.id).toBe(bank.daily[0].id);
    expect(ladderPuzzleForDay(bank, '2026-09-24')?.id).toBe(bank.daily[1].id);
    expect(ladderDailyNumber('2026-09-23')).toBe(1);
    expect(ladderDailyNumber('2026-10-23')).toBe(31);
    const u = ladderPuzzleForSeed(bank, 'unlimited-LADDER-1')!;
    expect(bank.extra.some((p) => p.id === u.id)).toBe(true);
  });

  it('every puzzle is honest: endpoints are answer words, the path is legal, and par is the true shortest route', () => {
    for (const p of [...bank.daily, ...bank.extra]) {
      expect(solutions.has(p.start), p.id).toBe(true);
      expect(solutions.has(p.end), p.id).toBe(true);
      expect(p.path[0]).toBe(p.start);
      expect(p.path[p.path.length - 1]).toBe(p.end);
      expect(p.path.length, p.id).toBe(p.par + 1);
      for (let i = 1; i < p.path.length; i++) {
        expect(allowed.has(p.path[i]), `${p.id} ${p.path[i]}`).toBe(true);
        expect(ladderOneLetterApart(p.path[i - 1], p.path[i]), `${p.id} step ${i}`).toBe(true);
      }
    }
    // Par can't be beaten with an obscure word: BFS over the FULL list agrees (sampled — the whole bank takes minutes).
    for (const p of bank.daily.slice(0, 20)) {
      let cur = p.start, steps = 0; const used = new Set([p.start]);
      while (cur !== p.end && steps < 20) { cur = ladderNextStep(cur, p.end, allowed, used)!; used.add(cur); steps++; }
      expect(steps, p.id).toBe(p.par);
    }
  });

  it('daily par follows the weekday ramp: Mon/Tue 4, Wed/Thu 5, Fri/Sat 6, Sun 7 (where the pools allowed)', () => {
    // 2026-09-23 is a Wednesday.
    expect(bank.daily[0].par).toBe(5);
    expect(bank.daily[1].par).toBe(5);
    expect(bank.daily[5].par).toBe(4);   // Monday
  });
});

describe('Letter Ladder engine', () => {
  const p = bank.daily[0];

  it('neighbours and one-letter checks', () => {
    expect(ladderOneLetterApart('STONE', 'STORE')).toBe(true);
    expect(ladderOneLetterApart('STONE', 'STONE')).toBe(false);
    expect(ladderOneLetterApart('STONE', 'SHORE')).toBe(false);
    const ns = ladderNeighbours('STONE', allowed);
    expect(ns).toContain('STORE');
    expect(ns).toEqual([...ns].sort());
  });

  it('accepts legal rungs, refuses the rest for free, and wins on the end word', () => {
    let s = createLadderState(p, 'fixture', 0);
    s = ladderReduce(s, { type: 'SUBMIT', word: 'ab' }, allowed);
    expect(s.reject).toBe('length'); expect(s.moves).toBe(0);
    s = ladderReduce(s, { type: 'SUBMIT', word: p.end }, allowed);
    expect(['not-one-letter', null]).toContain(s.reject);
    s = ladderReduce(s, { type: 'SUBMIT', word: p.start }, allowed);
    expect(s.reject).toBe('not-one-letter');
    for (const w of p.path.slice(1)) s = ladderReduce(s, { type: 'SUBMIT', word: w.toLowerCase() }, allowed, 9);
    expect(s.status).toBe('won'); expect(s.endTime).toBe(9); expect(s.moves).toBe(p.par);
    expect(ladderGuessCount(s)).toBe(1);
    expect(ladderReduce(s, { type: 'SUBMIT', word: 'STONE' }, allowed).reject).toBe('finished');
  });

  it('undo is free but moves stay spent; the budget is par + 5 and exhausting it loses', () => {
    let s = createLadderState(p, 'fixture', 0);
    const step = p.path[1];
    s = ladderReduce(s, { type: 'SUBMIT', word: step }, allowed);
    s = ladderReduce(s, { type: 'UNDO' }, allowed);
    expect(s.words).toEqual([p.start]); expect(s.moves).toBe(1); expect(s.events).toEqual([`+${step}`, '-']);
    s = ladderReduce(s, { type: 'UNDO' }, allowed);
    expect(s.words).toEqual([p.start]); expect(s.events.length).toBe(2);
    while (s.status === 'playing') {
      s = ladderReduce(s, s.words.length === 1 ? { type: 'SUBMIT', word: step } : { type: 'UNDO' }, allowed, 5);
    }
    expect(s.status).toBe('lost'); expect(s.moves).toBe(ladderMaxMoves(p)); expect(s.moves).toBe(p.par + LADDER_EXTRA_MOVES);
    expect(ladderGuessCount(s)).toBe(6);
  });

  it('a hint places the next rung on a shortest path, counts as a move, and survives undo in the counters', () => {
    let s = createLadderState(p, 'fixture', 0);
    s = ladderReduce(s, { type: 'HINT' }, allowed);
    expect(s.words.length).toBe(2); expect(s.hintMask).toBe('01'); expect(s.hintsUsed).toBe(1); expect(s.moves).toBe(1);
    expect(ladderOneLetterApart(p.start, s.words[1])).toBe(true);
    s = ladderReduce(s, { type: 'UNDO' }, allowed);
    expect(s.hintsUsed).toBe(1); expect(s.moves).toBe(1); expect(s.hintMask).toBe('0');
    for (let i = 0; i < p.par; i++) s = ladderReduce(s, { type: 'HINT' }, allowed, 3);
    expect(s.status).toBe('won');
    expect(s.moves).toBe(p.par + 1);   // the undone hint still counts
  });

  it('the matches row replays into the same ladder', () => {
    let s = createLadderState(p, 'fixture', 0);
    s = ladderReduce(s, { type: 'HINT' }, allowed);
    s = ladderReduce(s, { type: 'UNDO' }, allowed);
    for (const w of p.path.slice(1)) s = ladderReduce(s, { type: 'SUBMIT', word: w }, allowed, 1);
    const row = ladderMatchRow(s);
    expect(row.solutions).toEqual([p.start, p.end, `par:${p.par}`, `path:${p.path.join(',')}`]);
    const r = reconstructLadder(row.solutions, row.guesses)!;
    expect(r.words).toEqual(s.words); expect(r.hintMask).toBe(s.hintMask); expect(r.moves).toBe(s.moves);
    expect(r.hintsUsed).toBe(1); expect(r.solved).toBe(true);
    expect(reconstructLadder(['nope'], [])).toBeNull();
    expect(reconstructLadder([p.start, p.end, 'par:4'], null)?.path).toEqual([p.start, p.end]);
  });
});
