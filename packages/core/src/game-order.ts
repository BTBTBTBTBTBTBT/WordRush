// ============================================================
// Player game order (FRIDAY-QUEUE item 35)
// ============================================================
// Order is DISPLAY-ONLY: sweep rules, canonical ids and db keys never change. The default
// order comes from the catalog (modes.json homeSlot); a player may save their own order per
// section (Dailies / Puzzles). Rules, identical on web, iOS and Android:
//
//   - Classic is ALWAYS first in Dailies (pinned, even in a custom order).
//   - Saved ids this build doesn't know are dropped; games missing from the saved order
//     (new games) are APPENDED in default order.
//   - Duplicates in a saved order collapse to the first mention.
//   - NEXT on a finished screen = the next unplayed game in the player's order, wrapping.
//
// Saved shape (profiles.game_order jsonb, guests: local storage): { dailies: string[], puzzles: string[] }
// holding catalog MODE IDS ('practice', 'quordle', 'sudoku' ...).

export interface GameOrderPrefs {
  dailies: string[];
  puzzles: string[];
}

export type GameOrderSection = keyof GameOrderPrefs;

/** The mode id pinned to the front of Dailies. */
export const PINNED_FIRST_DAILY = 'practice';

/** Founder's default Dailies order (10-08, final). Mirrors the modes.json homeSlot order. */
export const DEFAULT_DAILIES_ORDER = ['practice', 'quordle', 'octordle', 'sequence', 'six', 'seven', 'rescue', 'gauntlet'] as const;

/** Default Puzzles order, easiest to hardest for now (Muddle moved down); recomputed from data later. */
export const DEFAULT_PUZZLES_ORDER = [
  'propernoundle', 'sudoku', 'regions', 'wordsearch', 'ladder', 'hub', 'groups', 'crossword', 'cryptogram', 'scramble',
] as const;

/** Resolve a saved order against the default order for the games this build knows. */
export function applyGameOrder(defaultIds: readonly string[], saved: readonly string[] | null | undefined, pinnedFirst?: string | null): string[] {
  const known = new Set(defaultIds);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of saved ?? []) {
    if (known.has(id) && !seen.has(id)) { out.push(id); seen.add(id); }
  }
  for (const id of defaultIds) if (!seen.has(id)) { out.push(id); seen.add(id); }
  if (pinnedFirst && known.has(pinnedFirst)) {
    return [pinnedFirst, ...out.filter((id) => id !== pinnedFirst)];
  }
  return out;
}

/** Order a list of items carrying `id` by a resolved id order (items not in the order keep their relative place at the end). */
export function sortByOrder<T>(items: readonly T[], idOf: (t: T) => string, order: readonly string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i] as const));
  return [...items]
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (rank.get(idOf(a.t)) ?? 1e6 + a.i) - (rank.get(idOf(b.t)) ?? 1e6 + b.i))
    .map((x) => x.t);
}

/** Move one id from `from` to `to` (indices) — Classic's slot 0 in Dailies can neither be moved nor displaced. */
export function moveGame(order: readonly string[], from: number, to: number, pinnedFirst?: string | null): string[] {
  const next = [...order];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const pinned = pinnedFirst ? next.indexOf(pinnedFirst) : -1;
  if (pinned === from) return next;
  const [id] = next.splice(from, 1);
  let dest = to;
  if (pinned === 0 && dest === 0) dest = 1;
  next.splice(dest, 0, id);
  return next;
}

/** Sanitize an untrusted saved value (profile json, local storage) into prefs, or null when empty/garbage. */
export function parseGameOrder(raw: unknown): GameOrderPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 40) : []);
  const prefs = { dailies: list(o.dailies), puzzles: list(o.puzzles) };
  return prefs.dailies.length || prefs.puzzles.length ? prefs : null;
}

/** True when the saved prefs equal the default (so Reset can clear the saved row). */
export function isDefaultOrder(defaultIds: readonly string[], saved: readonly string[] | null | undefined, pinnedFirst?: string | null): boolean {
  const a = applyGameOrder(defaultIds, saved, pinnedFirst);
  const b = applyGameOrder(defaultIds, null, pinnedFirst);
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * NEXT on a finished screen: the next game AFTER `currentId` in the player's order that is
 * not played yet, wrapping once; if everything is played, null. `order` lists Dailies then
 * Puzzles as the player sees them (callers concatenate the sections they want to walk).
 */
export function nextUnplayed(order: readonly string[], currentId: string, played: ReadonlySet<string>): string | null {
  const start = order.indexOf(currentId);
  for (let step = 1; step <= order.length; step += 1) {
    const id = order[(start + step + order.length) % order.length];
    if (id !== currentId && !played.has(id)) return id;
  }
  return null;
}
