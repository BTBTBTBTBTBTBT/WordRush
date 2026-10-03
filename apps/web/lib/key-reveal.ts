import { REVEAL } from './tile-motion';

// FINISH_SPEC AQ1: the keyboard keys take their colors AS EACH TILE FLIPS — the
// key for tile i colors when tile i lands — instead of after the whole row.
// BI5: on the board's own clock (`mini` = the multi-board pacing).
// Pure, so components/game/keyboard.tsx and the tests share it.

export type KeyLetterState = 'correct' | 'present' | 'absent';
export type KeyStates = Record<string, KeyLetterState>;
/** One keyboard's states, or one per board (multi-board quadrant keys). */
export type KeyStatesLike = KeyStates | KeyStates[] | undefined;

/** A step of a key reveal: at `at` ms these letters take their new colors. */
export interface KeyRevealStep { at: number; letters: string[] }

/** Each letter of `word` → when its first tile lands (ms from the reveal start). */
export function keyColorDelays(word: string, mini = false): Record<string, number> {
  const out: Record<string, number> = {};
  const w = word.toUpperCase();
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (/[A-Z]/.test(ch) && out[ch] == null) out[ch] = REVEAL.landMs(i, mini);
  }
  return out;
}

function asList(v: KeyStatesLike): KeyStates[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function coloredCount(v: KeyStatesLike): number {
  return asList(v).reduce((n, m) => n + Object.keys(m).length, 0);
}

/** Letters whose key state differs between `prev` and `next` (any board). */
export function changedKeyLetters(prev: KeyStatesLike, next: KeyStatesLike): string[] {
  const a = asList(prev);
  const b = asList(next);
  const out = new Set<string>();
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const p = a[i] ?? {};
    const n = b[i] ?? {};
    for (const k of Object.keys(p)) if (p[k] !== n[k]) out.add(k);
    for (const k of Object.keys(n)) if (p[k] !== n[k]) out.add(k);
  }
  return [...out].sort();
}

/**
 * When the keys take the new states of a reveal of `word`: one step per tile
 * landing (ascending). Letters not in the word wait for the row's end. All at
 * once (a single step at 0) when there's no word, Reduce Motion is on, the
 * board count changed, or it's a reset (fewer colored keys than before).
 */
export function keyRevealSchedule(prev: KeyStatesLike, next: KeyStatesLike, word: string | undefined, instant = false, mini = false): KeyRevealStep[] {
  const letters = changedKeyLetters(prev, next);
  if (letters.length === 0) return [];
  const resized = Array.isArray(prev) !== Array.isArray(next) || asList(prev).length !== asList(next).length;
  if (instant || !word || resized || coloredCount(next) < coloredCount(prev)) return [{ at: 0, letters }];
  const delays = keyColorDelays(word, mini);
  const rowEnd = REVEAL.end(word.length, mini);
  const byAt = new Map<number, string[]>();
  for (const l of letters) {
    const at = delays[l] ?? rowEnd;
    byAt.set(at, [...(byAt.get(at) ?? []), l]);
  }
  return [...byAt.entries()].sort((x, y) => x[0] - y[0]).map(([at, ls]) => ({ at, letters: ls }));
}

function mergeOne(prev: KeyStates | undefined, next: KeyStates | undefined, letters: ReadonlySet<string>): KeyStates {
  const out: KeyStates = { ...(prev ?? {}) };
  for (const l of letters) {
    const s = next?.[l];
    if (s) out[l] = s; else delete out[l];
  }
  return out;
}

/** `prev` with only `letters` moved to their `next` states (per board when it's a list). */
export function keyStatesWith<T extends KeyStatesLike>(prev: T, next: T, letters: ReadonlySet<string>): T {
  if (!next) return next;
  if (Array.isArray(next)) {
    const p = asList(prev);
    return next.map((n, i) => mergeOne(p[i], n, letters)) as T;
  }
  return mergeOne(Array.isArray(prev) ? undefined : prev, next, letters) as T;
}

/** The guess a multi-board game revealed last: the newest guess on the board with the most guesses. */
export function latestGuess(boards: ReadonlyArray<{ guesses: readonly string[] }>): string | undefined {
  let best: readonly string[] = [];
  for (const b of boards) if (b.guesses.length > best.length) best = b.guesses;
  return best[best.length - 1];
}
