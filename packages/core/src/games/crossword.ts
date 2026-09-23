import { bankIndexForDay, bankIndexForSeed, bankDayIndex, bankHolidayPick, type HolidayTable } from '../bank';

/**
 * Crosswordocious — themed fill-in sayings crossword (More Games §13). A sparse
 * criss-cross grid (10–13 entries, at most 10 × 11 cells) where every clue is a
 * familiar phrase with one blank and the answer is the missing word; the title
 * is the theme (most answers fit it, a few are other sayings — nothing on the
 * board marks which). Tap a cell or a clue, type; a fully correct grid wins.
 *
 * Costs: CHECK marks wrong letters (clears them), locks right ones, and counts
 * — guess_count = min(checks, 98) + 1 against the CROSSWORD budget of 6, so no
 * Check is perfect. Reveal a letter (1 hint, 60), reveal a word (2 hints, 120).
 * "Reveal puzzle" is the only loss. Event sigils (§11): "=r,c:L" set, "-r,c"
 * cleared, "#n" check with n wrong, "?r,c" letter revealed, "!nD" word
 * revealed (entry number + direction), "!!" puzzle revealed.
 *
 * Banks (apps/web/data/crossword-puzzles.json, bundled everywhere and
 * sha-guarded) carry { daily, extra, holiday: { key: [...] } } and the daily
 * on a holiday comes from that holiday's own grids (§20, holiday-days.json).
 *
 * Parity-critical: Crossword.swift / Crossword.kt reproduce this exactly;
 * crossword-fixtures.json pins all three.
 */

export const CROSSWORD_DAILY_EPOCH = '2026-09-23';
export const CROSSWORD_MAX_CHECKS = 98;
export const CROSSWORD_TOTAL_BOARDS = 1;
export const CROSSWORD_BLOCK = '.';
export const CROSSWORD_EMPTY = '_';

export type CrosswordDir = 'A' | 'D';
export interface CrosswordEntry { n: number; dir: CrosswordDir; r: number; c: number; answer: string; clue: string }
export interface CrosswordPuzzle { id: string; title: string; theme: string; w: number; h: number; entries: CrosswordEntry[]; holiday?: string }
export interface CrosswordBank { version: number; epoch: string; daily: CrosswordPuzzle[]; extra: CrosswordPuzzle[]; holiday?: Record<string, CrosswordPuzzle[]> }

export function crosswordPuzzleForDay(bank: CrosswordBank, day: string, holidays?: HolidayTable | null): CrosswordPuzzle | null {
  const pick = bankHolidayPick(day, holidays, bank.holiday);
  if (pick) return pick.entry;
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}
export function crosswordPuzzleForSeed(bank: CrosswordBank, seed: string): CrosswordPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}
export function crosswordDailyNumber(day: string): number {
  const idx = bankDayIndex(day, CROSSWORD_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Layout ─────────────────────────────────────────────────────────────────

/** Row-major index of a cell. */
export const crosswordIndex = (w: number, r: number, c: number): number => r * w + c;
/** The cells an entry occupies, in reading order. */
export function crosswordEntryCells(p: { w: number }, e: CrosswordEntry): number[] {
  const out: number[] = [];
  for (let k = 0; k < e.answer.length; k++) out.push(crosswordIndex(p.w, e.r + (e.dir === 'D' ? k : 0), e.c + (e.dir === 'A' ? k : 0)));
  return out;
}
/** The solution grid: w*h characters, "." for a block, the letter otherwise. */
export function crosswordSolution(p: CrosswordPuzzle): string {
  const cells = Array<string>(p.w * p.h).fill(CROSSWORD_BLOCK);
  for (const e of p.entries) crosswordEntryCells(p, e).forEach((i, k) => { cells[i] = e.answer[k]; });
  return cells.join('');
}
/** Entries that pass through a cell (an across and/or a down). */
export function crosswordEntriesAt(p: { w: number; entries: CrosswordEntry[] }, cell: number): CrosswordEntry[] {
  return p.entries.filter((e) => crosswordEntryCells(p, e).includes(cell));
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type CrosswordStatus = 'playing' | 'won' | 'lost';

export interface CrosswordState {
  seed: string;
  id: string;
  title: string;
  w: number;
  h: number;
  entries: CrosswordEntry[];
  solution: string;
  /** w*h chars: "." block, "_" empty, else the pencilled letter. */
  fill: string;
  /** w*h chars: "1" locked (checked right / revealed), "0" free, "." block. */
  locked: string;
  /** w*h chars: "l" letter revealed, "w" word revealed, "p" puzzle revealed, "." otherwise. */
  revealed: string;
  checks: number;
  hintsUsed: number;
  /** Cells the last Check cleared (for the red flash). */
  lastWrong: number[];
  events: string[];
  status: CrosswordStatus;
  ended: boolean;
  startTime: number;
  endTime: number | null;
}

export type CrosswordAction =
  | { type: 'SET'; cell: number; letter: string }
  | { type: 'CLEAR'; cell: number }
  | { type: 'CHECK' }
  | { type: 'REVEAL_LETTER'; cell: number }
  | { type: 'REVEAL_WORD'; n: number; dir: CrosswordDir }
  | { type: 'REVEAL_PUZZLE' }
  | { type: 'FINISH' };

const setChar = (s: string, i: number, ch: string) => s.slice(0, i) + ch + s.slice(i + 1);

export function createCrosswordState(p: CrosswordPuzzle, seed: string, startTime: number): CrosswordState {
  const solution = crosswordSolution(p);
  const blank = (open: string) => [...solution].map((ch) => (ch === CROSSWORD_BLOCK ? CROSSWORD_BLOCK : open)).join('');
  return {
    seed, id: p.id, title: p.title, w: p.w, h: p.h, entries: p.entries.map((e) => ({ ...e })), solution,
    fill: blank(CROSSWORD_EMPTY), locked: blank('0'), revealed: blank('.'), checks: 0, hintsUsed: 0, lastWrong: [], events: [],
    status: 'playing', ended: false, startTime, endTime: null,
  };
}

export function crosswordIsSolved(s: { fill: string; solution: string }): boolean { return s.fill === s.solution; }
export function crosswordCorrectCount(s: { fill: string; solution: string }): number {
  let n = 0;
  for (let i = 0; i < s.solution.length; i++) if (s.solution[i] !== CROSSWORD_BLOCK && s.fill[i] === s.solution[i]) n++;
  return n;
}
export function crosswordLetterCount(s: { solution: string }): number { return [...s.solution].filter((ch) => ch !== CROSSWORD_BLOCK).length; }
export function crosswordGuessCount(checks: number): number { return Math.min(checks, CROSSWORD_MAX_CHECKS) + 1; }
/** True when every cell of the entry is filled correctly. */
export function crosswordEntrySolved(s: CrosswordState, e: CrosswordEntry): boolean {
  return crosswordEntryCells(s, e).every((i) => s.fill[i] === s.solution[i]);
}
const cellOk = (s: CrosswordState, cell: number) => Number.isInteger(cell) && cell >= 0 && cell < s.solution.length && s.solution[cell] !== CROSSWORD_BLOCK;
const rc = (s: { w: number }, cell: number) => `${Math.floor(cell / s.w)},${cell % s.w}`;

function settle(s: CrosswordState, now: number): CrosswordState {
  if (s.status === 'playing' && crosswordIsSolved(s)) return { ...s, status: 'won', ended: true, endTime: now };
  return s;
}
function revealCells(s: CrosswordState, cells: number[], mark: string): CrosswordState {
  let fill = s.fill, locked = s.locked, revealed = s.revealed;
  for (const i of cells) {
    fill = setChar(fill, i, s.solution[i]);
    locked = setChar(locked, i, '1');
    if (revealed[i] === '.') revealed = setChar(revealed, i, mark);
  }
  return { ...s, fill, locked, revealed };
}

export function crosswordReduce(s: CrosswordState, a: CrosswordAction, now = 0): CrosswordState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.ended) return s;

  switch (a.type) {
    case 'SET': {
      const letter = a.letter.toUpperCase();
      if (!cellOk(s, a.cell) || s.locked[a.cell] === '1' || !/^[A-Z]$/.test(letter)) return s;
      if (s.fill[a.cell] === letter) return s;
      return settle({ ...s, fill: setChar(s.fill, a.cell, letter), lastWrong: [], events: [...s.events, `=${rc(s, a.cell)}:${letter}`] }, now);
    }
    case 'CLEAR': {
      if (!cellOk(s, a.cell) || s.locked[a.cell] === '1' || s.fill[a.cell] === CROSSWORD_EMPTY) return s;
      return { ...s, fill: setChar(s.fill, a.cell, CROSSWORD_EMPTY), lastWrong: [], events: [...s.events, `-${rc(s, a.cell)}`] };
    }
    case 'CHECK': {
      let fill = s.fill, locked = s.locked;
      const wrong: number[] = [];
      for (let i = 0; i < s.solution.length; i++) {
        if (s.solution[i] === CROSSWORD_BLOCK || s.fill[i] === CROSSWORD_EMPTY || s.locked[i] === '1') continue;
        if (s.fill[i] === s.solution[i]) locked = setChar(locked, i, '1');
        else { fill = setChar(fill, i, CROSSWORD_EMPTY); wrong.push(i); }
      }
      return { ...s, fill, locked, checks: s.checks + 1, lastWrong: wrong, events: [...s.events, `#${wrong.length}`] };
    }
    case 'REVEAL_LETTER': {
      if (!cellOk(s, a.cell) || (s.locked[a.cell] === '1' && s.fill[a.cell] === s.solution[a.cell])) return s;
      return settle({ ...revealCells(s, [a.cell], 'l'), hintsUsed: s.hintsUsed + 1, lastWrong: [], events: [...s.events, `?${rc(s, a.cell)}`] }, now);
    }
    case 'REVEAL_WORD': {
      const e = s.entries.find((x) => x.n === a.n && x.dir === a.dir);
      if (!e || crosswordEntrySolved(s, e)) return s;
      return settle({ ...revealCells(s, crosswordEntryCells(s, e), 'w'), hintsUsed: s.hintsUsed + 2, lastWrong: [], events: [...s.events, `!${e.n}${e.dir}`] }, now);
    }
    case 'REVEAL_PUZZLE': {
      const cells: number[] = [];
      for (let i = 0; i < s.solution.length; i++) if (s.solution[i] !== CROSSWORD_BLOCK) cells.push(i);
      return { ...revealCells(s, cells, 'p'), lastWrong: [], events: [...s.events, '!!'], status: 'lost', ended: true, endTime: now };
    }
    default:
      return s;
  }
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/**
 * solutions = [`${id}|${title}|${w}x${h}`, solutionGrid, ...answers in entry order];
 * guesses = ["=" + fill, "h" + revealed, "c" + checks].
 */
export function crosswordMatchRow(s: CrosswordState): { solutions: string[]; guesses: string[] } {
  return { solutions: [`${s.id}|${s.title}|${s.w}x${s.h}`, s.solution, ...s.entries.map((e) => e.answer)], guesses: [`=${s.fill}`, `h${s.revealed}`, `c${s.checks}`] };
}

export interface CrosswordReconstruction {
  id: string; title: string; w: number; h: number; solution: string; answers: string[];
  fill: string; revealed: string; checks: number; correct: number; total: number; hintsUsed: number; revealedPuzzle: boolean; solved: boolean;
}

export function reconstructCrossword(solutions: string[] | null | undefined, guesses: string[] | null | undefined): CrosswordReconstruction | null {
  if (!solutions || solutions.length < 3) return null;
  const head = solutions[0].split('|');
  if (head.length !== 3) return null;
  const dims = head[2].match(/^(\d+)x(\d+)$/);
  if (!dims) return null;
  const w = Number(dims[1]), h = Number(dims[2]), solution = solutions[1];
  if (!(w > 0 && h > 0) || solution.length !== w * h) return null;
  let fill = '', revealed = '', checks = 0;
  for (const g of guesses ?? []) {
    if (g[0] === '=' && g.length === solution.length + 1) fill = g.slice(1);
    else if (g[0] === 'h' && g.length === solution.length + 1) revealed = g.slice(1);
    else if (g[0] === 'c') checks = Math.max(0, Number(g.slice(1)) || 0);
  }
  if (!fill) fill = [...solution].map((ch) => (ch === CROSSWORD_BLOCK ? CROSSWORD_BLOCK : CROSSWORD_EMPTY)).join('');
  if (!revealed) revealed = [...solution].map(() => '.').join('');
  let hintsUsed = 0; const wordsRevealed = new Set<number>();
  for (let i = 0; i < revealed.length; i++) { if (revealed[i] === 'l') hintsUsed += 1; else if (revealed[i] === 'w') wordsRevealed.add(i); }
  const revealedPuzzle = revealed.includes('p');
  const total = crosswordLetterCount({ solution }), correct = crosswordCorrectCount({ fill, solution });
  return { id: head[0], title: head[1], w, h, solution, answers: solutions.slice(2), fill, revealed, checks, correct, total, hintsUsed: hintsUsed + (wordsRevealed.size ? 2 : 0), revealedPuzzle, solved: !revealedPuzzle && correct === total };
}
