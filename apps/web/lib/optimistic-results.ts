// BI19 optimistic results (founder, 2026-10-03: "the W and L will populate
// immediately now upon return to the main menu as well as the leaderboard
// immediately populating the results").
//
// The moment a daily finishes — the local 'daily-completion' event, before
// any network — the result is written to a small local store keyed by
// user · day · mode and persisted in localStorage, so Home's W / L badge, the
// player's own row on the daily boards (per game and the overall Sweep) and
// the Stats Today card show it at once and keep showing it across a reload
// until the server confirms. The rules (pure, tested):
//   • applyLocalResult — record a finish (never downgrading: a win beats a
//     loss, then the higher score, like the daily row itself).
//   • mergeLeaderboard — the server rows with the player's local row placed
//     in rank order, flagged isOptimistic / isMe — unless the server already
//     has the player's row (then the server row, flagged isMe, stands).
//   • reconcile — server data landed: the local entry is dropped once the
//     server includes the player's result (equal or different — the server
//     wins silently). Past days are dropped too.

export interface LocalResult {
  userId: string;
  /** Local YYYY-MM-DD the daily belongs to. */
  day: string;
  /** daily_results.game_mode (dbKey). */
  mode: string;
  won: boolean;
  guesses: number;
  timeSeconds: number;
  score: number;
  /** ms epoch the finish was recorded locally. */
  savedAt: number;
}

export type ResultStore = Readonly<Record<string, LocalResult>>;

export const OPTIMISTIC_STORAGE_KEY = 'wordocious-optimistic-results-v1';

export function resultKey(userId: string, day: string, mode: string): string {
  return `${userId}|${day}|${mode}`;
}

function better(existing: LocalResult | undefined, incoming: LocalResult): LocalResult {
  if (!existing) return incoming;
  if (existing.won && !incoming.won) return existing;
  if (existing.won === incoming.won && existing.score > incoming.score) return existing;
  return incoming;
}

/** Records a finish (never downgrades an earlier, better one for the same user · day · mode). */
export function applyLocalResult(store: ResultStore, result: LocalResult): ResultStore {
  const k = resultKey(result.userId, result.day, result.mode);
  const next = better(store[k], result);
  if (next === store[k]) return store;
  return { ...store, [k]: next };
}

/** Drops every entry whose day isn't `today` (yesterday's finishes are the server's now). */
export function pruneStore(store: ResultStore, today: string): ResultStore {
  let changed = false;
  const out: Record<string, LocalResult> = {};
  for (const [k, v] of Object.entries(store)) {
    if (v.day === today) out[k] = v; else changed = true;
  }
  return changed ? out : store;
}

/** The player's local results for a day, keyed by mode. */
export function localResultsFor(store: ResultStore, userId: string, day: string): Map<string, LocalResult> {
  const out = new Map<string, LocalResult>();
  for (const v of Object.values(store)) {
    if (v.userId === userId && v.day === day) out.set(v.mode, v);
  }
  return out;
}

/** As Home / Stats completions ({ won, guesses, timeSeconds, score }) — server rows win. */
export function mergeCompletions<T extends { won: boolean; guesses: number; timeSeconds: number; score: number }>(
  server: Map<string, T>,
  local: Map<string, LocalResult>,
): Map<string, T> {
  let out: Map<string, T> | null = null;
  for (const [mode, r] of local) {
    if (server.has(mode)) continue;
    out ??= new Map(server);
    out.set(mode, { won: r.won, guesses: r.guesses, timeSeconds: r.timeSeconds, score: r.score } as T);
  }
  return out ?? server;
}

/**
 * Server data landed for (user, day): drop the local entries the server now
 * has — `serverModes` is every mode the server returned a row for this user.
 * The server's value wins whether it matches the local one or not.
 */
export function reconcile(store: ResultStore, userId: string, day: string, serverModes: Iterable<string>): ResultStore {
  let out: Record<string, LocalResult> | null = null;
  for (const mode of serverModes) {
    const k = resultKey(userId, day, mode);
    if (!(k in (out ?? store))) continue;
    out ??= { ...store };
    delete out[k];
  }
  return out ?? store;
}

// ── Leaderboards ────────────────────────────────────────────────────────────

/** The board orderings: per-game (composite score desc, time asc) and the overall Sweep (total score desc, total time asc). */
export type LeaderboardSortKey = 'daily' | 'sweep';

const SORT_FIELDS: Record<LeaderboardSortKey, { score: string; time: string }> = {
  daily: { score: 'composite_score', time: 'time_seconds' },
  sweep: { score: 'total_score', time: 'total_time' },
};

export interface MergeFlags {
  /** This row is the player's local, not-yet-confirmed result. */
  isOptimistic?: boolean;
  /** This row is the player's. */
  isMe?: boolean;
}

export type MergedRow<T> = T & MergeFlags;

/**
 * The server rows with the player's local row inserted in rank order (after
 * any row it doesn't strictly beat — equal score and time keep the server's
 * earlier finisher ahead), flagged isOptimistic + isMe. When the server rows
 * already hold the player, nothing is inserted (that row is flagged isMe).
 * A local row that would land past `limit` is left out (the rank window's job).
 */
export function mergeLeaderboard<T extends { user_id: string }>(
  serverRows: readonly T[],
  localRow: T | null | undefined,
  userId: string | null | undefined,
  sortKey: LeaderboardSortKey,
  limit: number = Infinity,
): { rows: MergedRow<T>[]; inserted: boolean; index: number } {
  const mine = userId ? serverRows.findIndex((r) => r.user_id === userId) : -1;
  if (mine >= 0 || !localRow || !userId) {
    const rows = mine >= 0
      ? serverRows.map((r, i) => (i === mine ? { ...r, isMe: true } : r)) as MergedRow<T>[]
      : (serverRows as MergedRow<T>[]);
    return { rows, inserted: false, index: mine };
  }
  const f = SORT_FIELDS[sortKey];
  const score = (r: T) => Number((r as any)[f.score] ?? 0);
  const time = (r: T) => Number((r as any)[f.time] ?? 0);
  const s = score(localRow);
  const t = time(localRow);
  const i = serverRows.findIndex((r) => score(r) < s || (score(r) === s && time(r) > t));
  const at = i < 0 ? serverRows.length : i;
  if (at >= limit) return { rows: serverRows as MergedRow<T>[], inserted: false, index: -1 };
  const row: MergedRow<T> = { ...localRow, user_id: userId, isOptimistic: true, isMe: true };
  return { rows: [...serverRows.slice(0, at), row, ...serverRows.slice(at)], inserted: true, index: at };
}

/**
 * The overall (Sweep) board's ranks after an optimistic insert: the inserted
 * row takes the competition rank of its slot and every row it beat moves
 * down one. Rows keep their server `rank` otherwise.
 */
export function rerankAfterInsert<T extends { rank: number; total_score: number; total_time: number }>(rows: MergedRow<T>[], index: number): MergedRow<T>[] {
  if (index < 0 || index >= rows.length) return rows;
  const me = rows[index];
  const prev = rows[index - 1];
  const tiedWithPrev = prev && prev.total_score === me.total_score && prev.total_time === me.total_time;
  const myRank = tiedWithPrev ? prev.rank : (prev ? prev.rank + 1 : 1);
  return rows.map((r, i) => {
    if (i === index) return { ...r, rank: myRank };
    if (i > index) return { ...r, rank: r.rank + 1 };
    return r;
  });
}

// ── Persistence (localStorage; every access guarded) ───────────────────────

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function loadResultStore(storage: StorageLike | null = defaultStorage()): ResultStore {
  if (!storage) return {};
  try {
    const raw = storage.getItem(OPTIMISTIC_STORAGE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as ResultStore) : {};
  } catch { return {}; }
}

export function saveResultStore(store: ResultStore, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try { storage.setItem(OPTIMISTIC_STORAGE_KEY, JSON.stringify(store)); } catch {}
}

/** Load → change → save in one step (no-op write when unchanged). */
export function updateResultStore(fn: (s: ResultStore) => ResultStore, storage: StorageLike | null = defaultStorage()): ResultStore {
  const before = loadResultStore(storage);
  const after = fn(before);
  if (after !== before) saveResultStore(after, storage);
  return after;
}
