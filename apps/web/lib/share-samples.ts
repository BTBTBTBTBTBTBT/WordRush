// Sample share inputs for every game card (founder 10-06: "the game's title art
// is cut off at the top of the share card"). Pure data: share-fit.test.ts checks
// that every card's title box sits fully inside the canvas, and
// docs/design/share/render.mjs draws each one into docs/design/share/out/ so the
// cards can be looked at side by side. Boards are the biggest each game draws
// (full Classic / OctoWord / Gauntlet runs, 9 × 9 Starsweep, revealed losses).

import { GameStatus } from '@wordle-duel/core';
import type { ShareImageInput, TileStateString } from './share-image';
import type { VsShareInput } from './vs-share-image';

const C: TileStateString = 'CORRECT';
const P: TileStateString = 'PRESENT';
const A: TileStateString = 'ABSENT';
const E: TileStateString = 'EMPTY';

/** A board solved on guess `solvedAt` (rows padded with EMPTY to `rows`). */
function board(cols: number, rows: number, solvedAt: number | null): TileStateString[][] {
  const used = solvedAt ?? rows;
  return Array.from({ length: rows }, (_, r) => {
    if (r >= used) return Array.from({ length: cols }, () => E);
    if (solvedAt !== null && r === used - 1) return Array.from({ length: cols }, () => C);
    return Array.from({ length: cols }, (_, c) => ((r + c) % 3 === 0 ? C : (r * c) % 4 === 1 ? P : A));
  });
}

const DATE = new Date('2026-10-06T12:00:00');

const sudokuGivens = '530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const sudokuBoard = '534678912672195348198342567859761423426853791713924856961537284287419635345286179';

export interface ShareSample {
  /** File stem in docs/design/share/out/. */
  id: string;
  input: ShareImageInput;
}

export const SHARE_SAMPLES: ShareSample[] = [
  { id: 'classic-4of6', input: { layout: 'single', mode: 'Classic', won: true, guesses: 4, maxGuesses: 6, timeSeconds: 94, grid: board(5, 6, 4), date: DATE } },
  { id: 'classic-loss-reveal', input: { layout: 'single', mode: 'Classic', won: false, guesses: 6, maxGuesses: 6, timeSeconds: 201, grid: board(5, 6, null), date: DATE, reveal: true, letters: board(5, 6, null).map((r) => r.map(() => 'A')), solutionDisplay: 'CRANE' } },
  { id: 'six', input: { layout: 'single', mode: 'Six', won: true, guesses: 5, maxGuesses: 7, timeSeconds: 160, grid: board(6, 7, 5), date: DATE } },
  { id: 'seven', input: { layout: 'single', mode: 'Seven', won: true, guesses: 6, maxGuesses: 8, timeSeconds: 240, grid: board(7, 8, 6), date: DATE } },
  { id: 'propernoundle', input: { layout: 'single', mode: 'ProperNoundle', won: true, guesses: 3, maxGuesses: 6, timeSeconds: 75, grid: board(12, 6, 3), wordGroups: [6, 6], category: 'Sports', date: DATE } },
  { id: 'quadword', input: { layout: 'multi', mode: 'QuadWord', won: true, guesses: 8, maxGuesses: 9, timeSeconds: 330, boards: [3, 5, 7, 8].map((s) => ({ grid: board(5, 9, s), won: true })), boardsSolved: 4, totalBoards: 4, date: DATE } },
  { id: 'octoword', input: { layout: 'multi', mode: 'OctoWord', won: false, guesses: 13, maxGuesses: 13, timeSeconds: 610, boards: [3, 5, 6, 8, 9, 11, 12, null].map((s) => ({ grid: board(5, 13, s), won: s !== null })), boardsSolved: 7, totalBoards: 8, date: DATE } },
  { id: 'succession', input: { layout: 'multi', mode: 'Succession', won: true, guesses: 9, maxGuesses: 10, timeSeconds: 420, boards: [2, 5, 7, 9].map((s) => ({ grid: board(5, 10, s), won: true })), boardsSolved: 4, totalBoards: 4, date: DATE } },
  { id: 'deliverance', input: { layout: 'single', mode: 'Deliverance', won: true, guesses: 2, maxGuesses: 6, timeSeconds: 55, grid: board(5, 6, 5), date: DATE } },
  {
    id: 'gauntlet',
    input: {
      layout: 'gauntlet', mode: 'Gauntlet', won: true, guesses: 41, maxGuesses: 0, timeSeconds: 1500, date: DATE,
      stages: [
        { name: 'Classic', status: GameStatus.WON, guesses: 4, boardsSolved: 1, totalBoards: 1 },
        { name: 'QuadWord', status: GameStatus.WON, guesses: 8, boardsSolved: 4, totalBoards: 4 },
        { name: 'Succession', status: GameStatus.WON, guesses: 9, boardsSolved: 4, totalBoards: 4 },
        { name: 'Deliverance', status: GameStatus.WON, guesses: 7, boardsSolved: 4, totalBoards: 4 },
        { name: 'OctoWord', status: GameStatus.WON, guesses: 13, boardsSolved: 8, totalBoards: 8 },
      ],
      stagesCompleted: 5, totalStages: 5,
    },
  },
  { id: 'sudocious', input: { layout: 'sudoku', mode: 'Sudocious', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 238, givens: sudokuGivens, board: sudokuBoard, hintMask: '0'.repeat(81), mistakes: 0, difficulty: 'Medium', puzzleNumber: 183, date: DATE } },
  {
    id: 'starsweep',
    input: {
      layout: 'regions', mode: 'Starsweep', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 130, n: 9, mistakes: 0, sizeLabel: '9 × 9', puzzleNumber: 183, date: DATE,
      regions: Array.from({ length: 81 }, (_, i) => String(Math.floor((i % 9) / 3) + 3 * Math.floor(Math.floor(i / 9) / 3))).join(''),
      board: Array.from({ length: 81 }, (_, i) => ((i * 7) % 9 === Math.floor(i / 9) % 9 && i % 11 === 0 ? '*' : '.')).join(''),
      hintMask: '0'.repeat(81),
    },
  },
  { id: 'letter-ladder', input: { layout: 'ladder', mode: 'Letter Ladder', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 130, start: 'COLD', end: 'WARM', words: ['COLD', 'CORD', 'CARD', 'WARD', 'WARM'], hintMask: '00000', par: 4, moves: 4, puzzleNumber: 183, date: DATE } },
  {
    id: 'spyglass',
    input: {
      layout: 'wordsearch', mode: 'Spyglass', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 165, n: 10, misses: 1, title: 'Fruits', puzzleNumber: 183, date: DATE,
      words: [{ w: 'APPLE', r: 0, c: 0, d: 'E' }, { w: 'MANGO', r: 2, c: 1, d: 'S' }, { w: 'PEAR', r: 9, c: 3, d: 'E' }, { w: 'KIWI', r: 4, c: 6, d: 'SE' }],
      found: ['APPLE', 'MANGO', 'PEAR', 'KIWI'],
    },
  },
  { id: 'hubbub', input: { layout: 'hub', mode: 'Hubbub', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 600, rankName: 'Uproar', pct: 72, wordsFound: 18, wordCount: 40, pangramsFound: 1, puzzleNumber: 183, date: DATE } },
  { id: 'codebreaker', input: { layout: 'cryptogram', mode: 'Codebreaker', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 125, cipher: 'QEB NRFZH YOLTK CLU GRJMP LSBO QEB IXWV ALD, XKA QEBK QEB ALD QLLH X KXM.', checks: 0, puzzleNumber: 183, date: DATE } },
  { id: 'kindred', input: { layout: 'groups', mode: 'Kindred', won: false, guesses: 0, maxGuesses: 0, timeSeconds: 130, solvedTiers: [1, 3], mistakes: 4, maxMistakes: 4, puzzleNumber: 183, date: DATE } },
  {
    id: 'crosswordocious',
    input: {
      layout: 'crossword', mode: 'Crosswordocious', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 200, w: 7, h: 7, checks: 0, puzzleNumber: 183, date: DATE,
      solution: Array.from({ length: 49 }, (_, i) => ([3, 10, 17, 24, 31, 38, 45, 15, 33].includes(i) ? '.' : 'A')).join(''),
    },
  },
  { id: 'muddle', input: { layout: 'scramble', mode: 'Muddle', won: true, guesses: 0, maxGuesses: 0, timeSeconds: 112, words: [{ length: 5, circled: [0, 2] }, { length: 5, circled: [1] }, { length: 6, circled: [0, 3, 5] }, { length: 6, circled: [2, 4] }], pattern: [3, 5], checks: 5, solvedCount: 4, puzzleNumber: 183, date: DATE } },
  {
    id: 'daily-sweep',
    input: {
      layout: 'daily-sweep', mode: 'Classic', flawless: false, total: 9, won: 8, totalGuesses: 60, totalTimeSeconds: 3100, totalScore: 8420, date: DATE,
      games: (['Classic', 'QuadWord', 'OctoWord', 'Succession', 'Deliverance', 'Gauntlet', 'ProperNoundle', 'Six', 'Seven'] as const).map((mode, i) => ({
        mode, modeLabel: mode, won: i !== 2, guesses: 4 + i, timeSeconds: 90 + i * 40, score: 900 + i * 10,
      })),
    },
  },
];

/** The VS head-to-head (Classic VS, 6 rows each side). */
export const VS_SHARE_SAMPLE: VsShareInput = {
  modeLabel: 'VS CLASSIC',
  isWin: true,
  isDraw: false,
  me: { name: 'Bram', score: 1240, won: true, solved: true, grids: [board(5, 6, 4)] },
  opponent: { name: 'Juniper', score: 860, won: false, solved: false, grids: [board(5, 6, null)] },
};
