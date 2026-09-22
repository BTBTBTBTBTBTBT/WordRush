import { bankIndexForDay, bankIndexForSeed, bankDayIndex } from '../bank';

/**
 * Letter Ladder — word ladder (More Games §15). Change one letter at a time
 * from START to END; every rung must be a legal 5-letter guess. The bank
 * (apps/web/data/ladder-puzzles.json, bundled on every platform and
 * sha-guarded) carries {start, end, par, path}; par is the shortest route
 * through common answer words and cannot be beaten with an obscure word.
 *
 * Rules (§15): rejected entries (not a word, more than one letter changed,
 * revisiting a rung) are FREE. Every accepted word is a move; the budget is
 * par + 5 moves, reaching that without arriving loses. Undo is free but spent
 * moves stay spent. A Hint places the next word on a shortest path from the
 * current rung (BFS over the allowed list with an alphabetical tie-break) and
 * counts as a move. guess_count = moves − par + 1, so par reads as 1 and the
 * existing scoring formula (LADDER config: maxGuesses 6) applies unchanged.
 *
 * Parity-critical: Ladder.swift / Ladder.kt reproduce this exactly and
 * ladder-fixtures.json pins all three. Every event string starts with a
 * non-letter sigil (§11) so word-frequency stats never count a rung.
 */

export const LADDER_DAILY_EPOCH = '2026-09-23';
export const LADDER_EXTRA_MOVES = 5;
export const LADDER_WORD_LENGTH = 5;

export interface LadderPuzzle {
  id: string;
  start: string;
  end: string;
  par: number;
  /** One shortest route through answer words (the reveal on a loss). */
  path: string[];
}

export interface LadderBank {
  version: number;
  epoch: string;
  daily: LadderPuzzle[];
  extra: LadderPuzzle[];
}

/** The daily puzzle for `day` (YYYY-MM-DD), epoch-indexed; null for an empty bank. */
export function ladderPuzzleForDay(bank: LadderBank, day: string): LadderPuzzle | null {
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}

/** The Unlimited puzzle for a seed, drawn from `extra` so it can never spoil a daily. */
export function ladderPuzzleForSeed(bank: LadderBank, seed: string): LadderPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}

/** "#N" for the daily on `day`; 1 on the epoch day, never below 1. */
export function ladderDailyNumber(day: string): number {
  const idx = bankDayIndex(day, LADDER_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Word graph helpers ─────────────────────────────────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** True when a and b are the same length and differ in exactly one position. */
export function ladderOneLetterApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diff++; if (diff > 1) return false; }
  return diff === 1;
}

/** Every word in `allowed` one letter away from `w`, alphabetical. */
export function ladderNeighbours(w: string, allowed: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    for (const ch of LETTERS) {
      if (ch === w[i]) continue;
      const cand = w.slice(0, i) + ch + w.slice(i + 1);
      if (allowed.has(cand)) out.push(cand);
    }
  }
  out.sort();
  return out;
}

/**
 * The next rung on a shortest path from `current` to `end` over `allowed`,
 * never stepping onto a word in `avoid` (the rungs already used). BFS from
 * `end`; among current's neighbours one step closer, the alphabetically
 * first. Null when no route exists.
 */
export function ladderNextStep(current: string, end: string, allowed: ReadonlySet<string>, avoid: ReadonlySet<string> = new Set()): string | null {
  if (current === end) return null;
  if (ladderOneLetterApart(current, end)) return end;
  const usable = new Set<string>();
  for (const w of allowed) if (!avoid.has(w) || w === end) usable.add(w);
  usable.add(end);
  const dist = new Map<string, number>([[end, 0]]);
  let frontier = [end];
  while (frontier.length && !dist.has(current)) {
    const next: string[] = [];
    for (const u of frontier) {
      const du = dist.get(u)!;
      for (const v of ladderNeighbours(u, usable)) {
        if (!dist.has(v)) { dist.set(v, du + 1); next.push(v); }
      }
      // `current` itself is not in `usable` (it is a used rung) — reach it explicitly.
      if (ladderOneLetterApart(u, current) && !dist.has(current)) dist.set(current, du + 1);
    }
    frontier = next;
  }
  const dc = dist.get(current);
  if (dc === undefined) return null;
  const options = ladderNeighbours(current, usable).filter((v) => dist.get(v) === dc - 1);
  return options[0] ?? null;
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type LadderStatus = 'playing' | 'won' | 'lost';
export type LadderReject = 'finished' | 'length' | 'not-one-letter' | 'revisit' | 'not-word';

export interface LadderState {
  seed: string;
  id: string;
  start: string;
  end: string;
  par: number;
  path: string[];
  /** The ladder so far; words[0] is always start. */
  words: string[];
  /** One char per rung: '1' = placed by a Hint. */
  hintMask: string;
  /** Accepted words, hints included; undo never refunds one. */
  moves: number;
  hintsUsed: number;
  /** Replayable event log — "+WORD" accepted, "-" undo, "?WORD" hint (§11 sigils). */
  events: string[];
  status: LadderStatus;
  /** Why the last SUBMIT was refused (UI feedback); cleared by the next action. */
  reject: LadderReject | null;
  startTime: number;
  endTime: number | null;
}

export type LadderAction =
  | { type: 'SUBMIT'; word: string }
  | { type: 'UNDO' }
  | { type: 'HINT' }
  | { type: 'FINISH' };

export function createLadderState(puzzle: LadderPuzzle, seed: string, startTime: number): LadderState {
  return {
    seed, id: puzzle.id, start: puzzle.start, end: puzzle.end, par: puzzle.par, path: puzzle.path,
    words: [puzzle.start], hintMask: '0', moves: 0, hintsUsed: 0, events: [],
    status: 'playing', reject: null, startTime, endTime: null,
  };
}

export function ladderMaxMoves(s: { par: number }): number { return s.par + LADDER_EXTRA_MOVES; }
export function ladderCurrent(s: LadderState): string { return s.words[s.words.length - 1]; }
/** guess_count for the result row: par reads as 1, one over par as 2. Never below 1. */
export function ladderGuessCount(s: { moves: number; par: number }): number { return Math.max(1, s.moves - s.par + 1); }

function settle(s: LadderState, now: number): LadderState {
  if (s.status !== 'playing') return s;
  if (ladderCurrent(s) === s.end) return { ...s, status: 'won', endTime: now };
  if (s.moves >= ladderMaxMoves(s)) return { ...s, status: 'lost', endTime: now };
  return s;
}

function accept(s: LadderState, word: string, viaHint: boolean, now: number): LadderState {
  return settle({
    ...s,
    words: [...s.words, word],
    hintMask: s.hintMask + (viaHint ? '1' : '0'),
    moves: s.moves + 1,
    hintsUsed: s.hintsUsed + (viaHint ? 1 : 0),
    events: [...s.events, (viaHint ? '?' : '+') + word],
    reject: null,
  }, now);
}

/** Pure reducer; `allowed` is the uppercase 5-letter guess list; `now` stamps endTime. */
export function ladderReduce(s: LadderState, a: LadderAction, allowed: ReadonlySet<string>, now = 0): LadderState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.status !== 'playing') return a.type === 'SUBMIT' ? { ...s, reject: 'finished' } : s;

  switch (a.type) {
    case 'SUBMIT': {
      const word = a.word.toUpperCase();
      const cur = ladderCurrent(s);
      if (word.length !== LADDER_WORD_LENGTH || !/^[A-Z]+$/.test(word)) return { ...s, reject: 'length' };
      if (!ladderOneLetterApart(cur, word)) return { ...s, reject: 'not-one-letter' };
      if (s.words.includes(word)) return { ...s, reject: 'revisit' };
      if (word !== s.end && !allowed.has(word)) return { ...s, reject: 'not-word' };
      return accept(s, word, false, now);
    }
    case 'UNDO': {
      if (s.words.length <= 1) return { ...s, reject: null };
      return { ...s, words: s.words.slice(0, -1), hintMask: s.hintMask.slice(0, -1), events: [...s.events, '-'], reject: null };
    }
    case 'HINT': {
      const cur = ladderCurrent(s);
      const next = ladderNextStep(cur, s.end, allowed, new Set(s.words))
        ?? nextOnCanonicalPath(s);
      if (!next) return { ...s, reject: null };
      return accept(s, next, true, now);
    }
    default:
      return s;
  }
}

/** Fallback when the dictionary offers no route: the canonical path's next rung, if the player is on it. */
function nextOnCanonicalPath(s: LadderState): string | null {
  const i = s.path.indexOf(ladderCurrent(s));
  if (i < 0 || i + 1 >= s.path.length) return null;
  const next = s.path[i + 1];
  return s.words.includes(next) ? null : next;
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/** What we store: solutions = [START, END, "par:N", "path:A,B,C"]; guesses = the event log. */
export function ladderMatchRow(s: LadderState): { solutions: string[]; guesses: string[] } {
  return { solutions: [s.start, s.end, `par:${s.par}`, `path:${s.path.join(',')}`], guesses: [...s.events] };
}

export interface LadderReconstruction {
  start: string; end: string; par: number; path: string[];
  words: string[]; hintMask: string; moves: number; hintsUsed: number; solved: boolean;
}

/** Replay a matches row into the finished ladder, or null if malformed. */
export function reconstructLadder(solutions: string[] | null | undefined, guesses: string[] | null | undefined): LadderReconstruction | null {
  if (!solutions || solutions.length < 3) return null;
  const [start, end, parField] = solutions;
  if (!/^[A-Z]{5}$/.test(start) || !/^[A-Z]{5}$/.test(end)) return null;
  const par = Number((parField ?? '').replace(/^par:/, ''));
  if (!Number.isInteger(par) || par < 1) return null;
  const pathField = solutions[3] ?? '';
  const path = pathField.startsWith('path:') && pathField.length > 5 ? pathField.slice(5).split(',') : [start, end];
  const words = [start]; let hintMask = '0'; let moves = 0; let hintsUsed = 0;
  for (const ev of guesses ?? []) {
    if (ev === '-') { if (words.length > 1) { words.pop(); hintMask = hintMask.slice(0, -1); } continue; }
    const sigil = ev[0], word = ev.slice(1);
    if ((sigil !== '+' && sigil !== '?') || !/^[A-Z]{5}$/.test(word)) continue;
    words.push(word); hintMask += sigil === '?' ? '1' : '0'; moves++;
    if (sigil === '?') hintsUsed++;
  }
  return { start, end, par, path, words, hintMask, moves, hintsUsed, solved: words[words.length - 1] === end };
}
