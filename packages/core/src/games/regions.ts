// ============================================================
// Starsweep — region-placement logic puzzle (More Games §18b)
// ============================================================
// Generic id `regions` / `REGIONS`; display name Starsweep. An N×N board split
// into N regions: place exactly one star in every row, every column and every
// region; no two stars may touch, not even diagonally.
//
// The web source of truth — a 1:1 port of the Phase 0 sample generator
// (apps/web/scripts/regions/generate.mjs); Regions.swift and Regions.kt port
// this file and all three are pinned by regions-fixtures.json. Everything is
// integer arithmetic over mulberry32(simpleHash(...)), so the same seed yields
// the same board on every platform.
//
// Strings: `regions` is n*n chars, region index per cell ('0'..); `solution` is
// n chars, the star's column per row; `board` is n*n chars: '.' empty, 'x'
// crossed out, '*' star.

import { mulberry32, simpleHash } from '../seed';
import { bankDayIndex } from '../bank';

export type RegionsSize = 7 | 8 | 9;
/** Third wrong star = loss. */
export const REGIONS_MAX_MISTAKES = 3;
/** The first daily Starsweep's local date — "#1". Purely cosmetic numbering. */
export const REGIONS_DAILY_EPOCH = '2026-09-23';
const MAX_REROLLS = 400;
const HISTORY_CAP = 200;

export interface RegionsPuzzle {
  seed: string;
  n: number;
  regions: string;
  solution: string;
  sizes: number[];
  rerolls: number;
}

// ── PRNG helpers (rng call ORDER is the parity contract) ─────────────────

type Rng = () => number;
const below = (rng: Rng, n: number): number => rng() % n;
function shuffle<T>(rng: Rng, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = below(rng, i + 1);
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Orthogonal neighbors, in the fixed order up, down, left, right. */
export function regionsN4(n: number, i: number): number[] {
  const r = Math.floor(i / n), c = i % n, o: number[] = [];
  if (r) o.push(i - n);
  if (r < n - 1) o.push(i + n);
  if (c) o.push(i - 1);
  if (c < n - 1) o.push(i + 1);
  return o;
}

// ── Generator ────────────────────────────────────────────────────────────

/** One star per row, distinct columns, adjacent rows' columns differ by ≥ 2. */
function layout(n: number, rng: Rng): number[] | null {
  const cols: number[] = [];
  const go = (r: number): boolean => {
    if (r === n) return true;
    for (const c of shuffle(rng, Array.from({ length: n }, (_, k) => k))) {
      if (cols.includes(c) || (r > 0 && Math.abs(cols[r - 1] - c) < 2)) continue;
      cols.push(c);
      if (go(r + 1)) return true;
      cols.pop();
    }
    return false;
  };
  return go(0) ? cols : null;
}

/** Regions grown outward from each star, uneven appetites → varied sizes. */
function grow(n: number, cols: number[], rng: Rng): number[] {
  const reg = new Array<number>(n * n).fill(-1);
  cols.forEach((c, r) => { reg[r * n + c] = r; });
  const weight = cols.map(() => 1 + below(rng, 4));
  for (let left = n * n - n; left > 0;) {
    const k = below(rng, n);
    if (below(rng, 4) >= weight[k]) continue;
    const edge: number[] = [];
    reg.forEach((v, i) => { if (v === k) for (const j of regionsN4(n, i)) if (reg[j] < 0) edge.push(j); });
    if (!edge.length) continue;
    reg[edge[below(rng, edge.length)]] = k;
    left--;
  }
  return reg;
}

/** Number of solutions (stopping at `limit`); `keep` collects them as column lists. */
export function countRegionsSolutions(n: number, reg: number[], limit = 2, keep: number[][] | null = null): number {
  const usedC = new Array(n).fill(false), usedR = new Array(n).fill(false), cur: number[] = [];
  let count = 0;
  const go = (r: number): void => {
    if (r === n) { count++; if (keep) keep.push(cur.slice()); return; }
    for (let c = 0; c < n && count < limit; c++) {
      const g = reg[r * n + c];
      if (usedC[c] || usedR[g] || (r > 0 && Math.abs(cur[r - 1] - c) < 2)) continue;
      usedC[c] = usedR[g] = true; cur.push(c);
      go(r + 1);
      cur.pop(); usedC[c] = usedR[g] = false;
    }
  };
  go(0);
  return count;
}

/** Is region k still one connected piece when cell `without` is taken away (-1 = none)? */
function connected(n: number, reg: number[], k: number, without: number): boolean {
  const cells: number[] = [];
  reg.forEach((v, i) => { if (v === k && i !== without) cells.push(i); });
  if (!cells.length) return false;
  const seen = new Set<number>([cells[0]]), q = [cells[0]];
  while (q.length) {
    const cur = q.pop() as number;
    for (const j of regionsN4(n, cur)) if (reg[j] === k && j !== without && !seen.has(j)) { seen.add(j); q.push(j); }
  }
  return seen.size === cells.length;
}

/**
 * The board for a seed and size. Deterministic; re-rolls with `-r<k>` when a
 * layout fails, the repair cannot reach one solution, or the sizes are ugly.
 * Returns null only if 400 attempts all fail (never seen in practice).
 */
export function generateRegions(seed: string, n: number): RegionsPuzzle | null {
  for (let k = 0; k < MAX_REROLLS; k++) {
    const rng = mulberry32(simpleHash(`${seed}-regions-v1${k ? `-r${k}` : ''}`));
    const cols = layout(n, rng);
    if (!cols) continue;
    const reg = grow(n, cols, rng);
    // Repair: find a rival solution and hand one of its cells to a neighboring
    // region (connectivity preserved) so it breaks; repeat until unique.
    for (let step = 0; step < 60 && countRegionsSolutions(n, reg) > 1; step++) {
      const all: number[][] = [];
      countRegionsSolutions(n, reg, 2, all);
      const rival = all.find((s) => s.some((c, r) => c !== cols[r]));
      if (!rival) break;
      const moves: Array<[number, number]> = [];
      rival.forEach((c, r) => {
        const i = r * n + c;
        if (c === cols[r]) return;
        for (const j of regionsN4(n, i)) if (reg[j] !== reg[i] && connected(n, reg, reg[i], i)) moves.push([i, reg[j]]);
      });
      if (!moves.length) break;
      const [i, to] = moves[below(rng, moves.length)];
      reg[i] = to;
    }
    const sizes = new Array(n).fill(0);
    reg.forEach((v) => sizes[v]++);
    if (countRegionsSolutions(n, reg) !== 1 || sizes.filter((s) => s <= 2).length > 1 || Math.max(...sizes) > n * 2
      || sizes.some((_, g) => !connected(n, reg, g, -1))) continue;
    // Relabel regions in reading order so colors are assigned predictably.
    const order: number[] = [];
    for (const v of reg) if (!order.includes(v)) order.push(v);
    return {
      seed, n, rerolls: k,
      regions: reg.map((v) => order.indexOf(v)).join(''),
      solution: cols.join(''),
      sizes: order.map((g) => sizes[g]),
    };
  }
  return null;
}

/** Daily board size: 7×7 Monday–Wednesday, 8×8 Thursday–Sunday (local day string). */
export function regionsSizeForDay(day: string): RegionsSize {
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return 8;
  const dow = new Date(t).getUTCDay(); // 0 = Sunday
  return dow >= 1 && dow <= 3 ? 7 : 8;
}

/** Size encoded in an Unlimited seed's trailing segment (`-7`/`-8`/`-9`); default 8. */
export function regionsSizeForSeed(seed: string): RegionsSize {
  const tail = seed.split('-').pop();
  return tail === '7' ? 7 : tail === '9' ? 9 : 8;
}

/** "#N" for the daily on `day`; 1 on the epoch day, never below 1. */
export function regionsDailyNumber(day: string): number {
  const idx = bankDayIndex(day, REGIONS_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Reducer ──────────────────────────────────────────────────────────────

export type RegionsStatus = 'playing' | 'won' | 'lost';
/** '.' empty, 'x' crossed, 'o' a black (pending, unjudged) star, '*' a committed star (purple, or red if in wrongMask). */
export type RegionsCell = '.' | 'x' | 'o' | '*';

export interface RegionsSnapshot {
  board: string;
  hintMask: string;
  wrongMask: string;
  /** '1' where an × was drawn by Auto-cross (not by hand); those are withdrawn when the star that drew them goes. */
  autoMask: string;
}

export interface RegionsState extends RegionsSnapshot {
  seed: string;
  n: number;
  regions: string;
  solution: string;
  mistakes: number;
  hintsUsed: number;
  /** Placing a star (black or purple) crosses out its row, column, region and neighbors. */
  autoCross: boolean;
  status: RegionsStatus;
  history: RegionsSnapshot[];
  startTime: number;
  endTime: number | null;
}

export type RegionsAction =
  | { type: 'TAP'; cell: number }        // empty → black star → × → empty; a committed star → ×
  | { type: 'COMMIT'; cell: number }     // double tap: judge the star (purple or red); on an empty cell, place and judge
  | { type: 'ERASE'; cell: number }
  | { type: 'UNDO' }
  | { type: 'HINT'; cell?: number }
  | { type: 'SET_AUTO_CROSS'; value: boolean }
  | { type: 'SETTLE' }                   // re-check win/loss (a restored save that is already solved finishes)
  | { type: 'FINISH'; now: number };

export function createRegionsState(puzzle: RegionsPuzzle, startTime: number): RegionsState {
  const blank = '.'.repeat(puzzle.n * puzzle.n);
  return {
    seed: puzzle.seed, n: puzzle.n, regions: puzzle.regions, solution: puzzle.solution,
    board: blank, hintMask: '0'.repeat(puzzle.n * puzzle.n), wrongMask: '0'.repeat(puzzle.n * puzzle.n), autoMask: '0'.repeat(puzzle.n * puzzle.n),
    mistakes: 0, hintsUsed: 0, autoCross: true, status: 'playing', history: [], startTime, endTime: null,
  };
}

/** A save from before black stars (no autoMask) → every existing × counts as hand-placed. */
export function normalizeRegionsState(s: RegionsState): RegionsState {
  const blank = '0'.repeat(s.n * s.n);
  const fix = <T extends RegionsSnapshot>(x: T): T => (typeof x.autoMask === 'string' && x.autoMask.length === s.n * s.n ? x : { ...x, autoMask: blank });
  return { ...fix(s), history: (s.history ?? []).map(fix) };
}

const setChar = (s: string, i: number, ch: string) => s.slice(0, i) + ch + s.slice(i + 1);
const isStarCell = (s: RegionsState, i: number) => s.solution.charCodeAt(Math.floor(i / s.n)) - 48 === i % s.n;

function snapshot(s: RegionsState): RegionsSnapshot { return { board: s.board, hintMask: s.hintMask, wrongMask: s.wrongMask, autoMask: s.autoMask }; }
function pushHistory(s: RegionsState): RegionsSnapshot[] {
  const h = s.history.concat([snapshot(s)]);
  return h.length > HISTORY_CAP ? h.slice(h.length - HISTORY_CAP) : h;
}

/** Cells a correct star rules out: its row, column, region and the eight neighbors. */
export function regionsRuledOut(n: number, regions: string, cell: number): number[] {
  const r = Math.floor(cell / n), c = cell % n, g = regions[cell];
  const out = new Set<number>();
  for (let k = 0; k < n; k++) { out.add(r * n + k); out.add(k * n + c); }
  for (let i = 0; i < n * n; i++) if (regions[i] === g) out.add(i);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.add(rr * n + cc);
  }
  out.delete(cell);
  return Array.from(out).sort((a, b) => a - b);
}

/** Auto-cross: × every still-empty cell in `cells`, marking them as auto-drawn. */
function crossOut(board: string, autoMask: string, cells: number[]): { board: string; autoMask: string } {
  let b = board, m = autoMask;
  for (const i of cells) if (b[i] === '.') { b = setChar(b, i, 'x'); m = setChar(m, i, '1'); }
  return { board: b, autoMask: m };
}

/** A star that rules cells out: a black star, or a purple (correct, committed) one. Red stars rule nothing out. */
const isRulingStar = (board: string, wrongMask: string, i: number) =>
  board[i] === 'o' || (board[i] === '*' && wrongMask[i] === '0');

/**
 * Withdraw auto-drawn ×s that no remaining star rules out (founder, 2026-09-28: a star that
 * turns red or is erased takes its ×s with it). Hand-placed ×s and ×s another star still
 * justifies stay.
 */
function withdrawCrosses(s: RegionsState, board: string, autoMask: string, wrongMask: string): { board: string; autoMask: string } {
  const keep = new Set<number>();
  for (let i = 0; i < s.n * s.n; i++) if (isRulingStar(board, wrongMask, i)) for (const c of regionsRuledOut(s.n, s.regions, i)) keep.add(c);
  let b = board, m = autoMask;
  for (let i = 0; i < s.n * s.n; i++) if (m[i] === '1' && b[i] === 'x' && !keep.has(i)) { b = setChar(b, i, '.'); m = setChar(m, i, '0'); }
  return { board: b, autoMask: m };
}

/** Black stars left on the board when the game ends are cleared (they were never played). */
const clearPending = (board: string) => board.replace(/o/g, '.');

/**
 * Solved = every row's star is played. A red star left on the board does not block the win
 * (founder, 2026-09-28: two red stars stayed after the last correct star, so the board never
 * finished) — its mistake is already counted.
 */
function isSolved(s: RegionsState): boolean {
  for (let r = 0; r < s.n; r++) if (s.board[r * s.n + (s.solution.charCodeAt(r) - 48)] !== '*') return false;
  return true;
}

function settle(s: RegionsState, now: number): RegionsState {
  if (s.status !== 'playing') return s;
  if (isSolved(s)) return { ...s, board: clearPending(s.board), status: 'won', endTime: now, history: [] };
  if (s.mistakes >= REGIONS_MAX_MISTAKES) return { ...s, board: clearPending(s.board), status: 'lost', endTime: now, history: [] };
  return s;
}

/** Commit (judge) a star at `cell` — from empty, from a black star, or via a hint. */
function placeStar(s: RegionsState, cell: number, viaHint: boolean, now: number): RegionsState {
  const correct = isStarCell(s, cell);
  const wrongMask = setChar(s.wrongMask, cell, correct ? '0' : '1');
  let board = setChar(s.board, cell, '*');
  let autoMask = setChar(s.autoMask, cell, '0');
  if (correct && s.autoCross) ({ board, autoMask } = crossOut(board, autoMask, regionsRuledOut(s.n, s.regions, cell)));
  // A red star rules nothing out: whatever it drew as a black star goes.
  if (!correct) ({ board, autoMask } = withdrawCrosses(s, board, autoMask, wrongMask));
  const next: RegionsState = {
    ...s,
    history: pushHistory(s),
    board,
    autoMask,
    hintMask: viaHint ? setChar(s.hintMask, cell, '1') : s.hintMask,
    wrongMask,
    mistakes: s.mistakes + (correct ? 0 : 1),
    hintsUsed: s.hintsUsed + (viaHint ? 1 : 0),
  };
  return settle(next, now);
}

/** Set `cell` to `ch` ('.' or 'x', by hand), withdrawing any ×s a star there had drawn. */
function clearTo(s: RegionsState, cell: number, ch: '.' | 'x'): RegionsState {
  const wrongMask = setChar(s.wrongMask, cell, '0');
  const r = withdrawCrosses(s, setChar(s.board, cell, ch), setChar(s.autoMask, cell, '0'), wrongMask);
  return { ...s, history: pushHistory(s), board: r.board, autoMask: r.autoMask, wrongMask };
}

/** Pure reducer; `now` stamps endTime on a win/loss. */
export function regionsReduce(s: RegionsState, a: RegionsAction, now = 0): RegionsState {
  if (a.type === 'SET_AUTO_CROSS') return { ...s, autoCross: a.value };
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? a.now };
  if (s.status !== 'playing') return s;
  const total = s.n * s.n;
  if (a.type === 'SETTLE') return settle(s, now);

  switch (a.type) {
    case 'TAP': {
      if (a.cell < 0 || a.cell >= total) return s;
      const cur = s.board[a.cell];
      // Tap = a BLACK star (founder, 2026-09-28 afternoon: nothing is judged until you
      // double-tap); it auto-crosses like a real star so you can see what it rules out.
      // Tap a black star = × (your own "no star here"), tap an × = clear. A committed star
      // tapped becomes an × (a red star's red goes; the mistake stands). A hint star is locked.
      if (cur === '*' && s.hintMask[a.cell] === '1') return s;
      if (cur === '.') {
        let board = setChar(s.board, a.cell, 'o'), autoMask = setChar(s.autoMask, a.cell, '0');
        if (s.autoCross) ({ board, autoMask } = crossOut(board, autoMask, regionsRuledOut(s.n, s.regions, a.cell)));
        return { ...s, history: pushHistory(s), board, autoMask };
      }
      if (cur === 'o' || cur === '*') return clearTo(s, a.cell, 'x');
      return clearTo(s, a.cell, '.');
    }
    case 'COMMIT': {
      // Double tap: judge the star — purple and it stays, red is a mistake and its ×s go.
      if (a.cell < 0 || a.cell >= total) return s;
      const cur = s.board[a.cell];
      if (cur === 'o' || cur === '.') return placeStar(s, a.cell, false, now);
      return s;
    }
    case 'ERASE': {
      if (a.cell < 0 || a.cell >= total || s.board[a.cell] === '.') return s;
      if (s.board[a.cell] === '*' && s.hintMask[a.cell] === '1') return s;
      return clearTo(s, a.cell, '.');
    }
    case 'UNDO': {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return { ...s, ...prev, history: s.history.slice(0, -1) };
    }
    case 'HINT': {
      // The star of the tapped cell's row, else the first row without its star.
      const rowStar = (r: number) => r * s.n + (s.solution.charCodeAt(r) - 48);
      let target = -1;
      if (a.cell !== undefined && a.cell >= 0 && a.cell < total) {
        const t = rowStar(Math.floor(a.cell / s.n));
        if (s.board[t] !== '*') target = t;
      }
      if (target < 0) for (let r = 0; r < s.n; r++) { const t = rowStar(r); if (s.board[t] !== '*') { target = t; break; } }
      if (target < 0) return s;
      return placeStar(s, target, true, now);
    }
  }
  return s;
}

/** Correct stars still to place (for the progress line). */
export function regionsRemaining(s: RegionsState): number {
  let n = 0;
  for (let r = 0; r < s.n; r++) if (s.board[r * s.n + (s.solution.charCodeAt(r) - 48)] !== '*') n++;
  return n;
}

// ── Matches row ↔ state ─────────────────────────────────────────────────

/** What we store: solutions = [regionsNN, solutionN]; guesses = [boardNN, hintMaskNN]. */
export function regionsMatchRow(s: RegionsState): { solutions: string[]; guesses: string[] } {
  return { solutions: [s.regions, s.solution], guesses: [s.board, s.hintMask] };
}

export interface RegionsReconstruction { n: number; regions: string; solution: string; board: string; hintMask: string; solved: boolean }

/** The solved-board view from a matches row (cross-device), or null if malformed. */
export function reconstructRegions(solutions: unknown, guesses: unknown): RegionsReconstruction | null {
  const sol = Array.isArray(solutions) ? solutions : [];
  const g = Array.isArray(guesses) ? guesses : [];
  const regions = typeof sol[0] === 'string' ? sol[0] : '';
  const solution = typeof sol[1] === 'string' ? sol[1] : '';
  const n = solution.length;
  if (n < 4 || n > 12 || regions.length !== n * n || !/^[0-9]+$/.test(regions) || !/^[0-9]+$/.test(solution)) return null;
  const board = typeof g[0] === 'string' && g[0].length === n * n ? g[0] : '.'.repeat(n * n);
  const hintMask = typeof g[1] === 'string' && g[1].length === n * n ? g[1] : '0'.repeat(n * n);
  let solved = true;
  for (let r = 0; r < n; r++) if (board[r * n + (solution.charCodeAt(r) - 48)] !== '*') solved = false;
  return { n, regions, solution, board, hintMask, solved };
}
