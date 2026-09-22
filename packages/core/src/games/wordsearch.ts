import { bankIndexForDay, bankIndexForSeed, bankDayIndex } from '../bank';

/**
 * Spyglass — themed word search (More Games §17). Ten words hidden in a 10 × 10
 * grid; the daily hides them in four FORWARD directions (E, S, SE, NE) so
 * nothing reads backwards. The bank (apps/web/data/wordsearch-puzzles.json,
 * bundled on every platform and sha-guarded) carries the grid, the title and
 * each word's placement, so the engine never searches: a selection is checked
 * against the letters it covers.
 *
 * Rules (§17): a selection is a straight line of cells in any of the eight
 * directions; it finds a word when its letters spell a list word forwards or
 * backwards. A MISS is a straight line of ≥ 4 cells that spells no list word
 * (shorter or crooked drags are free — fat-finger tolerance). Finding every
 * word wins. Hint pulses the first letter of the next unfound word (a score
 * cost, never a miss). Reveal (the UI offers it after five minutes) records a
 * loss with the words found so far. guess_count = min(10 + misses, 15) with
 * boards_solved = words found of 10, so a clean clear ranks purely by time.
 *
 * Parity-critical: Wordsearch.swift / Wordsearch.kt reproduce this exactly and
 * wordsearch-fixtures.json pins all three. Event strings start with a
 * non-letter sigil (§11): "+WORD" found, "x r,c>r,c" miss, "?WORD" hint, "!" reveal.
 */

export const WORDSEARCH_DAILY_EPOCH = '2026-09-23';
export const WORDSEARCH_N = 10;
export const WORDSEARCH_WORDS = 10;
export const WORDSEARCH_MAX_MISSES = 5;
export const WORDSEARCH_MIN_MISS_LENGTH = 4;

export const WORDSEARCH_DIRS: Record<string, [number, number]> = {
  E: [0, 1], S: [1, 0], SE: [1, 1], NE: [-1, 1], W: [0, -1], N: [-1, 0], NW: [-1, -1], SW: [1, -1],
};

export interface WordsearchPlacement { w: string; r: number; c: number; d: string }

export interface WordsearchPuzzle {
  id: string;
  theme: string;
  family: string;
  title: string;
  /** n*n uppercase letters, row-major. */
  grid: string;
  words: WordsearchPlacement[];
}

export interface WordsearchBank {
  version: number;
  epoch: string;
  daily: WordsearchPuzzle[];
  extra: WordsearchPuzzle[];
}

export function wordsearchPuzzleForDay(bank: WordsearchBank, day: string): WordsearchPuzzle | null {
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}

export function wordsearchPuzzleForSeed(bank: WordsearchBank, seed: string): WordsearchPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}

export function wordsearchDailyNumber(day: string): number {
  const idx = bankDayIndex(day, WORDSEARCH_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Geometry ───────────────────────────────────────────────────────────────

/** The cells a placement covers, in reading order of the word. */
export function wordsearchCells(n: number, p: WordsearchPlacement): number[] {
  const [dr, dc] = WORDSEARCH_DIRS[p.d] ?? [0, 1];
  return Array.from({ length: p.w.length }, (_, k) => (p.r + dr * k) * n + (p.c + dc * k));
}

/**
 * The straight line of cells from `from` to `to` (inclusive) when the two lie
 * on a row, column or 45° diagonal; null when they do not (a crooked drag).
 */
export function wordsearchLine(n: number, from: number, to: number): number[] | null {
  if (from < 0 || to < 0 || from >= n * n || to >= n * n) return null;
  const r0 = Math.floor(from / n), c0 = from % n, r1 = Math.floor(to / n), c1 = to % n;
  const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
  const len = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0)) + 1;
  if (dr !== 0 && dc !== 0 && Math.abs(r1 - r0) !== Math.abs(c1 - c0)) return null;
  return Array.from({ length: len }, (_, k) => (r0 + dr * k) * n + (c0 + dc * k));
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type WordsearchStatus = 'playing' | 'won' | 'lost';

export interface WordsearchState {
  seed: string;
  id: string;
  title: string;
  n: number;
  grid: string;
  words: WordsearchPlacement[];
  /** List words found so far, in the order found. */
  found: string[];
  misses: number;
  hintsUsed: number;
  /** Words whose first letter has been pulsed by a Hint. */
  hinted: string[];
  events: string[];
  status: WordsearchStatus;
  startTime: number;
  endTime: number | null;
}

export type WordsearchAction =
  | { type: 'SELECT'; from: number; to: number }
  | { type: 'HINT' }
  | { type: 'REVEAL' }
  | { type: 'FINISH' };

export function createWordsearchState(puzzle: WordsearchPuzzle, seed: string, startTime: number): WordsearchState {
  return {
    seed, id: puzzle.id, title: puzzle.title, n: WORDSEARCH_N, grid: puzzle.grid, words: puzzle.words,
    found: [], misses: 0, hintsUsed: 0, hinted: [], events: [], status: 'playing', startTime, endTime: null,
  };
}

/** guess_count for the result row: 10 clean, +1 per miss, capped at 15. */
export function wordsearchGuessCount(s: { misses: number }): number {
  return Math.min(WORDSEARCH_WORDS + WORDSEARCH_MAX_MISSES, WORDSEARCH_WORDS + Math.max(0, s.misses));
}

/** The first list word not yet found, in list order (the Hint target). */
export function wordsearchNextUnfound(s: WordsearchState): WordsearchPlacement | null {
  return s.words.find((p) => !s.found.includes(p.w) && !s.hinted.includes(p.w))
    ?? s.words.find((p) => !s.found.includes(p.w)) ?? null;
}

export function wordsearchReduce(s: WordsearchState, a: WordsearchAction, now = 0): WordsearchState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.status !== 'playing') return s;

  switch (a.type) {
    case 'SELECT': {
      const line = wordsearchLine(s.n, a.from, a.to);
      if (!line) return s;
      const letters = line.map((i) => s.grid[i]).join('');
      const reversed = letters.split('').reverse().join('');
      const hit = s.words.find((p) => p.w === letters || p.w === reversed);
      if (hit) {
        if (s.found.includes(hit.w)) return s;
        const found = [...s.found, hit.w];
        const won = found.length === s.words.length;
        return { ...s, found, events: [...s.events, `+${hit.w}`], status: won ? 'won' : 'playing', endTime: won ? now : null };
      }
      if (line.length < WORDSEARCH_MIN_MISS_LENGTH) return s;
      const r0 = Math.floor(a.from / s.n), c0 = a.from % s.n, r1 = Math.floor(a.to / s.n), c1 = a.to % s.n;
      return { ...s, misses: s.misses + 1, events: [...s.events, `x ${r0},${c0}>${r1},${c1}`] };
    }
    case 'HINT': {
      const target = s.words.find((p) => !s.found.includes(p.w) && !s.hinted.includes(p.w));
      if (!target) return s;
      return { ...s, hinted: [...s.hinted, target.w], hintsUsed: s.hintsUsed + 1, events: [...s.events, `?${target.w}`] };
    }
    case 'REVEAL':
      return { ...s, status: 'lost', endTime: now, events: [...s.events, '!'] };
    default:
      return s;
  }
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/** What we store: solutions = ["g:<grid>", "t:<title>", "WORD@r,c,d" ×10]; guesses = the event log. */
export function wordsearchMatchRow(s: WordsearchState): { solutions: string[]; guesses: string[] } {
  return {
    solutions: [`g:${s.grid}`, `t:${s.title}`, ...s.words.map((p) => `${p.w}@${p.r},${p.c},${p.d}`)],
    guesses: [...s.events],
  };
}

export interface WordsearchReconstruction {
  grid: string; title: string; words: WordsearchPlacement[];
  found: string[]; misses: number; hintsUsed: number; revealed: boolean; solved: boolean;
}

export function reconstructWordsearch(solutions: string[] | null | undefined, guesses: string[] | null | undefined): WordsearchReconstruction | null {
  if (!solutions || solutions.length < 3) return null;
  const g = solutions[0], t = solutions[1];
  if (!g.startsWith('g:') || !t.startsWith('t:')) return null;
  const grid = g.slice(2);
  if (grid.length !== WORDSEARCH_N * WORDSEARCH_N || !/^[A-Z]+$/.test(grid)) return null;
  const words: WordsearchPlacement[] = [];
  for (const field of solutions.slice(2)) {
    const m = field.match(/^([A-Z]{2,})@(\d+),(\d+),(NE|NW|SE|SW|N|S|E|W)$/);
    if (m) words.push({ w: m[1], r: Number(m[2]), c: Number(m[3]), d: m[4] });
  }
  if (!words.length) return null;
  const found: string[] = []; let misses = 0, hintsUsed = 0, revealed = false;
  for (const ev of guesses ?? []) {
    if (ev === '!') { revealed = true; continue; }
    const sigil = ev[0], rest = ev.slice(1);
    if (sigil === '+' && words.some((p) => p.w === rest) && !found.includes(rest)) found.push(rest);
    else if (sigil === 'x') misses++;
    else if (sigil === '?') hintsUsed++;
  }
  return { grid, title: t.slice(2), words, found, misses, hintsUsed, revealed, solved: found.length === words.length };
}
