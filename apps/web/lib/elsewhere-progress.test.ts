import { describe, it, expect } from 'vitest';
import {
  generateSudoku, createSudokuState, sudokuReduce, sudokuMatchRow,
  generateRegions, createRegionsState, regionsReduce, regionsMatchRow,
  ladderPuzzleForSeed, createLadderState, ladderReduce, ladderMatchRow, ladderGuessCount,
  hubPuzzleForSeed, createHubState, hubReduce, hubMatchRow, hubRank, hubGuessCount, hubBoardsSolved, HUB_TOTAL_BOARDS,
  cryptogramPuzzleForSeed, createCryptogramState, cryptogramReduce, cryptogramMatchRow, cryptogramGuessCount, cryptogramCodeLetters, cryptogramPlainFor, CRYPTOGRAM_TOTAL_BOARDS,
  groupsPuzzleForSeed, createGroupsState, groupsReduce, groupsMatchRow, groupsGuessCount, groupsBoardsSolved, GROUPS_TOTAL_BOARDS,
  crosswordPuzzleForSeed, createCrosswordState, crosswordReduce, crosswordMatchRow, crosswordGuessCount, crosswordEntryCells, CROSSWORD_BLOCK, CROSSWORD_TOTAL_BOARDS,
  scramblePuzzleForSeed, createScrambleState, scrambleReduce, scrambleMatchRow, scrambleGuessCount, scrambleBoardsSolved, scrambleTarget, SCRAMBLE_TOTAL_BOARDS,
  type LadderBank, type HubBank, type CryptogramBank, type GroupsBank, type CrosswordBank, type ScrambleBank, type ScrambleState,
} from '@wordle-duel/core';
import ladderBankJson from '@/data/ladder-puzzles.json';
import hubBankJson from '@/data/hub-puzzles.json';
import cryptogramBankJson from '@/data/cryptogram-puzzles.json';
import groupsBankJson from '@/data/groups-puzzles.json';
import crosswordBankJson from '@/data/crossword-puzzles.json';
import scrambleBankJson from '@/data/scramble-puzzles.json';
import { computeScoreBreakdown } from '@/lib/composite-scoring';
import type { SolvedDailyRow } from '@/lib/daily-service';
import { evaluateGuess } from '@/components/propernoundle/game-logic';
import type { Guess, TileState } from '@/components/propernoundle/types';
import {
  sudokuElsewhere, regionsElsewhere, ladderElsewhere, hubElsewhere, cryptogramElsewhere, groupsElsewhere, crosswordElsewhere, scrambleElsewhere, propernoundleElsewhere,
  type ElsewhereProgress,
} from './elsewhere-progress';

// Founder, 2026-09-28: "make it exact everywhere." Each block plays a real game
// through the core reducer to a finish, scores it the way the game's own
// recordGameResult(...) call does, writes the same matches row recordSoloMatch
// would, and checks that the other-device card — fed only that row plus
// daily_results' (won, guess_count) — lands on the identical composite. Losses
// are the cases that used to drift (partial progress assumed zero).

const SEED = 'daily-2026-09-28-TEST';
const TIME = 137;

const rowOf = (m: { solutions: string[]; guesses: string[] }, won: boolean, guessCount: number, hintsUsed: number): SolvedDailyRow =>
  ({ guesses: m.guesses, solutions: m.solutions, won, guessCount, timeSeconds: TIME, hintsUsed });
const daily = (won: boolean, guessCount: number) => ({ seed: SEED, won, guessCount });
const local = (mode: string, won: boolean, gc: number, boards: number, total: number, hints: number, best?: number) =>
  computeScoreBreakdown(mode, won, gc, TIME, boards, total, hints, undefined, best).total;
const viaCard = (mode: string, won: boolean, gc: number, p: ElsewhereProgress) =>
  computeScoreBreakdown(mode, won, gc, TIME, p.boardsSolved, p.totalBoards, p.hintsUsed, undefined, p.bestCorrectLetters).total;

describe('Sudocious', () => {
  const p = generateSudoku('daily-2026-09-28-SUDOKU', 'medium');
  const empties = [...p.givens].map((c, i) => (c === '0' ? i : -1)).filter((i) => i >= 0);

  it('loss: mistakes + 1, one hint, the grid as left', () => {
    let s = createSudokuState(p, 0);
    s = sudokuReduce(s, { type: 'HINT' }, 1);
    for (const cell of empties) {
      if (s.status !== 'playing') break;
      if (s.board[cell] !== '0') continue;
      s = sudokuReduce(s, { type: 'PLACE', cell, digit: (Number(p.solution[cell]) % 9) + 1 }, 2);
    }
    expect(s.status).toBe('lost');
    const gc = s.mistakes + 1;
    const out = sudokuElsewhere(rowOf(sudokuMatchRow(s), false, gc, s.hintsUsed), daily(false, gc));
    expect(out.progress).toEqual({ boardsSolved: 0, totalBoards: 1, hintsUsed: s.hintsUsed });
    expect(viaCard('SUDOKU', false, gc, out.progress)).toBe(local('SUDOKU', false, gc, 0, 1, s.hintsUsed));
    expect(out.state?.board).toBe(s.board);
    expect(out.state?.mistakes).toBe(s.mistakes);
    // A row written before hints_used was populated falls back to the hint mask.
    expect(sudokuElsewhere(rowOf(sudokuMatchRow(s), false, gc, 0), daily(false, gc)).progress.hintsUsed).toBe(s.hintsUsed);
  });

  it('win: every cell right', () => {
    let s = createSudokuState(p, 0);
    for (const cell of empties) s = sudokuReduce(s, { type: 'PLACE', cell, digit: Number(p.solution[cell]) }, 2);
    expect(s.status).toBe('won');
    const out = sudokuElsewhere(rowOf(sudokuMatchRow(s), true, 1, 0), daily(true, 1));
    expect(viaCard('SUDOKU', true, 1, out.progress)).toBe(local('SUDOKU', true, 1, 1, 1, 0));
    expect(out.state?.board).toBe(p.solution);
  });
});

describe('Starsweep', () => {
  const p = generateRegions('daily-2026-10-03-REGIONS', 8)!;
  const isStar = (cell: number) => p.solution.charCodeAt(Math.floor(cell / 8)) - 48 === cell % 8;

  it('loss: three wrong stars after a hint', () => {
    let s = createRegionsState(p, 0);
    s = regionsReduce(s, { type: 'HINT' }, 1);
    for (let cell = 0; cell < 64 && s.status === 'playing'; cell++) {
      if (isStar(cell) || s.board[cell] !== '.') continue;
      s = regionsReduce(s, { type: 'TAP', cell }, 2);
      if (s.board[cell] === 'x') s = regionsReduce(s, { type: 'TAP', cell }, 3);
    }
    expect(s.status).toBe('lost');
    const gc = s.mistakes + 1;
    const out = regionsElsewhere(rowOf(regionsMatchRow(s), false, gc, s.hintsUsed), daily(false, gc));
    expect(out.progress).toEqual({ boardsSolved: 0, totalBoards: 1, hintsUsed: s.hintsUsed });
    expect(viaCard('REGIONS', false, gc, out.progress)).toBe(local('REGIONS', false, gc, 0, 1, s.hintsUsed));
    expect(out.state?.board).toBe(s.board);
  });

  it('win: hinted all the way', () => {
    let s = createRegionsState(p, 0);
    for (let i = 0; i < 8 && s.status === 'playing'; i++) s = regionsReduce(s, { type: 'HINT' }, 1);
    expect(s.status).toBe('won');
    const out = regionsElsewhere(rowOf(regionsMatchRow(s), true, 1, s.hintsUsed), daily(true, 1));
    expect(viaCard('REGIONS', true, 1, out.progress)).toBe(local('REGIONS', true, 1, 1, 1, s.hintsUsed));
  });
});

describe('Letter Ladder', () => {
  it('win: hinted rungs count as moves and hints', () => {
    const p = ladderPuzzleForSeed(ladderBankJson as LadderBank, 'unlimited-LADDER-1')!;
    let s = createLadderState(p, SEED, 0);
    for (let i = 0; i < 20 && s.status === 'playing'; i++) s = ladderReduce(s, { type: 'HINT' }, new Set<string>(), 1);
    expect(s.status).toBe('won');
    const gc = ladderGuessCount(s);
    const out = ladderElsewhere(rowOf(ladderMatchRow(s), true, gc, s.hintsUsed), daily(true, gc), p.id);
    expect(out.progress).toEqual({ boardsSolved: 1, totalBoards: 1, hintsUsed: s.hintsUsed });
    expect(viaCard('LADDER', true, gc, out.progress)).toBe(local('LADDER', true, gc, 1, 1, s.hintsUsed));
    expect(out.state?.words).toEqual(s.words);
    expect(out.state?.moves).toBe(s.moves);
  });
});

describe('Hubbub', () => {
  const p = hubPuzzleForSeed(hubBankJson as HubBank, 'unlimited-HUB-1')!;

  it('loss: ended below Hubbub with a Starts-with and a Reveal', () => {
    let s = createHubState(p, SEED, 0);
    s = hubReduce(s, { type: 'SUBMIT', word: p.words[0] }, 1);
    s = hubReduce(s, { type: 'HINT_START' }, 2);
    s = hubReduce(s, { type: 'HINT_REVEAL' }, 3);
    s = hubReduce(s, { type: 'END' }, 4);
    expect(s.status).toBe('lost');
    const gc = hubGuessCount(hubRank(s));
    const boards = hubBoardsSolved(s.points, s.max);
    const out = hubElsewhere(rowOf(hubMatchRow(s), false, gc, s.hintsUsed), daily(false, gc), p);
    expect(out.progress).toEqual({ boardsSolved: boards, totalBoards: HUB_TOTAL_BOARDS, hintsUsed: s.hintsUsed });
    expect(viaCard('HUB', false, gc, out.progress!)).toBe(local('HUB', false, gc, boards, HUB_TOTAL_BOARDS, s.hintsUsed));
    expect(out.state?.points).toBe(s.points);
    expect(out.state?.found).toEqual(s.found);
  });

  it('win: words until Hubbub, then the rank the card scores is the row it read', () => {
    let s = createHubState(p, SEED, 0);
    for (const w of p.words) { if (s.status === 'won') break; s = hubReduce(s, { type: 'SUBMIT', word: w }, 1); }
    expect(s.status).toBe('won');
    const gc = hubGuessCount(hubRank(s));
    const boards = hubBoardsSolved(s.points, s.max);
    const out = hubElsewhere(rowOf(hubMatchRow(s), true, gc, 0), daily(true, gc), p);
    expect(viaCard('HUB', true, gc, out.progress!)).toBe(local('HUB', true, gc, boards, HUB_TOTAL_BOARDS, 0));
  });
});

describe('Codebreaker', () => {
  const p = cryptogramPuzzleForSeed(cryptogramBankJson as unknown as CryptogramBank, 'unlimited-CRYPTOGRAM-1')!;

  it('loss: a check, a hint, then Reveal', () => {
    let s = createCryptogramState(p, SEED, 0);
    const code = cryptogramCodeLetters(s.cipher).find((c) => !s.locked.includes(c))!;
    s = cryptogramReduce(s, { type: 'SET', code, plain: cryptogramPlainFor(code, s.key) }, 1);
    s = cryptogramReduce(s, { type: 'CHECK' }, 2);
    s = cryptogramReduce(s, { type: 'HINT' }, 3);
    s = cryptogramReduce(s, { type: 'REVEAL' }, 4);
    expect(s.status).toBe('lost');
    const gc = cryptogramGuessCount(s.checks);
    const out = cryptogramElsewhere(rowOf(cryptogramMatchRow(s), false, gc, s.hintsUsed), daily(false, gc));
    expect(out.progress).toEqual({ boardsSolved: 0, totalBoards: CRYPTOGRAM_TOTAL_BOARDS, hintsUsed: s.hintsUsed });
    expect(viaCard('CRYPTOGRAM', false, gc, out.progress)).toBe(local('CRYPTOGRAM', false, gc, 0, CRYPTOGRAM_TOTAL_BOARDS, s.hintsUsed));
    expect(out.state?.text).toBe(s.text);
    expect(out.state?.checks).toBe(s.checks);
  });

  it('win: every letter penciled right', () => {
    let s = createCryptogramState(p, SEED, 0);
    for (const code of cryptogramCodeLetters(s.cipher)) if (!s.locked.includes(code)) s = cryptogramReduce(s, { type: 'SET', code, plain: cryptogramPlainFor(code, s.key) }, 1);
    expect(s.status).toBe('won');
    const gc = cryptogramGuessCount(s.checks);
    const out = cryptogramElsewhere(rowOf(cryptogramMatchRow(s), true, gc, 0), daily(true, gc));
    expect(viaCard('CRYPTOGRAM', true, gc, out.progress)).toBe(local('CRYPTOGRAM', true, gc, 1, CRYPTOGRAM_TOTAL_BOARDS, 0));
  });
});

describe('Kindred', () => {
  const p = groupsPuzzleForSeed(groupsBankJson as unknown as GroupsBank, 'unlimited-GROUPS-1')!;
  const tier = (t: number) => p.groups.find((g) => g.tier === t)!.words;
  const submit = (s: ReturnType<typeof createGroupsState>, words: string[]) => {
    s = groupsReduce(s, { type: 'DESELECT' }, 1);
    for (const w of words) s = groupsReduce(s, { type: 'TOGGLE', word: w }, 1);
    return groupsReduce(s, { type: 'SUBMIT' }, 2);
  };

  it('loss: one group found, a category named, four misses — the found group is the credit', () => {
    let s = createGroupsState(p, SEED, 0);
    s = submit(s, tier(1));
    s = groupsReduce(s, { type: 'HINT_LABEL' }, 3);
    const [a, b, c] = tier(2);
    for (const d of tier(3)) { if (s.status !== 'playing') break; s = submit(s, [a, b, c, d]); }
    expect(s.status).toBe('lost');
    const gc = groupsGuessCount(s);
    const out = groupsElsewhere(rowOf(groupsMatchRow(s), false, gc, s.hintsUsed), daily(false, gc));
    expect(out.progress).toEqual({ boardsSolved: 1, totalBoards: GROUPS_TOTAL_BOARDS, hintsUsed: s.hintsUsed });
    expect(out.progress.boardsSolved).toBe(groupsBoardsSolved(s));
    expect(viaCard('GROUPS', false, gc, out.progress)).toBe(local('GROUPS', false, gc, groupsBoardsSolved(s), GROUPS_TOTAL_BOARDS, s.hintsUsed));
    expect(out.solved.map((g) => g.tier)).toEqual([1]);
    expect(out.unsolved.map((g) => g.tier).sort()).toEqual([2, 3, 4]);
    // The old card assumed zero groups on a loss; the founder's report was exactly this gap.
    expect(viaCard('GROUPS', false, gc, out.progress)).not.toBe(local('GROUPS', false, gc, 0, GROUPS_TOTAL_BOARDS, 0));
  });

  it('win: all four in four', () => {
    let s = createGroupsState(p, SEED, 0);
    for (const t of [1, 2, 3, 4]) s = submit(s, tier(t));
    expect(s.status).toBe('won');
    const gc = groupsGuessCount(s);
    const out = groupsElsewhere(rowOf(groupsMatchRow(s), true, gc, 0), daily(true, gc));
    expect(viaCard('GROUPS', true, gc, out.progress)).toBe(local('GROUPS', true, gc, 4, GROUPS_TOTAL_BOARDS, 0));
  });
});

describe('Crosswordocious', () => {
  const p = crosswordPuzzleForSeed(crosswordBankJson as unknown as CrosswordBank, 'unlimited-CROSSWORD-1')!;

  it('loss: a check, a letter, two words, then Reveal all — hints_used wins over the folded log', () => {
    let s = createCrosswordState(p, SEED, 0);
    const [e0, e1, e2] = s.entries;
    const cells = crosswordEntryCells(s, e0);
    s = crosswordReduce(s, { type: 'SET', cell: cells[0], letter: e0.answer[0] }, 1);
    s = crosswordReduce(s, { type: 'CHECK' }, 2);
    s = crosswordReduce(s, { type: 'REVEAL_LETTER', cell: cells[1] }, 3);
    s = crosswordReduce(s, { type: 'REVEAL_WORD', n: e1.n, dir: e1.dir }, 4);
    s = crosswordReduce(s, { type: 'REVEAL_WORD', n: e2.n, dir: e2.dir }, 5);
    s = crosswordReduce(s, { type: 'REVEAL_PUZZLE' }, 6);
    expect(s.status).toBe('lost');
    const gc = crosswordGuessCount(s.checks);
    const out = crosswordElsewhere(rowOf(crosswordMatchRow(s), false, gc, s.hintsUsed), daily(false, gc), p);
    expect(out.progress).toEqual({ boardsSolved: 0, totalBoards: CROSSWORD_TOTAL_BOARDS, hintsUsed: s.hintsUsed });
    expect(viaCard('CROSSWORD', false, gc, out.progress)).toBe(local('CROSSWORD', false, gc, 0, CROSSWORD_TOTAL_BOARDS, s.hintsUsed));
    expect(out.state?.fill).toBe(s.fill);
    expect(out.state?.entries.length).toBe(s.entries.length);
  });

  it('win: every cell set', () => {
    let s = createCrosswordState(p, SEED, 0);
    for (let i = 0; i < s.solution.length && s.status === 'playing'; i++) if (s.solution[i] !== CROSSWORD_BLOCK) s = crosswordReduce(s, { type: 'SET', cell: i, letter: s.solution[i] }, 1);
    expect(s.status).toBe('won');
    const gc = crosswordGuessCount(s.checks);
    const out = crosswordElsewhere(rowOf(crosswordMatchRow(s), true, gc, 0), daily(true, gc), p);
    expect(viaCard('CROSSWORD', true, gc, out.progress)).toBe(local('CROSSWORD', true, gc, 1, CROSSWORD_TOTAL_BOARDS, 0));
  });
});

describe('Muddle', () => {
  const p = scramblePuzzleForSeed(scrambleBankJson as unknown as ScrambleBank, 'unlimited-SCRAMBLE-1')!;
  const typeWord = (s: ScrambleState, row: number, word: string) => { for (const ch of word) s = scrambleReduce(s, { type: 'TYPE', row, letter: ch }, 7); return s; };

  it('loss: two rows solved (one by hint), a letter revealed, thirteen checks — two rows are the credit', () => {
    let s = createScrambleState(p, SEED, 0);
    s = typeWord(s, 0, scrambleTarget(s, 0));
    s = scrambleReduce(s, { type: 'SOLVE_WORD', row: 1 }, 8);
    s = scrambleReduce(s, { type: 'REVEAL_LETTER', row: 2 }, 9);
    const w = p.words[3];
    const wrong = w.scramble === w.answer ? [...w.answer].reverse().join('') : w.scramble;
    for (let i = 0; i < 20 && s.status === 'playing'; i++) { s = scrambleReduce(s, { type: 'CLEAR', row: 3 }, 10); s = typeWord(s, 3, wrong); }
    expect(s.status).toBe('lost');
    const gc = scrambleGuessCount(s);
    const boards = scrambleBoardsSolved(s);
    expect(boards).toBe(2);
    const out = scrambleElsewhere(rowOf(scrambleMatchRow(s), false, gc, s.hintsUsed), daily(false, gc), p);
    expect(out.progress).toEqual({ boardsSolved: 2, totalBoards: SCRAMBLE_TOTAL_BOARDS, hintsUsed: s.hintsUsed });
    expect(viaCard('SCRAMBLE', false, gc, out.progress)).toBe(local('SCRAMBLE', false, gc, boards, SCRAMBLE_TOTAL_BOARDS, s.hintsUsed));
    expect(out.state?.solved).toEqual(s.solved);
    expect(out.state?.entries.slice(0, 2)).toEqual(s.entries.slice(0, 2));
  });

  it('win: every row, then the punchline', () => {
    let s = createScrambleState(p, SEED, 0);
    for (let row = 0; row < 5; row++) s = typeWord(s, row, scrambleTarget(s, row));
    expect(s.status).toBe('won');
    const gc = scrambleGuessCount(s);
    const out = scrambleElsewhere(rowOf(scrambleMatchRow(s), true, gc, 0), daily(true, gc), p);
    expect(viaCard('SCRAMBLE', true, gc, out.progress)).toBe(local('SCRAMBLE', true, gc, 5, SCRAMBLE_TOTAL_BOARDS, 0));
  });
});

describe('ProperNoundle', () => {
  const answer = 'napoleon';
  // The rows exactly as the game builds them: a clue row (all hint-used, word ""),
  // a vowel row (the revealed vowel 'correct' at each of its slots, "_" elsewhere),
  // and real guesses through evaluateGuess.
  const clueRow: Guess = { word: '', tiles: Array(8).fill('hint-used') as TileState[] };
  const vowelRow: Guess = { word: '___o__o_', tiles: [...answer].map((c) => (c === 'o' ? 'correct' : 'hint-used')) as TileState[] };
  const guessRow = (w: string): Guess => ({ word: w, tiles: evaluateGuess(w, answer) });
  const best = (rows: Guess[]) => rows.reduce((b, g) => Math.max(b, g.tiles.filter((t) => t === 'correct').length), 0);
  const rowFor = (rows: Guess[], won: boolean) => ({ guesses: rows.map((g) => g.word), solutions: [answer], won, guessCount: rows.length, timeSeconds: TIME, hintsUsed: 2 });

  it('loss: six rows with two hints — the near-miss credit is the same best-green count', () => {
    const rows = [guessRow('marianne'), clueRow, vowelRow, guessRow('napoleum'), guessRow('polonium'), guessRow('nelsonia')];
    const out = propernoundleElsewhere(rowFor(rows, false), daily(false, 6))!;
    expect(out.progress).toEqual({ boardsSolved: 0, totalBoards: 1, hintsUsed: 2, bestCorrectLetters: best(rows) });
    expect(viaCard('PROPERNOUNDLE', false, 6, out.progress)).toBe(local('PROPERNOUNDLE', false, 6, 0, 1, 2, best(rows)));
    expect(out.rows.map((r) => r.tiles)).toEqual(rows.map((r) => r.tiles));
    // Hint rows are recounted from their placeholder shape when hints_used is missing.
    expect(propernoundleElsewhere({ ...rowFor(rows, false), hintsUsed: 0 }, daily(false, 6))!.progress.hintsUsed).toBe(2);
  });

  it('win: the answer on the fourth row', () => {
    const rows = [guessRow('marianne'), clueRow, vowelRow, guessRow('napoleon')];
    const out = propernoundleElsewhere(rowFor(rows, true), daily(true, 4))!;
    expect(viaCard('PROPERNOUNDLE', true, 4, out.progress)).toBe(local('PROPERNOUNDLE', true, 4, 1, 1, 2, best(rows)));
  });
});
