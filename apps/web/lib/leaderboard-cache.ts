// BI19: the daily boards' stale-while-revalidate caches, shared and persisted.
//
// These were session-lived `new Map()`s inside app/daily/page.tsx, so every
// reload started from a skeleton and a failed fetch painted an empty board.
// Now they are per-user, persisted (lib/page-cache.ts) and shared with the
// prefetcher, which fills today's boards right after launch and after each
// finish — so opening the Leaderboard paints at once, every time. Fetches
// throw on failure (throwOnError) so a caller keeps its cached board.

import {
  fetchDailyLeaderboard,
  fetchDailySweepLeaderboard,
  fetchFlawlessStreaks,
  fetchRankWindow,
  fetchSweepModeDetails,
  getDailyPlayerCount,
  getUserDailyRank,
  getUserSweepRank,
  type LeaderboardEntry,
  type SweepDetails,
  type SweepEntry,
} from './daily-service';
import { dayInKey, persistentMap } from './page-cache';
import { reconcile, updateResultStore } from './optimistic-results';

export type Rank = { rank: number; totalPlayers: number };
export type RankWindow = { startRank: number; entries: LeaderboardEntry[] };

export interface ModeBoard {
  lb: LeaderboardEntry[];
  count: number;
  rank: Rank | null;
  /** "Your neighborhood" rows when the user ranks past the top-50 list. */
  win: RankWindow | null;
}

export interface SweepBoard {
  lb: SweepEntry[];
  count: number;
  rank: Rank | null;
  details: Map<string, SweepDetails>;
}

/** Per-game boards, keyed mode:day:user[:friends]. */
export const lbCache = persistentMap<ModeBoard>('lb', dayInKey);
/** The overall (Sweep) board, keyed SWEEP:day:user. */
export const sweepCache = persistentMap<SweepBoard>('lb-sweep', dayInKey);

export function modeBoardKey(mode: string, day: string, userId: string | null | undefined, friends = false): string {
  return `${mode}:${day}:${userId ?? 'anon'}${friends ? ':friends' : ''}`;
}

export function sweepBoardKey(day: string, userId: string | null | undefined): string {
  return `SWEEP:${day}:${userId ?? 'anon'}`;
}

/** The server board landed with the player's row: their optimistic entry for it is done. */
function reconcileMine(rows: Array<{ user_id: string }>, mode: string, day: string, userId: string | null | undefined): void {
  if (!userId || !rows.some((r) => r.user_id === userId)) return;
  updateResultStore((st) => reconcile(st, userId, day, [mode]));
}

/**
 * Today's per-game board (rows, count, the player's rank and neighborhood),
 * cached. `onRows` paints the rows the moment they land, before the rank
 * queries. Throws when the board can't be read.
 */
export async function fetchModeBoard(
  mode: string,
  day: string,
  userId: string | null | undefined,
  onRows?: (lb: LeaderboardEntry[], count: number) => void,
): Promise<ModeBoard> {
  const [lb, count] = await Promise.all([
    fetchDailyLeaderboard(mode, 'solo', day, 50, 0, undefined, { throwOnError: true }),
    getDailyPlayerCount(mode, day, { throwOnError: true }),
  ]);
  onRows?.(lb, count);
  reconcileMine(lb, mode, day, userId);
  let rank: Rank | null = null;
  let win: RankWindow | null = null;
  if (userId) {
    rank = await getUserDailyRank(userId, mode, 'solo', day, lb, 50);
    if (rank && rank.rank > 50) win = await fetchRankWindow(mode, 'solo', rank.rank, day);
  }
  const board = { lb, count, rank, win };
  lbCache.set(modeBoardKey(mode, day, userId), board);
  return board;
}

/** The friends-only board: friends ∪ me, dense list. Throws on failure. */
export async function fetchFriendsBoard(
  mode: string,
  day: string,
  userId: string,
  ids: string[],
  competitionRank: (lb: LeaderboardEntry[], idx: number) => number,
): Promise<ModeBoard> {
  const lb = await fetchDailyLeaderboard(mode, 'solo', day, 50, 0, ids, { throwOnError: true });
  reconcileMine(lb, mode, day, userId);
  const idx = lb.findIndex((e) => e.user_id === userId);
  const rank = idx >= 0 ? { rank: competitionRank(lb, idx), totalPlayers: lb.length } : null;
  const board = { lb, count: lb.length, rank, win: null };
  lbCache.set(modeBoardKey(mode, day, userId, true), board);
  return board;
}

/**
 * Today's overall (Sweep) board with per-mode details, flawless streaks and
 * the player's rank, cached. `onRows` paints the rows first. Throws when the
 * board can't be read.
 */
export async function fetchSweepBoard(
  day: string,
  userId: string | null | undefined,
  onRows?: (lb: SweepEntry[]) => void,
): Promise<SweepBoard & { streaks: Map<string, number> }> {
  const rankP = userId ? getUserSweepRank(userId, day) : Promise.resolve(null);
  const lb = await fetchDailySweepLeaderboard(day, 50, 0, { throwOnError: true });
  onRows?.(lb);
  // §248: only rows already FLAWLESS today can be on a live streak.
  const [details, streaks, rank] = await Promise.all([
    fetchSweepModeDetails(day, lb.map((e) => e.user_id)),
    fetchFlawlessStreaks(day, lb.filter((e) => e.is_flawless).map((e) => e.user_id)),
    rankP,
  ]);
  // No dedicated count RPC — the rank query yields the true total when the
  // user swept; otherwise the (≤50) board length is the best estimate.
  const count = rank?.totalPlayers ?? lb.length;
  const board = { lb, count, rank, details };
  sweepCache.set(sweepBoardKey(day, userId), board);
  return { ...board, streaks };
}

let prefetching: Promise<void> | null = null;

/**
 * Warm today's boards (the overall Sweep board + the given games) into the
 * persisted cache. Best-effort: failures leave whatever is cached.
 */
export function prefetchTodayBoards(userId: string, day: string, modes: readonly string[]): Promise<void> {
  if (prefetching) return prefetching;
  prefetching = (async () => {
    const jobs: Array<Promise<unknown>> = [fetchSweepBoard(day, userId)];
    for (const m of modes) jobs.push(fetchModeBoard(m, day, userId));
    await Promise.allSettled(jobs);
  })().finally(() => { prefetching = null; });
  return prefetching;
}
