import { bankIndexForDay, bankIndexForSeed, bankDayIndex } from '../bank';

/**
 * Hubbub — seven-letter hub game (More Games §12). Seven letters, one required
 * center letter, words of 4+ letters, letters may repeat. 4 letters = 1 point,
 * longer words = their length, a pangram (all seven letters) +7. The bank
 * (apps/web/data/hub-puzzles.json, bundled everywhere and sha-guarded) freezes
 * each puzzle's accepted words: `words` (the core list) set `max`; `bonus` words
 * are the rarer accepted words. EVERY accepted word scores by the same rule
 * (founder, 2026-09-25: "make all words count … feel like every word helps");
 * only the ceiling comes from the core list, so Pandemonium never needs an
 * obscure word and points may pass max (the rank and boards_solved cap there).
 *
 * Ranks (integer maths, points*100 >= pct*max): Hush 0, Murmur 5, Chatter 12,
 * Banter 20, Clamor 30, Racket 40, HUBBUB 50 = solved, Uproar 70, Thunder 85,
 * Pandemonium 100. The game finalizes ONCE — on reaching Hubbub (won) or on
 * End (lost when below Hubbub) — and play continues after a win; each later
 * rank-up goes through the improve path (§11), never through recordGameResult
 * again. guess_count = rank position 1–10 (Pandemonium 1 … Hush 10);
 * boards_solved = floor(points × 20 / max) of 20; hints: "Starts with…" (1),
 * "Reveal a word" (2). Event sigils (§11): "+WORD" scored, "=WORD" bonus,
 * "?ST5" hint (first two letters + length), "!WORD" revealed, "#" ended.
 *
 * Parity-critical: Hub.swift / Hub.kt reproduce this exactly; hub-fixtures.json pins all three.
 */

export const HUB_DAILY_EPOCH = '2026-09-23';
export const HUB_LETTERS = 7;
export const HUB_MIN_WORD = 4;
export const HUB_TOTAL_BOARDS = 20;
export const HUB_SOLVED_RANK = 6;
export const HUB_RANKS: ReadonlyArray<{ name: string; pct: number }> = [
  { name: 'Hush', pct: 0 }, { name: 'Murmur', pct: 5 }, { name: 'Chatter', pct: 12 }, { name: 'Banter', pct: 20 },
  { name: 'Clamor', pct: 30 }, { name: 'Racket', pct: 40 }, { name: 'Hubbub', pct: 50 }, { name: 'Uproar', pct: 70 },
  { name: 'Thunder', pct: 85 }, { name: 'Pandemonium', pct: 100 },
];

export interface HubPuzzle {
  id: string;
  /** Seven distinct uppercase letters, the CENTER letter first. */
  letters: string;
  /** Scoring words, alphabetical. */
  words: string[];
  /** Accepted for 0 points, alphabetical. */
  bonus: string[];
  pangrams: string[];
  max: number;
}

export interface HubBank { version: number; epoch: string; daily: HubPuzzle[]; extra: HubPuzzle[] }

export function hubPuzzleForDay(bank: HubBank, day: string): HubPuzzle | null {
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}
export function hubPuzzleForSeed(bank: HubBank, seed: string): HubPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}
export function hubDailyNumber(day: string): number {
  const idx = bankDayIndex(day, HUB_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Scoring ────────────────────────────────────────────────────────────────

export function hubIsPangram(word: string, letters: string): boolean {
  for (const ch of letters) if (!word.includes(ch)) return false;
  return true;
}
export function hubWordScore(word: string, letters: string): number {
  return (word.length === 4 ? 1 : word.length) + (hubIsPangram(word, letters) ? 7 : 0);
}
/** Highest rank whose threshold the points meet (integer maths, never floats). */
export function hubRankIndex(points: number, max: number): number {
  if (max <= 0) return 0;
  let i = 0;
  for (let k = 0; k < HUB_RANKS.length; k++) if (points * 100 >= HUB_RANKS[k].pct * max) i = k;
  return i;
}
export function hubRankThreshold(rank: number, max: number): number {
  return Math.ceil((HUB_RANKS[rank].pct * max) / 100);
}
/** guess_count for the result row: Pandemonium 1 … Hush 10. */
export function hubGuessCount(rankIndex: number): number { return HUB_RANKS.length - rankIndex; }
export function hubBoardsSolved(points: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(HUB_TOTAL_BOARDS, Math.floor((points * HUB_TOTAL_BOARDS) / max));
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type HubStatus = 'playing' | 'won' | 'lost';
export type HubReject = 'ended' | 'short' | 'centre' | 'letters' | 'found' | 'notword';

export interface HubState {
  seed: string;
  id: string;
  letters: string;
  words: string[];
  bonus: string[];
  pangrams: string[];
  max: number;
  /** Scoring words found (typed or revealed), in order found. */
  found: string[];
  bonusFound: string[];
  /** Words placed by "Reveal a word" (a subset of found). */
  revealed: string[];
  /** Words whose "Starts with…" hint has been shown. */
  hinted: string[];
  points: number;
  hintsUsed: number;
  events: string[];
  status: HubStatus;
  /** True after End: no more play. */
  ended: boolean;
  reject: HubReject | null;
  startTime: number;
  endTime: number | null;
}

export type HubAction =
  | { type: 'SUBMIT'; word: string }
  | { type: 'HINT_START' }
  | { type: 'HINT_REVEAL' }
  | { type: 'END' }
  | { type: 'FINISH' };

export function createHubState(p: HubPuzzle, seed: string, startTime: number): HubState {
  return {
    seed, id: p.id, letters: p.letters, words: p.words, bonus: p.bonus, pangrams: p.pangrams, max: p.max,
    found: [], bonusFound: [], revealed: [], hinted: [], points: 0, hintsUsed: 0, events: [],
    status: 'playing', ended: false, reject: null, startTime, endTime: null,
  };
}

export function hubCentre(s: { letters: string }): string { return s.letters[0]; }
export function hubRank(s: { points: number; max: number }): number { return hubRankIndex(s.points, s.max); }
export function hubRankName(s: { points: number; max: number }): string { return HUB_RANKS[hubRank(s)].name; }
/** Next scoring word not yet found, alphabetical (hint target). */
export function hubNextUnfound(s: HubState, skipHinted = false): string | null {
  return s.words.find((w) => !s.found.includes(w) && (!skipHinted || !s.hinted.includes(w))) ?? null;
}
/** "ST5" — the first two letters and the length. */
export function hubStartsWithToken(word: string): string { return `${word.slice(0, 2)}${word.length}`; }

function settle(s: HubState, now: number): HubState {
  if (s.status === 'playing' && hubRank(s) >= HUB_SOLVED_RANK) return { ...s, status: 'won', endTime: now };
  return s;
}

export function hubReduce(s: HubState, a: HubAction, now = 0): HubState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.ended) return a.type === 'SUBMIT' ? { ...s, reject: 'ended' } : s;

  switch (a.type) {
    case 'SUBMIT': {
      const word = a.word.toUpperCase();
      if (word.length < HUB_MIN_WORD) return { ...s, reject: 'short' };
      if (!word.includes(hubCentre(s))) return { ...s, reject: 'centre' };
      for (const ch of word) if (!s.letters.includes(ch)) return { ...s, reject: 'letters' };
      if (s.found.includes(word) || s.bonusFound.includes(word)) return { ...s, reject: 'found' };
      if (s.words.includes(word)) {
        return settle({ ...s, found: [...s.found, word], points: s.points + hubWordScore(word, s.letters), events: [...s.events, `+${word}`], reject: null }, now);
      }
      // Founder (2026-09-25): EVERY accepted word scores by the same rule. Words off the core
      // list keep the "=" sigil (stats still know they were the rarer ones) but they earn their
      // points and can carry the player up the ranks — the ceiling stays the core list's max,
      // so Pandemonium never needs a rare word, and nothing a player finds is ever worth 0.
      if (s.bonus.includes(word)) {
        return settle({ ...s, bonusFound: [...s.bonusFound, word], points: s.points + hubWordScore(word, s.letters), events: [...s.events, `=${word}`], reject: null }, now);
      }
      return { ...s, reject: 'notword' };
    }
    case 'HINT_START': {
      const target = hubNextUnfound(s, true);
      if (!target) return { ...s, reject: null };
      return { ...s, hinted: [...s.hinted, target], hintsUsed: s.hintsUsed + 1, events: [...s.events, `?${hubStartsWithToken(target)}`], reject: null };
    }
    case 'HINT_REVEAL': {
      const target = hubNextUnfound(s);
      if (!target) return { ...s, reject: null };
      return settle({
        ...s, found: [...s.found, target], revealed: [...s.revealed, target], points: s.points + hubWordScore(target, s.letters),
        hintsUsed: s.hintsUsed + 2, events: [...s.events, `!${target}`], reject: null,
      }, now);
    }
    case 'END': {
      const n = { ...s, ended: true, events: [...s.events, '#'], reject: null };
      if (n.status === 'playing') return { ...n, status: 'lost', endTime: now };
      return n;
    }
    default:
      return s;
  }
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/** solutions = [id, letters, max, wordCount, pangramCount]; guesses = the event log. */
export function hubMatchRow(s: HubState): { solutions: string[]; guesses: string[] } {
  return { solutions: [s.id, s.letters, String(s.max), String(s.words.length), String(s.pangrams.length)], guesses: [...s.events] };
}

export interface HubReconstruction {
  id: string; letters: string; max: number; wordCount: number; pangramCount: number;
  found: string[]; bonusFound: string[]; revealed: string[]; hints: string[]; points: number; hintsUsed: number;
  rank: number; rankName: string; ended: boolean; solved: boolean;
}

export function reconstructHub(solutions: string[] | null | undefined, guesses: string[] | null | undefined): HubReconstruction | null {
  if (!solutions || solutions.length < 3) return null;
  const [id, letters, maxField, wc, pc] = solutions;
  if (!/^[A-Z]{7}$/.test(letters ?? '')) return null;
  const max = Number(maxField);
  if (!Number.isFinite(max) || max <= 0) return null;
  const found: string[] = [], bonusFound: string[] = [], revealed: string[] = [], hints: string[] = [];
  let points = 0, hintsUsed = 0, ended = false;
  for (const ev of guesses ?? []) {
    if (ev === '#') { ended = true; continue; }
    const sigil = ev[0], rest = ev.slice(1);
    if ((sigil === '+' || sigil === '!') && /^[A-Z]{4,}$/.test(rest) && !found.includes(rest)) {
      found.push(rest); points += hubWordScore(rest, letters);
      if (sigil === '!') { revealed.push(rest); hintsUsed += 2; }
    } else if (sigil === '=' && /^[A-Z]{4,}$/.test(rest) && !bonusFound.includes(rest)) { bonusFound.push(rest); points += hubWordScore(rest, letters); }
    else if (sigil === '?') { hints.push(rest); hintsUsed += 1; }
  }
  const rank = hubRankIndex(points, max);
  return {
    id: id ?? '', letters, max, wordCount: Number(wc) || 0, pangramCount: Number(pc) || 0,
    found, bonusFound, revealed, hints, points, hintsUsed, rank, rankName: HUB_RANKS[rank].name, ended, solved: rank >= HUB_SOLVED_RANK,
  };
}
