import { bankIndexForDay, bankIndexForSeed, bankDayIndex, bankHolidayPick, type HolidayTable } from '../bank';
import { mulberry32, simpleHash } from '../seed';

/**
 * Kindred — groups of four (More Games §14). Sixteen words hide four groups
 * of four; find them all with at most four mistakes. Tiers 1–4 run from a
 * plain category to wordplay and are shown as one to four pips on the solved
 * bar (never color alone). Submitting four words: a group → it locks and its
 * bar appears; three from one group → "One away"; otherwise a plain miss. A
 * set already tried is free to try again (no second mistake). Four mistakes
 * lose the puzzle and the remaining groups are revealed.
 *
 * Hints (founder, 2026-09-21: "the same two capsules as the other games"):
 * NAME A CATEGORY (1 hint, 100) shows the label of the easiest unsolved group;
 * SHOW A PAIR (2 hints, 200) rings two words that belong together. Neither
 * costs a mistake; both are cheaper than a wrong guess (250) so asking beats
 * guessing blind, and an unaided solve outranks a hinted one.
 *
 * Result row: guess_count = submissions on a win (4 perfect … 7 worst) and
 * groups found + 4 on a loss; boards_solved = groups found of 4. Event sigils
 * (§11): "+t:W1,W2,W3,W4" solved tier t, "x1:…" one away, "x0:…" miss,
 * "=…" a repeated set (free), "?ct" category hint, "?p:A,B" pair hint,
 * "~n" shuffle n. Tile order comes from mulberry32(simpleHash(seed + "-groups-v1"))
 * so every platform deals the same board.
 *
 * Parity-critical: Groups.swift / Groups.kt reproduce this exactly;
 * groups-fixtures.json pins all three.
 */

export const GROUPS_DAILY_EPOCH = '2026-09-23';
export const GROUPS_MAX_MISTAKES = 4;
export const GROUPS_TOTAL_BOARDS = 4;
export const GROUPS_PERFECT_GUESSES = 4;

export interface GroupsGroup { tier: number; label: string; words: string[] }
export interface GroupsPuzzle { id: string; groups: GroupsGroup[]; holiday?: string }
export interface GroupsBank { version: number; epoch: string; daily: GroupsPuzzle[]; extra: GroupsPuzzle[]; holiday?: Record<string, GroupsPuzzle[]> }

export function groupsPuzzleForDay(bank: GroupsBank, day: string, holidays?: HolidayTable | null): GroupsPuzzle | null {
  const pick = bankHolidayPick(day, holidays, bank.holiday);
  if (pick) return pick.entry;
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}
export function groupsPuzzleForSeed(bank: GroupsBank, seed: string): GroupsPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}
export function groupsDailyNumber(day: string): number {
  const idx = bankDayIndex(day, GROUPS_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

/** Fisher–Yates from the end with j = rng() mod (i + 1) — the same shuffle on every platform. */
export function groupsShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng() % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** The sixteen words in puzzle order (tier 1 first), then dealt by the seed. */
export function groupsTileOrder(p: GroupsPuzzle, seed: string): string[] {
  const words = [...p.groups].sort((a, b) => a.tier - b.tier).flatMap((g) => g.words);
  return groupsShuffle(words, mulberry32(simpleHash(`${seed}-groups-v1`)));
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type GroupsStatus = 'playing' | 'won' | 'lost';
export type GroupsResult = 'correct' | 'oneaway' | 'wrong' | 'repeat' | 'short';

export interface GroupsState {
  seed: string;
  id: string;
  groups: GroupsGroup[];
  /** Unsolved words in display order. */
  tiles: string[];
  /** Groups in the order solved. */
  solved: GroupsGroup[];
  selected: string[];
  mistakes: number;
  submissions: number;
  hintsUsed: number;
  /** Tiers whose label has been revealed by a hint. */
  revealedTiers: number[];
  /** Pairs shown by hints. */
  pairs: string[][];
  /** Sets already submitted and wrong ("A|B|C|D" sorted). */
  wrongSets: string[];
  shuffles: number;
  lastResult: GroupsResult | null;
  events: string[];
  status: GroupsStatus;
  ended: boolean;
  startTime: number;
  endTime: number | null;
}

export type GroupsAction =
  | { type: 'TOGGLE'; word: string }
  | { type: 'DESELECT' }
  | { type: 'SHUFFLE' }
  | { type: 'SUBMIT' }
  | { type: 'HINT_LABEL' }
  | { type: 'HINT_PAIR' }
  | { type: 'FINISH' };

export function createGroupsState(p: GroupsPuzzle, seed: string, startTime: number): GroupsState {
  const groups = [...p.groups].sort((a, b) => a.tier - b.tier).map((g) => ({ tier: g.tier, label: g.label, words: g.words.map((w) => w.toUpperCase()) }));
  return {
    seed, id: p.id, groups, tiles: groupsTileOrder({ ...p, groups }, seed), solved: [], selected: [], mistakes: 0, submissions: 0, hintsUsed: 0,
    revealedTiers: [], pairs: [], wrongSets: [], shuffles: 0, lastResult: null, events: [], status: 'playing', ended: false, startTime, endTime: null,
  };
}

const setKey = (words: readonly string[]) => [...words].sort().join('|');
export function groupsUnsolved(s: GroupsState): GroupsGroup[] { return s.groups.filter((g) => !s.solved.some((x) => x.tier === g.tier)); }
/** guess_count for the result row: submissions on a win, groups found + 4 on a loss (in play, the current count). */
export function groupsGuessCount(s: GroupsState): number {
  if (s.status === 'lost') return s.solved.length + GROUPS_MAX_MISTAKES;
  return Math.max(s.submissions, s.solved.length);
}
export function groupsBoardsSolved(s: GroupsState): number { return s.solved.length; }
/** The pair a Show-a-pair hint would ring: the two alphabetically first words of the easiest unsolved group not yet paired. */
export function groupsPairTarget(s: GroupsState): { tier: number; pair: string[] } | null {
  for (const g of groupsUnsolved(s)) {
    const words = [...g.words].sort();
    if (s.pairs.some((p) => words.includes(p[0]) && words.includes(p[1]))) continue;
    return { tier: g.tier, pair: [words[0], words[1]] };
  }
  return null;
}
export function groupsLabelTarget(s: GroupsState): GroupsGroup | null {
  return groupsUnsolved(s).find((g) => !s.revealedTiers.includes(g.tier)) ?? null;
}

export function groupsReduce(s: GroupsState, a: GroupsAction, now = 0): GroupsState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.ended) return s;

  switch (a.type) {
    case 'TOGGLE': {
      const w = a.word.toUpperCase();
      if (!s.tiles.includes(w)) return s;
      if (s.selected.includes(w)) return { ...s, selected: s.selected.filter((x) => x !== w), lastResult: null };
      if (s.selected.length >= 4) return s;
      return { ...s, selected: [...s.selected, w], lastResult: null };
    }
    case 'DESELECT':
      return s.selected.length ? { ...s, selected: [], lastResult: null } : s;
    case 'SHUFFLE': {
      const n = s.shuffles + 1;
      const tiles = groupsShuffle(s.tiles, mulberry32(simpleHash(`${s.seed}-groups-shuffle-${n}`)));
      return { ...s, tiles, shuffles: n, events: [...s.events, `~${n}`] };
    }
    case 'SUBMIT': {
      if (s.selected.length !== 4) return { ...s, lastResult: 'short' };
      const key = setKey(s.selected);
      if (s.wrongSets.includes(key)) return { ...s, lastResult: 'repeat', events: [...s.events, `=${key.replace(/\|/g, ',')}`] };
      const unsolved = groupsUnsolved(s);
      const hit = unsolved.find((g) => s.selected.every((w) => g.words.includes(w)));
      const submissions = s.submissions + 1;
      if (hit) {
        const solved = [...s.solved, hit];
        const tiles = s.tiles.filter((w) => !hit.words.includes(w));
        const won = solved.length === s.groups.length;
        return {
          ...s, solved, tiles, selected: [], submissions, lastResult: 'correct',
          events: [...s.events, `+${hit.tier}:${hit.words.join(',')}`],
          status: won ? 'won' : s.status, ended: won, endTime: won ? now : s.endTime,
        };
      }
      const best = Math.max(...unsolved.map((g) => s.selected.filter((w) => g.words.includes(w)).length));
      const oneAway = best === 3;
      const mistakes = s.mistakes + 1;
      const lost = mistakes >= GROUPS_MAX_MISTAKES;
      return {
        ...s, mistakes, submissions, wrongSets: [...s.wrongSets, key], lastResult: oneAway ? 'oneaway' : 'wrong',
        selected: lost ? [] : s.selected,
        events: [...s.events, `${oneAway ? 'x1' : 'x0'}:${[...s.selected].sort().join(',')}`],
        status: lost ? 'lost' : s.status, ended: lost, endTime: lost ? now : s.endTime,
      };
    }
    case 'HINT_LABEL': {
      const g = groupsLabelTarget(s);
      if (!g) return s;
      return { ...s, revealedTiers: [...s.revealedTiers, g.tier], hintsUsed: s.hintsUsed + 1, lastResult: null, events: [...s.events, `?c${g.tier}`] };
    }
    case 'HINT_PAIR': {
      const t = groupsPairTarget(s);
      if (!t) return s;
      return { ...s, pairs: [...s.pairs, t.pair], hintsUsed: s.hintsUsed + 2, lastResult: null, events: [...s.events, `?p:${t.pair.join(',')}`] };
    }
    default:
      return s;
  }
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/** solutions = ["tier|LABEL|W1,W2,W3,W4" × 4, tier order]; guesses = the event log. */
export function groupsMatchRow(s: GroupsState): { solutions: string[]; guesses: string[] } {
  return { solutions: s.groups.map((g) => `${g.tier}|${g.label}|${g.words.join(',')}`), guesses: [...s.events] };
}

export interface GroupsReconstruction {
  groups: GroupsGroup[];
  /** Tiers in the order solved. */
  solvedTiers: number[];
  mistakes: number;
  oneAways: number;
  submissions: number;
  hintsUsed: number;
  revealedTiers: number[];
  pairs: string[][];
  solved: boolean;
}

export function reconstructGroups(solutions: string[] | null | undefined, guesses: string[] | null | undefined): GroupsReconstruction | null {
  if (!solutions || solutions.length !== 4) return null;
  const groups: GroupsGroup[] = [];
  for (const sol of solutions) {
    const parts = sol.split('|');
    if (parts.length !== 3) return null;
    const tier = Number(parts[0]), words = parts[2].split(',');
    if (!(tier >= 1 && tier <= 4) || words.length !== 4) return null;
    groups.push({ tier, label: parts[1], words });
  }
  const solvedTiers: number[] = [], revealedTiers: number[] = [], pairs: string[][] = [];
  let mistakes = 0, oneAways = 0, submissions = 0, hintsUsed = 0;
  for (const ev of guesses ?? []) {
    if (ev.startsWith('+')) { const t = Number(ev.slice(1, ev.indexOf(':'))); if (t >= 1 && t <= 4 && !solvedTiers.includes(t)) solvedTiers.push(t); submissions++; }
    else if (ev.startsWith('x1')) { mistakes++; oneAways++; submissions++; }
    else if (ev.startsWith('x0')) { mistakes++; submissions++; }
    else if (ev.startsWith('?c')) { const t = Number(ev.slice(2)); if (t >= 1 && t <= 4) revealedTiers.push(t); hintsUsed += 1; }
    else if (ev.startsWith('?p:')) { pairs.push(ev.slice(3).split(',')); hintsUsed += 2; }
  }
  return { groups, solvedTiers, mistakes, oneAways, submissions, hintsUsed, revealedTiers, pairs, solved: solvedTiers.length === 4 };
}
