// ============================================================
// Sudoku — deterministic generator, solver and reducer (More Games §4)
// ============================================================
// The web source of truth; apps/ios/Sources/Core/Sudoku.swift and
// apps/android/core/.../Sudoku.kt port it 1:1 and all three are pinned by
// sudoku-fixtures.json (regenerate with packages/core/scripts/gen-parity-fixtures.ts).
//
// Everything here is integer arithmetic over mulberry32(simpleHash(...)), so
// the same seed yields the same givens on every platform — the puzzle is
// generated on the device, never downloaded.
//
// Board strings are 81 chars, row-major, '0' = empty, '1'..'9' = digit.

import { mulberry32, simpleHash } from '../seed';

export type SudokuDifficulty = 'easy' | 'medium' | 'hard';

/** Clue targets: the digger stops removing once this many givens remain. */
export const SUDOKU_CLUES: Record<SudokuDifficulty, number> = { easy: 38, medium: 32, hard: 26 };
/** The daily is always Medium; Pro Unlimited picks. */
export const SUDOKU_DAILY_DIFFICULTY: SudokuDifficulty = 'medium';
/** Third wrong digit = loss. */
export const SUDOKU_MAX_MISTAKES = 3;
/** Bounded re-rolls when a difficulty gate fails. */
const MAX_REROLLS = 30;
const HISTORY_CAP = 200;

export interface SudokuPuzzle {
  seed: string;
  difficulty: SudokuDifficulty;
  /** 81 chars, '0' = empty. */
  givens: string;
  /** 81 chars, the unique solution. */
  solution: string;
  clues: number;
  /** How many attempts were discarded by the difficulty gate. */
  rerolls: number;
}

// ── PRNG helpers (rng call ORDER is the parity contract) ─────────────────

type Rng = () => number;
const randInt = (rng: Rng, n: number): number => rng() % n;
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

// ── Solved grid: base pattern + seeded permutations ─────────────────────

function solvedGrid(rng: Rng): number[] {
  // Shifted base pattern: row r is the sequence rotated by (r*3 + floor(r/3)).
  const base = (r: number, c: number) => ((r * 3 + Math.floor(r / 3) + c) % 9) + 1;
  const digits = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const bands = shuffle(rng, [0, 1, 2]);
  const rowsIn = [shuffle(rng, [0, 1, 2]), shuffle(rng, [0, 1, 2]), shuffle(rng, [0, 1, 2])];
  const stacks = shuffle(rng, [0, 1, 2]);
  const colsIn = [shuffle(rng, [0, 1, 2]), shuffle(rng, [0, 1, 2]), shuffle(rng, [0, 1, 2])];
  const transpose = randInt(rng, 2) === 1;
  const grid = new Array<number>(81);
  for (let r = 0; r < 9; r++) {
    const srcRow = bands[Math.floor(r / 3)] * 3 + rowsIn[Math.floor(r / 3)][r % 3];
    for (let c = 0; c < 9; c++) {
      const srcCol = stacks[Math.floor(c / 3)] * 3 + colsIn[Math.floor(c / 3)][c % 3];
      const v = digits[base(srcRow, srcCol) - 1];
      if (transpose) grid[c * 9 + r] = v; else grid[r * 9 + c] = v;
    }
  }
  return grid;
}

// ── Solver: bitmask candidates, MRV, solution counting ──────────────────

const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
const ALL = 0x1ff; // bits 0..8 = digits 1..9

/** Number of solutions, stopping at `limit`. `cells` is 0 for empty. */
export function countSudokuSolutions(cells: number[], limit = 2): number {
  const rows = new Array(9).fill(0), cols = new Array(9).fill(0), boxes = new Array(9).fill(0);
  const grid = cells.slice();
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    const r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
    if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return 0; // contradiction
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let count = 0;
  const popcount = (m: number) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const search = (): void => {
    if (count >= limit) return;
    // MRV: the empty cell with the fewest candidates; ties → lowest index.
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const mask = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]);
      const n = popcount(mask);
      if (n === 0) return;
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n === 1) break; }
    }
    if (best < 0) { count++; return; }
    const r = Math.floor(best / 9), c = best % 9, b = boxOf(best);
    for (let d = 0; d < 9; d++) {
      const bit = 1 << d;
      if (!(bestMask & bit)) continue;
      grid[best] = d + 1; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      search();
      grid[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  search();
  return count;
}

/** True when naked + hidden singles alone solve the puzzle (the Easy gate; Hard must fail it). */
export function sudokuSolvableBySingles(cells: number[]): boolean {
  const grid = cells.slice();
  const candidates = (i: number): number => {
    if (grid[i] !== 0) return 0;
    let used = 0;
    const r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
    for (let k = 0; k < 9; k++) {
      const rv = grid[r * 9 + k]; if (rv) used |= 1 << (rv - 1);
      const cv = grid[k * 9 + c]; if (cv) used |= 1 << (cv - 1);
      const bi = (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3);
      const bv = grid[bi]; if (bv) used |= 1 << (bv - 1);
    }
    return ALL & ~used;
  };
  const unitCells = (kind: number, u: number, k: number): number =>
    kind === 0 ? u * 9 + k : kind === 1 ? k * 9 + u : (Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3);
  let progress = true;
  while (progress) {
    progress = false;
    // Naked singles.
    for (let i = 0; i < 81; i++) {
      if (grid[i] !== 0) continue;
      const m = candidates(i);
      if (m === 0) return false;
      if ((m & (m - 1)) === 0) { grid[i] = 31 - Math.clz32(m) + 1; progress = true; }
    }
    // Hidden singles: a digit with exactly one home in a row / column / box.
    for (let kind = 0; kind < 3; kind++) {
      for (let u = 0; u < 9; u++) {
        for (let d = 0; d < 9; d++) {
          const bit = 1 << d;
          let where = -1, n = 0, placed = false;
          for (let k = 0; k < 9; k++) {
            const i = unitCells(kind, u, k);
            if (grid[i] === d + 1) { placed = true; break; }
            if (grid[i] === 0 && (candidates(i) & bit)) { where = i; n++; }
          }
          if (!placed && n === 1) { grid[where] = d + 1; progress = true; }
        }
      }
    }
  }
  return grid.every((v) => v !== 0);
}

// ── Generator ────────────────────────────────────────────────────────────

const toStr = (cells: number[]): string => cells.join('');
const fromStr = (s: string): number[] => Array.from(s, (ch) => ch.charCodeAt(0) - 48);

function attempt(seed: string, difficulty: SudokuDifficulty, k: number): { givens: number[]; solution: number[] } {
  const attemptSeed = k === 0 ? seed : `${seed}-r${k}`;
  const rng = mulberry32(simpleHash(`${attemptSeed}-sudoku-v1`));
  const solution = solvedGrid(rng);
  const target = SUDOKU_CLUES[difficulty];
  const order = shuffle(rng, Array.from({ length: 81 }, (_, i) => i));
  const givens = solution.slice();
  let clues = 81;
  for (const i of order) {
    if (clues <= target) break;
    const save = givens[i];
    givens[i] = 0;
    if (countSudokuSolutions(givens, 2) === 1) clues--;
    else givens[i] = save;
  }
  return { givens, solution };
}

function passesGate(givens: number[], difficulty: SudokuDifficulty): boolean {
  if (difficulty === 'medium') return true;
  const singles = sudokuSolvableBySingles(givens);
  return difficulty === 'easy' ? singles : !singles;
}

/**
 * The puzzle for a seed. Daily seed `daily-YYYY-MM-DD-SUDOKU` → Medium;
 * Unlimited `unlimited-SUDOKU-<ts>-<difficulty>` → the chosen difficulty.
 * Re-rolls with `${seed}-r${k}` until the difficulty gate passes (bounded).
 */
export function generateSudoku(seed: string, difficulty: SudokuDifficulty = SUDOKU_DAILY_DIFFICULTY): SudokuPuzzle {
  let last = attempt(seed, difficulty, 0);
  let k = 0;
  while (!passesGate(last.givens, difficulty) && k < MAX_REROLLS) {
    k++;
    last = attempt(seed, difficulty, k);
  }
  return {
    seed, difficulty,
    givens: toStr(last.givens), solution: toStr(last.solution),
    clues: last.givens.filter((v) => v !== 0).length,
    rerolls: k,
  };
}

/** Difficulty encoded in an Unlimited seed's trailing segment; the daily is Medium. */
export function sudokuDifficultyForSeed(seed: string): SudokuDifficulty {
  const tail = seed.split('-').pop();
  return tail === 'easy' || tail === 'hard' || tail === 'medium' ? tail : SUDOKU_DAILY_DIFFICULTY;
}

// ── Reducer ──────────────────────────────────────────────────────────────

export type SudokuStatus = 'playing' | 'won' | 'lost';

export interface SudokuSnapshot {
  board: string;
  /** 81 bitmasks; bit d−1 set = candidate d pencilled in. */
  notes: number[];
  /** 81 chars '0'/'1': cells filled by Hint. */
  hintMask: string;
  /** 81 chars '0'/'1': cells currently holding a wrong digit (drawn red). */
  wrongMask: string;
}

export interface SudokuState extends SudokuSnapshot {
  seed: string;
  difficulty: SudokuDifficulty;
  givens: string;
  solution: string;
  mistakes: number;
  hintsUsed: number;
  notesMode: boolean;
  /** Placing a digit removes it from the pencil marks of its row, column and box. */
  autoClearNotes: boolean;
  status: SudokuStatus;
  history: SudokuSnapshot[];
  startTime: number;
  endTime: number | null;
}

export type SudokuAction =
  | { type: 'PLACE'; cell: number; digit: number }
  | { type: 'ERASE'; cell: number }
  | { type: 'UNDO' }
  | { type: 'HINT'; cell?: number }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'NOTE_TOGGLE'; cell: number; digit: number }
  | { type: 'SET_AUTO_CLEAR'; value: boolean }
  | { type: 'FINISH'; now: number };

export function createSudokuState(puzzle: SudokuPuzzle, startTime: number): SudokuState {
  return {
    seed: puzzle.seed, difficulty: puzzle.difficulty, givens: puzzle.givens, solution: puzzle.solution,
    board: puzzle.givens, notes: new Array(81).fill(0), hintMask: '0'.repeat(81), wrongMask: '0'.repeat(81),
    mistakes: 0, hintsUsed: 0, notesMode: false, autoClearNotes: true,
    status: 'playing', history: [], startTime, endTime: null,
  };
}

const setChar = (s: string, i: number, ch: string) => s.slice(0, i) + ch + s.slice(i + 1);
const peers = (i: number): number[] => {
  const r = Math.floor(i / 9), c = i % 9, b = boxOf(i);
  const out = new Set<number>();
  for (let k = 0; k < 9; k++) {
    out.add(r * 9 + k); out.add(k * 9 + c);
    out.add((Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3));
  }
  out.delete(i);
  return Array.from(out).sort((a, z) => a - z);
};

function snapshot(s: SudokuState): SudokuSnapshot {
  return { board: s.board, notes: s.notes.slice(), hintMask: s.hintMask, wrongMask: s.wrongMask };
}
function pushHistory(s: SudokuState): SudokuSnapshot[] {
  const h = s.history.concat([snapshot(s)]);
  return h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h;
}
function clearPeerNotes(notes: number[], cell: number, digit: number): number[] {
  const bit = 1 << (digit - 1);
  const out = notes.slice();
  for (const p of peers(cell)) out[p] &= ~bit;
  return out;
}
function settle(s: SudokuState, now: number): SudokuState {
  if (s.status !== 'playing') return s;
  if (s.board === s.solution) return { ...s, status: 'won', endTime: now, history: [] };
  if (s.mistakes >= SUDOKU_MAX_MISTAKES) return { ...s, status: 'lost', endTime: now, history: [] };
  return s;
}

/**
 * Pure reducer. `now` stamps endTime on a win/loss (the caller's clock, so the
 * reducer itself stays deterministic for the fixtures).
 */
export function sudokuReduce(s: SudokuState, a: SudokuAction, now = 0): SudokuState {
  if (a.type === 'SET_AUTO_CLEAR') return { ...s, autoClearNotes: a.value };
  if (a.type === 'TOGGLE_NOTES') return { ...s, notesMode: !s.notesMode };
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? a.now };
  if (s.status !== 'playing') return s;

  switch (a.type) {
    case 'PLACE': {
      if (a.cell < 0 || a.cell > 80 || a.digit < 1 || a.digit > 9) return s;
      if (s.givens[a.cell] !== '0') return s;
      if (s.notesMode) return sudokuReduce(s, { type: 'NOTE_TOGGLE', cell: a.cell, digit: a.digit }, now);
      if (s.board[a.cell] === String(a.digit)) return s;
      const correct = s.solution[a.cell] === String(a.digit);
      let notes = s.notes.slice(); notes[a.cell] = 0;
      if (correct && s.autoClearNotes) notes = clearPeerNotes(notes, a.cell, a.digit);
      const next: SudokuState = {
        ...s,
        history: pushHistory(s),
        board: setChar(s.board, a.cell, String(a.digit)),
        notes,
        wrongMask: setChar(s.wrongMask, a.cell, correct ? '0' : '1'),
        mistakes: s.mistakes + (correct ? 0 : 1),
      };
      return settle(next, now);
    }
    case 'ERASE': {
      if (a.cell < 0 || a.cell > 80 || s.givens[a.cell] !== '0') return s;
      if (s.board[a.cell] === '0' && s.notes[a.cell] === 0) return s;
      const notes = s.notes.slice(); notes[a.cell] = 0;
      return {
        ...s, history: pushHistory(s),
        board: setChar(s.board, a.cell, '0'), notes,
        wrongMask: setChar(s.wrongMask, a.cell, '0'),
      };
    }
    case 'UNDO': {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return { ...s, ...prev, notes: prev.notes.slice(), history: s.history.slice(0, -1) };
    }
    case 'HINT': {
      const eligible = (i: number) => s.givens[i] === '0' && s.board[i] !== s.solution[i];
      let target = a.cell !== undefined && a.cell >= 0 && a.cell <= 80 && eligible(a.cell) ? a.cell : -1;
      if (target < 0) for (let i = 0; i < 81; i++) if (eligible(i)) { target = i; break; }
      if (target < 0) return s;
      const digit = s.solution.charCodeAt(target) - 48;
      let notes = s.notes.slice(); notes[target] = 0;
      if (s.autoClearNotes) notes = clearPeerNotes(notes, target, digit);
      const next: SudokuState = {
        ...s, history: pushHistory(s),
        board: setChar(s.board, target, String(digit)), notes,
        hintMask: setChar(s.hintMask, target, '1'),
        wrongMask: setChar(s.wrongMask, target, '0'),
        hintsUsed: s.hintsUsed + 1,
      };
      return settle(next, now);
    }
    case 'NOTE_TOGGLE': {
      if (a.cell < 0 || a.cell > 80 || a.digit < 1 || a.digit > 9) return s;
      if (s.givens[a.cell] !== '0' || s.board[a.cell] !== '0') return s;
      const notes = s.notes.slice(); notes[a.cell] ^= 1 << (a.digit - 1);
      return { ...s, history: pushHistory(s), notes };
    }
  }
  return s;
}

/** Cells left to fill (for the progress line). */
export function sudokuRemaining(s: SudokuState): number {
  let n = 0;
  for (let i = 0; i < 81; i++) if (s.board[i] !== s.solution[i]) n++;
  return n;
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/** What we store: solutions = [solution81, givens81]; guesses = [board81, hintMask81]. */
export function sudokuMatchRow(s: SudokuState): { solutions: string[]; guesses: string[] } {
  return { solutions: [s.solution, s.givens], guesses: [s.board, s.hintMask] };
}

export interface SudokuReconstruction { solution: string; givens: string; board: string; hintMask: string; solved: boolean }

/** The solved-puzzle view from a matches row (cross-device), or null if malformed. */
export function reconstructSudoku(solutions: unknown, guesses: unknown): SudokuReconstruction | null {
  const sol = Array.isArray(solutions) ? solutions : [];
  const g = Array.isArray(guesses) ? guesses : [];
  const solution = typeof sol[0] === 'string' ? sol[0] : '';
  const givens = typeof sol[1] === 'string' ? sol[1] : '';
  const board = typeof g[0] === 'string' && g[0].length === 81 ? g[0] : givens;
  const hintMask = typeof g[1] === 'string' && g[1].length === 81 ? g[1] : '0'.repeat(81);
  if (!/^[1-9]{81}$/.test(solution) || !/^[0-9]{81}$/.test(givens)) return null;
  return { solution, givens, board, hintMask, solved: board === solution };
}
