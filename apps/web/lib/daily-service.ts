import { supabase } from './supabase-client';
import { handleSupabaseError, reportRejectedWrite } from './supabase-error-handler';
import { isBlocked } from './moderation-service';

// ============================================================
// Composite Score Calculation
// ============================================================

// Composite scoring now lives in ./composite-scoring (dependency-free so the
// cross-platform fixture guard can run it standalone). Re-exported here so
// existing `@/lib/daily-service` importers keep working unchanged.
import { calculateCompositeScore, MODE_SCORE_CONFIG } from './composite-scoring';
export * from './composite-scoring';

export function calculateVsCompositeScore(
  vsWins: number,
  vsLosses: number,
  vsGames: number,
): number {
  // No minimum-games floor: freemium players get ONE VS game/day, so a
  // 3-game qualification gate would leave their score permanently 0. The
  // formula already weights volume (wins*100 + games*5), so multi-game
  // players outrank single-game players naturally.
  const winRate = vsWins / Math.max(1, vsGames);
  return Math.round((vsWins * 100 + winRate * 50 + vsGames * 5) * 100) / 100;
}

// ============================================================
// Daily Seed Management
// ============================================================

/**
 * Get today's date as YYYY-MM-DD in the user's LOCAL timezone.
 *
 * Wordocious resets its daily puzzles at each user's local midnight
 * (like NYT Wordle). The puzzle index is deterministic from this date
 * string, so Tokyo and LA play the same puzzle for `2026-04-18` — they
 * just start/finish it at different real-world moments.
 */
export function getTodayLocal(): string {
  return toLocalDayString(new Date());
}

/**
 * UTC date string (YYYY-MM-DD). Used ONLY for daily-VS *matchmaking* so players
 * in different timezones land in the same queue bucket worldwide. Solo daily
 * puzzles intentionally stay on the player's LOCAL date (getTodayLocal).
 */
export function getTodayUTC(): string {
  const d = new Date();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export function getYesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDayString(d);
}

export function toLocalDayString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Fetch the daily seed for a specific mode and day.
 * If it doesn't exist yet, create it on the fly.
 */
export async function fetchDailySeed(
  gameMode: string,
  day?: string,
): Promise<{ seed: string; solutions: string[] } | null> {
  const targetDay = day || getTodayLocal();

  const { data: existing } = await (supabase as any)
    .from('daily_seeds')
    .select('seed, solutions')
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .maybeSingle();

  if (existing) {
    return { seed: existing.seed, solutions: existing.solutions as string[] };
  }

  // Generate and store a new daily seed
  const seed = `daily-${targetDay}-${gameMode}`;
  const { data: inserted, error } = await (supabase as any)
    .from('daily_seeds')
    .insert({ day: targetDay, game_mode: gameMode, seed, solutions: [] })
    .select('seed, solutions')
    .single();

  if (error) {
    // Likely a race condition — another client inserted first
    const { data: retry } = await (supabase as any)
      .from('daily_seeds')
      .select('seed, solutions')
      .eq('day', targetDay)
      .eq('game_mode', gameMode)
      .maybeSingle();
    return retry ? { seed: retry.seed, solutions: retry.solutions as string[] } : null;
  }

  return inserted ? { seed: inserted.seed, solutions: inserted.solutions as string[] } : null;
}

// ============================================================
// Daily Results
// ============================================================

/**
 * Record or update a daily result for solo play.
 * Only updates if the new score is better than the existing one.
 *
 * `day` (optional) is the puzzle's day derived from its daily seed
 * (`daily-YYYY-MM-DD-MODE`). Callers that have the seed MUST pass it: a
 * daily started at 23:58 and finished at 00:02 has to land on the day the
 * puzzle was issued for — deriving the day at FINISH time via
 * getTodayLocal() would record it onto tomorrow's leaderboard and make the
 * completed-card reconstruction render against the wrong day's solutions.
 * Falls back to getTodayLocal() when omitted.
 */
export async function recordDailyResult(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  completed: boolean,
  guessCount: number,
  timeSeconds: number,
  boardsSolved: number,
  totalBoards: number,
  hintsUsed: number = 0,
  day?: string,
  stagesCompleted?: number,
  bestCorrectLetters?: number,
) {
  const targetDay = day || getTodayLocal();
  // The puzzle's day also picks the scoring formula (pre-cutover days keep
  // the frozen V1 formula so a day's leaderboard never mixes formulas).
  const compositeScore = calculateCompositeScore(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards, hintsUsed,
    stagesCompleted, bestCorrectLetters, targetDay,
  );

  try {
    const { data: existing } = await (supabase as any)
      .from('daily_results')
      .select('id, composite_score')
      .eq('user_id', userId)
      .eq('day', targetDay)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .maybeSingle();

    if (existing) {
      // Only update if new score is better
      if (compositeScore > existing.composite_score) {
        const { error } = await (supabase as any)
          .from('daily_results')
          .update({
            completed,
            guess_count: guessCount,
            time_seconds: timeSeconds,
            boards_solved: boardsSolved,
            total_boards: totalBoards,
            composite_score: compositeScore,
            hints_used: hintsUsed,
          })
          .eq('id', existing.id);
        // supabase-js does NOT throw on a constraint/column error — it returns
        // it here. Surface it (console + Sentry) so a rejected daily write
        // can never fail silently again.
        reportRejectedWrite(`recordDailyResult update ${gameMode}`, error);
      }
    } else {
      const { error } = await (supabase as any)
        .from('daily_results')
        .insert({
          user_id: userId,
          day: targetDay,
          game_mode: gameMode,
          play_type: playType,
          completed,
          guess_count: guessCount,
          time_seconds: timeSeconds,
          boards_solved: boardsSolved,
          total_boards: totalBoards,
          composite_score: compositeScore,
          hints_used: hintsUsed,
        });
      reportRejectedWrite(`recordDailyResult insert ${gameMode}`, error);
    }

    // Check for streak and perfect game medals (fire-and-forget)
    checkAndAwardStreakMedals(userId, targetDay).catch(() => {});
    checkAndAwardPerfectMedal(userId, gameMode, targetDay, guessCount, boardsSolved, totalBoards, completed).catch(() => {});

    // FRIENDS (§207) overtake push — the server re-reads the trusted score
    // and notifies friends this result just passed. Dynamic import avoids a
    // module cycle (friends-service imports getTodayLocal from here).
    import('./friends-service')
      .then((m) => m.beatCheck(targetDay, gameMode, playType))
      .catch(() => {});
  } catch (err) {
    console.error('recordDailyResult failed:', err);
    handleSupabaseError(err, 'recordDailyResult');
  }

  return compositeScore;
}

/**
 * Record or update a daily VS result (accumulates wins/losses for the day).
 */
/**
 * Today's daily VS outcome for the home-card badge and the already-played
 * screen (iOS DailyResultsService.dailyVSResult parity). null = not played
 * today; true/false = won/lost. Server-backed, so a daily VS played on any
 * device shows correctly everywhere.
 */
export async function fetchDailyVsResult(userId: string): Promise<boolean | null> {
  const { data } = await (supabase as any)
    .from('daily_results')
    .select('vs_wins')
    .eq('user_id', userId)
    .eq('day', getTodayLocal())
    .eq('game_mode', 'DUEL')
    .eq('play_type', 'vs')
    .limit(1);
  const row = data?.[0];
  return row ? ((row.vs_wins ?? 0) > 0) : null;
}

export async function recordDailyVsResult(
  userId: string,
  gameMode: string,
  won: boolean,
  // Draws count the game (and mark the day completed) without touching the
  // win/loss tallies — a drawn VS is not a loss.
  isDraw: boolean = false,
) {
  const day = getTodayLocal();

  try {
    const { data: existing } = await (supabase as any)
      .from('daily_results')
      .select('id, vs_wins, vs_losses, vs_games')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('game_mode', gameMode)
      .eq('play_type', 'vs')
      .maybeSingle();

    if (existing) {
      const newWins = existing.vs_wins + (won ? 1 : 0);
      const newLosses = existing.vs_losses + (won || isDraw ? 0 : 1);
      const newGames = existing.vs_games + 1;
      const compositeScore = calculateVsCompositeScore(newWins, newLosses, newGames);

      const { error } = await (supabase as any)
        .from('daily_results')
        .update({
          vs_wins: newWins,
          vs_losses: newLosses,
          vs_games: newGames,
          composite_score: compositeScore,
          completed: true,
        })
        .eq('id', existing.id);
      reportRejectedWrite(`recordDailyVsResult update ${gameMode}`, error);
    } else {
      const wins = won ? 1 : 0;
      const losses = won || isDraw ? 0 : 1;
      const compositeScore = calculateVsCompositeScore(wins, losses, 1);

      const { error } = await (supabase as any)
        .from('daily_results')
        .insert({
          user_id: userId,
          day,
          game_mode: gameMode,
          play_type: 'vs',
          completed: true,
          vs_wins: wins,
          vs_losses: losses,
          vs_games: 1,
          composite_score: compositeScore,
        });
      reportRejectedWrite(`recordDailyVsResult insert ${gameMode}`, error);
    }
  } catch (err) {
    console.error('recordDailyVsResult failed:', err);
    handleSupabaseError(err, 'recordDailyVsResult');
  }
}

// ============================================================
// Leaderboard Queries
// ============================================================

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  avatar_emoji?: string | null;
  composite_score: number;
  guess_count: number;
  time_seconds: number;
  boards_solved: number;
  total_boards: number;
  hints_used: number;
  vs_wins: number;
  vs_losses: number;
  vs_games: number;
  completed: boolean;
}

/**
 * Fetch the daily leaderboard for a given day, mode, and play type.
 */
export async function fetchDailyLeaderboard(
  gameMode: string,
  playType: 'solo' | 'vs',
  day?: string,
  limit: number = 50,
  /** Row offset into the ranked ordering (0-based) — used by the rank-window
   *  fetch to read the rows AROUND a deep rank without paging everything. */
  offset: number = 0,
  /** FRIENDS (§207): restrict to these user ids (friends ∪ self). The board
   *  is then dense-ranked 1..N by the caller — no holes, it's your list. */
  userIds?: string[],
): Promise<LeaderboardEntry[]> {
  const targetDay = day || getTodayLocal();

  let query = (supabase as any)
    .from('daily_results')
    .select(`
      user_id,
      composite_score,
      guess_count,
      time_seconds,
      boards_solved,
      total_boards,
      hints_used,
      vs_wins,
      vs_losses,
      vs_games,
      completed,
      profiles!inner(username, avatar_url, avatar_emoji, is_banned)
    `)
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType);
  if (userIds && userIds.length > 0) query = query.in('user_id', userIds);
  const { data } = await query
    .order('composite_score', { ascending: false })
    // §217: time then created_at — the same ordering the daily-medals cron
    // uses, so tied (score, time) groups are contiguous and the live board
    // agrees with the overnight podium.
    .order('time_seconds', { ascending: true })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (!data) return [];

  // Banned users are excluded client-side (RLS can't filter the join for
  // anon/other-user reads) — App Review 1.2 parity with native.
  return data.filter((row: any) => !row.profiles?.is_banned).map((row: any) => ({
    user_id: row.user_id,
    username: row.profiles?.username || 'Unknown',
    avatar_url: row.profiles?.avatar_url || null,
    avatar_emoji: row.profiles?.avatar_emoji || null,
    composite_score: row.composite_score,
    guess_count: row.guess_count,
    time_seconds: row.time_seconds,
    boards_solved: row.boards_solved,
    total_boards: row.total_boards,
    hints_used: row.hints_used ?? 0,
    vs_wins: row.vs_wins,
    vs_losses: row.vs_losses ?? 0,
    vs_games: row.vs_games,
    completed: row.completed,
  }));
}

/**
 * Get the current user's rank for today's daily.
 */
/**
 * §217: competition rank for a row of a best-first leaderboard — rows tied on
 * EXACT (composite_score, time_seconds) share the rank of the first tied row,
 * matching the daily-medals cron (an exact tie for first is two #1s; the next
 * player is #3). Requires the list to be sorted score desc, time asc — the
 * order fetchDailyLeaderboard now guarantees.
 */
export function competitionRank(
  list: Array<{ composite_score: number; time_seconds: number }>,
  index: number,
): number {
  const me = list[index];
  return 1 + list.findIndex(
    (e) => e.composite_score === me.composite_score && e.time_seconds === me.time_seconds,
  );
}

export async function getUserDailyRank(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  day?: string,
  /** The already-fetched leaderboard page (and the limit it was fetched with).
   *  When the user appears in it, rank comes from their index — zero or one
   *  extra queries instead of three. */
  topEntries?: LeaderboardEntry[],
  topLimit: number = 50,
): Promise<{ rank: number; totalPlayers: number } | null> {
  const targetDay = day || getTodayLocal();
  const totalQuery = () => (supabase as any)
    .from('daily_results')
    .select('id', { count: 'exact', head: true })
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType);

  if (topEntries) {
    const idx = topEntries.findIndex((e) => e.user_id === userId);
    if (idx >= 0) {
      // §217: competition rank — rows tied on (score, time) SHARE the rank of
      // the first tied row, exactly like the daily-medals cron. An exact tie
      // for first shows BOTH players "#1", not a coin-flip #1/#2.
      const me = topEntries[idx];
      const rank = 1 + topEntries.findIndex(
        (e) => e.composite_score === me.composite_score && e.time_seconds === me.time_seconds,
      );
      // Under-full page → the list IS everyone; over-full needs a true total.
      if (topEntries.length < topLimit) return { rank, totalPlayers: topEntries.length };
      const { count } = await totalQuery();
      return { rank, totalPlayers: count ?? topEntries.length };
    }
    // Full board visible and the user isn't on it → they haven't played today.
    if (topEntries.length < topLimit) return null;
  }

  // Outside the fetched page: user's score + total in parallel, then players ahead.
  const [{ data: userResult }, { count: totalPlayers }] = await Promise.all([
    (supabase as any)
      .from('daily_results')
      .select('composite_score, time_seconds')
      .eq('user_id', userId)
      .eq('day', targetDay)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .maybeSingle(),
    totalQuery(),
  ]);

  if (!userResult) return null;

  // §217: competition rank beyond the fetched page — players strictly ahead
  // are (higher score) OR (same score, faster time); exact (score, time)
  // ties share the rank, matching the daily-medals cron.
  const [{ count: higherCount }, { count: fasterTieCount }] = await Promise.all([
    (supabase as any)
      .from('daily_results')
      .select('id', { count: 'exact', head: true })
      .eq('day', targetDay)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .gt('composite_score', userResult.composite_score),
    (supabase as any)
      .from('daily_results')
      .select('id', { count: 'exact', head: true })
      .eq('day', targetDay)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .eq('composite_score', userResult.composite_score)
      .lt('time_seconds', userResult.time_seconds ?? 0),
  ]);

  return {
    rank: (higherCount ?? 0) + (fasterTieCount ?? 0) + 1,
    totalPlayers: totalPlayers ?? 0,
  };
}

/**
 * The rows AROUND the user's rank, for the "your neighborhood" section shown
 * below the top-50 list when the user ranks past it (e.g. #425 sees ~421–429).
 * `startRank` is the 1-based rank of entries[0]; the window is clamped to start
 * after `topLimit` so it never overlaps the top list. Ranks are offset-derived
 * from the same ordering as the list, so they agree with it (ties included).
 */
export async function fetchRankWindow(
  gameMode: string,
  playType: 'solo' | 'vs',
  userRank: number,
  day?: string,
  radius: number = 4,
  topLimit: number = 50,
): Promise<{ startRank: number; entries: LeaderboardEntry[] } | null> {
  const startRank = Math.max(topLimit + 1, userRank - radius);
  const endRank = userRank + radius;
  if (endRank < startRank) return null;
  const entries = await fetchDailyLeaderboard(
    gameMode, playType, day, endRank - startRank + 1, startRank - 1,
  );
  if (entries.length === 0) return null;
  return { startRank, entries };
}

/**
 * Get the count of players who played today's daily for a given mode.
 */
export async function getDailyPlayerCount(
  gameMode: string,
  day?: string,
): Promise<number> {
  const targetDay = day || getTodayLocal();

  const { count } = await (supabase as any)
    .from('daily_results')
    .select('id', { count: 'exact', head: true })
    .eq('day', targetDay)
    .eq('game_mode', gameMode);

  return count ?? 0;
}

// ============================================================
// Sweep Leaderboard Queries
// ============================================================
// A "sweep" = completing all 9 solo dailies in a day. The Sweep board ranks
// sweepers by their combined composite score (ties broken by total time).
// These are thin callers over server-side RPCs; blocked users are dropped
// client-side (same as the per-mode board — this leaves holes in the ranks
// rather than re-closing them, which is acceptable).

export interface SweepEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_score: number;
  total_time: number;
  modes_won: number;
  is_flawless: boolean;
  rank: number;
}

export interface AllTimeSweepEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  sweep_count: number;
  flawless_count: number;
  best_sweep_time: number;
  rank: number;
}

/**
 * Fetch the daily Sweep leaderboard for a given day — players who completed
 * all 9 dailies, ranked by total composite score (time asc as tiebreak).
 */
export async function fetchDailySweepLeaderboard(
  day?: string,
  limit: number = 50,
  offset: number = 0,
): Promise<SweepEntry[]> {
  const targetDay = day || getTodayLocal();

  const { data } = await (supabase as any).rpc('daily_sweep_leaderboard', {
    p_day: targetDay,
    p_limit: limit,
    p_offset: offset,
  });

  if (!data) return [];

  return (data as any[])
    .filter((row) => !isBlocked(row.user_id))
    .map((row) => ({
      user_id: row.user_id,
      username: row.username || 'Unknown',
      avatar_url: row.avatar_url || null,
      total_score: Number(row.total_score),
      total_time: row.total_time,
      modes_won: row.modes_won,
      is_flawless: row.is_flawless,
      rank: Number(row.rank),
    }));
}

// §223: per-mode detail behind the Sweep board's dot strip + guess/hint
// totals. Fetched straight from daily_results for the board's users (the
// same publicly-readable table the per-mode boards already query), so the
// sweep RPCs never had to change shape.
export interface SweepModeDetail {
  score: number;
  completed: boolean;
}

export interface SweepDetails {
  modes: Record<string, SweepModeDetail>;
  guesses: number;
  hints: number;
}

export async function fetchSweepModeDetails(
  day: string,
  userIds: string[],
): Promise<Map<string, SweepDetails>> {
  const out = new Map<string, SweepDetails>();
  if (userIds.length === 0) return out;
  const { data } = await supabase
    .from('daily_results')
    .select('user_id, game_mode, composite_score, completed, guess_count, hints_used')
    .eq('day', day)
    .eq('play_type', 'solo')
    .in('user_id', userIds);
  for (const row of (data as any[]) ?? []) {
    let d = out.get(row.user_id);
    if (!d) {
      d = { modes: {}, guesses: 0, hints: 0 };
      out.set(row.user_id, d);
    }
    d.modes[row.game_mode] = { score: Number(row.composite_score), completed: !!row.completed };
    d.guesses += row.guess_count ?? 0;
    d.hints += row.hints_used ?? 0;
  }
  return out;
}

/**
 * The current user's Sweep rank for a given day. Null if they didn't sweep.
 */
export async function getUserSweepRank(
  userId: string,
  day?: string,
): Promise<{ rank: number; totalPlayers: number } | null> {
  const targetDay = day || getTodayLocal();

  const { data } = await (supabase as any).rpc('daily_sweep_rank', {
    p_day: targetDay,
    p_user: userId,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.rank) return null;
  return { rank: Number(row.rank), totalPlayers: Number(row.total_players) };
}

/**
 * Fetch the all-time Sweep leaderboard — players ranked by lifetime sweep count.
 */
export async function fetchAllTimeSweepLeaderboard(
  limit: number = 50,
  offset: number = 0,
): Promise<AllTimeSweepEntry[]> {
  const { data } = await (supabase as any).rpc('alltime_sweep_leaderboard', {
    p_limit: limit,
    p_offset: offset,
  });

  if (!data) return [];

  return (data as any[])
    .filter((row) => !isBlocked(row.user_id))
    .map((row) => ({
      user_id: row.user_id,
      username: row.username || 'Unknown',
      avatar_url: row.avatar_url || null,
      sweep_count: row.sweep_count,
      flawless_count: row.flawless_count,
      best_sweep_time: row.best_sweep_time,
      rank: Number(row.rank),
    }));
}

/**
 * The current user's all-time Sweep rank. Null if they've never swept.
 */
export async function getUserAllTimeSweepRank(
  userId: string,
): Promise<{ rank: number; totalPlayers: number } | null> {
  const { data } = await (supabase as any).rpc('alltime_sweep_rank', {
    p_user: userId,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.rank) return null;
  return { rank: Number(row.rank), totalPlayers: Number(row.total_players) };
}

// ============================================================
// Medal Queries
// ============================================================

export type MedalType = 'gold' | 'silver' | 'bronze' | 'streak_7' | 'streak_30' | 'streak_100' | 'perfect';

export interface Medal {
  id: string;
  day: string;
  game_mode: string;
  play_type: string;
  medal_type: MedalType;
  composite_score: number;
  created_at: string;
}

/**
 * Fetch a user's medals.
 */
export async function fetchUserMedals(
  userId: string,
  limit: number = 50,
): Promise<Medal[]> {
  const { data } = await (supabase as any)
    .from('medals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

// ============================================================
// Streak Medals
// ============================================================

const STREAK_MILESTONES: { days: number; medalType: MedalType }[] = [
  { days: 7, medalType: 'streak_7' },
  { days: 30, medalType: 'streak_30' },
  { days: 100, medalType: 'streak_100' },
];

/**
 * Check if a user has hit a daily-play streak milestone and award a medal.
 * Called after recording a daily result.
 */
export async function checkAndAwardStreakMedals(userId: string, day: string) {
  // Get the user's current daily login streak from profile
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('daily_login_streak')
    .eq('id', userId)
    .single();

  if (!profile) return;

  const streak = profile.daily_login_streak || 0;

  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone.days) {
      // Check if they already have this streak medal (ever)
      const { data: existing } = await (supabase as any)
        .from('medals')
        .select('id')
        .eq('user_id', userId)
        .eq('medal_type', milestone.medalType)
        .limit(1);

      if (!existing || existing.length === 0) {
        await (supabase as any)
          .from('medals')
          .insert({
            user_id: userId,
            day,
            game_mode: 'ALL',
            play_type: 'solo',
            medal_type: milestone.medalType,
            composite_score: streak,
          });
      }
    }
  }
}

// ============================================================
// Perfect Game Medals
// ============================================================

/**
 * Check if a game result qualifies as a "perfect game" and award a medal.
 * Perfect = solved in the minimum possible guesses for the mode.
 */
export async function checkAndAwardPerfectMedal(
  userId: string,
  gameMode: string,
  day: string,
  guessCount: number,
  boardsSolved: number,
  totalBoards: number,
  completed: boolean,
) {
  if (!completed) return;

  // Define perfect criteria per mode
  const perfectCriteria: Record<string, () => boolean> = {
    DUEL: () => guessCount === 1,
    PROPERNOUNDLE: () => guessCount === 1,
    DUEL_6: () => guessCount === 1,
    DUEL_7: () => guessCount === 1,
    QUORDLE: () => boardsSolved === 4 && guessCount <= 4,
    OCTORDLE: () => boardsSolved === 8 && guessCount <= 8,
    SEQUENCE: () => boardsSolved === 4 && guessCount <= 4,
    RESCUE: () => boardsSolved === 4 && guessCount <= 4,
    GAUNTLET: () => boardsSolved === 21,
  };

  const check = perfectCriteria[gameMode];
  if (!check || !check()) return;

  // Check if they already have a perfect medal for this day+mode
  const { data: existing } = await (supabase as any)
    .from('medals')
    .select('id')
    .eq('user_id', userId)
    .eq('day', day)
    .eq('game_mode', gameMode)
    .eq('medal_type', 'perfect')
    .limit(1);

  if (existing && existing.length > 0) return;

  await (supabase as any)
    .from('medals')
    .insert({
      user_id: userId,
      day,
      game_mode: gameMode,
      play_type: 'solo',
      medal_type: 'perfect',
      composite_score: guessCount,
    });
}

// ============================================================
// All-Time Records
// ============================================================

export interface AllTimeRecord {
  id: string;
  record_type: string;
  game_mode: string | null;
  play_type: string | null;
  holder_id: string;
  holder_username?: string;
  holder_avatar_url?: string | null;
  record_value: number;
  achieved_at: string;
}

/**
 * Check and update an all-time record if the new value beats the current.
 */
export async function checkAndUpdateRecord(
  recordType: string,
  gameMode: string | null,
  playType: string | null,
  holderId: string,
  newValue: number,
  higherIsBetter: boolean = true,
) {
  // Fetch ALL rows for this key (NOT maybeSingle): global records
  // (game_mode/play_type = NULL) historically accumulated duplicates because
  // a UNIQUE(record_type, game_mode, play_type) constraint treats NULLs as
  // distinct, so `upsert onConflict` could never match them and inserted a
  // fresh row every game. This routine is now self-healing: it collapses any
  // duplicates for the key into a single canonical row on every write.
  const query = (supabase as any)
    .from('all_time_records')
    .select('id, record_value, holder_id')
    .eq('record_type', recordType);

  if (gameMode) query.eq('game_mode', gameMode);
  else query.is('game_mode', null);

  if (playType) query.eq('play_type', playType);
  else query.is('play_type', null);

  // Best existing first (desc for higher-is-better, asc otherwise).
  const { data: rowsRaw } = await query.order('record_value', { ascending: !higherIsBetter });
  const rows: Array<{ id: string; record_value: number; holder_id: string }> = rowsRaw || [];
  const best = rows[0];

  const challengerWins = !best
    ? true
    : (higherIsBetter ? newValue > best.record_value : newValue < best.record_value);

  const winnerValue = challengerWins ? newValue : best.record_value;
  const winnerHolder = challengerWins ? holderId : best.holder_id;
  const nowIso = new Date().toISOString();

  if (rows.length === 0) {
    // No record yet — insert the first one.
    await (supabase as any).from('all_time_records').insert({
      record_type: recordType,
      game_mode: gameMode,
      play_type: playType,
      holder_id: winnerHolder,
      record_value: winnerValue,
      achieved_at: nowIso,
      updated_at: nowIso,
    });
  } else {
    // Keep the best row as canonical (update it), and delete any duplicates.
    await (supabase as any).from('all_time_records').update({
      holder_id: winnerHolder,
      record_value: winnerValue,
      updated_at: nowIso,
      ...(challengerWins ? { achieved_at: nowIso } : {}),
    }).eq('id', best.id);

    if (rows.length > 1) {
      await (supabase as any)
        .from('all_time_records')
        .delete()
        .in('id', rows.slice(1).map((r) => r.id));
    }
  }

  return challengerWins; // true == record broken
}

/**
 * Fetch all all-time records.
 */
export async function fetchAllTimeRecords(): Promise<AllTimeRecord[]> {
  const { data } = await (supabase as any)
    .from('all_time_records')
    .select(`
      *,
      profiles!inner(username, avatar_url, avatar_emoji, is_banned)
    `)
    .order('record_type');

  if (!data) return [];

  // Banned users can't hold visible records — excluded client-side.
  return data.filter((row: any) => !row.profiles?.is_banned).map((row: any) => ({
    id: row.id,
    record_type: row.record_type,
    game_mode: row.game_mode,
    play_type: row.play_type,
    holder_id: row.holder_id,
    holder_username: row.profiles?.username,
    holder_avatar_url: row.profiles?.avatar_url,
    record_value: row.record_value,
    achieved_at: row.achieved_at,
  }));
}

// ============================================================
// Time Helpers
// ============================================================

// ============================================================
// Share Result
// ============================================================

/**
 * Generate a spoiler-free shareable text for a daily result.
 */
export function generateShareText(
  gameMode: string,
  completed: boolean,
  guessCount: number,
  maxGuesses: number,
  timeSeconds: number,
  boardsSolved: number,
  totalBoards: number,
): string {
  const config = MODE_SCORE_CONFIG[gameMode];
  const modeNames: Record<string, string> = {
    DUEL: 'Classic',
    QUORDLE: 'QuadWord',
    OCTORDLE: 'OctoWord',
    SEQUENCE: 'Succession',
    RESCUE: 'Deliverance',
    GAUNTLET: 'Gauntlet',
    PROPERNOUNDLE: 'ProperNoundle',
    DUEL_6: 'Six',
    DUEL_7: 'Seven',
  };

  const modeName = modeNames[gameMode] || gameMode;
  const day = getTodayLocal();
  const mins = Math.floor(timeSeconds / 60);
  const secs = timeSeconds % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

  const lines = [`Wordocious Daily — ${modeName}`, day];

  if (totalBoards > 1) {
    lines.push(`${boardsSolved}/${totalBoards} boards`);
  }

  if (completed) {
    lines.push(`${guessCount}/${maxGuesses} in ${timeStr}`);
  } else {
    lines.push(`DNF in ${timeStr}`);
  }

  lines.push('', 'https://wordocious.com/daily');

  return lines.join('\n');
}

/**
 * Seconds remaining until the user's LOCAL midnight. Drives the
 * "next puzzle in HH:MM:SS" countdown on the home and daily pages.
 */
export function getSecondsUntilMidnightLocal(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

export interface DailyCompletion {
  won: boolean;
  guesses: number;
  timeSeconds: number;
  /** Per-mode daily composite score (daily_results.composite_score). */
  score: number;
}

/** Aggregate totals across today's daily completions — the single source the
 *  Sweep/Flawless banner, celebration modal, and share card all consume so the
 *  three never disagree. */
export interface DailyTotals {
  completed: number;
  won: number;
  total: number;
  totalGuesses: number;
  totalTimeSeconds: number;
  totalScore: number;
  flawless: boolean;
}

export function computeDailyTotals(completions: Map<string, DailyCompletion>): DailyTotals {
  let won = 0, totalGuesses = 0, totalTimeSeconds = 0, totalScore = 0;
  for (const c of completions.values()) {
    if (c.won) won += 1;
    totalGuesses += c.guesses;
    totalTimeSeconds += c.timeSeconds;
    totalScore += c.score;
  }
  const completed = completions.size;
  return {
    completed, won, total: DAILY_MODE_COUNT, totalGuesses, totalTimeSeconds, totalScore,
    flawless: completed >= DAILY_MODE_COUNT && won >= DAILY_MODE_COUNT,
  };
}

/**
 * Return a map of game_mode → result for today's solo daily entries.
 * Used by the home-screen mode cards (to badge completed dailies with
 * their W/L + guesses + time), the profile page W/L pills, and the
 * sweep-detection logic on both surfaces.
 */
export async function fetchTodayDailyCompletions(
  userId: string,
): Promise<Map<string, DailyCompletion>> {
  const day = getTodayLocal();
  const { data } = await (supabase as any)
    .from('daily_results')
    .select('game_mode, completed, guess_count, time_seconds, composite_score')
    .eq('user_id', userId)
    .eq('day', day)
    .eq('play_type', 'solo') as {
    data: Array<{
      game_mode: string;
      completed: boolean;
      guess_count: number;
      time_seconds: number;
      composite_score: number;
    }> | null;
  };

  const out = new Map<string, DailyCompletion>();
  for (const row of data || []) {
    out.set(row.game_mode, {
      won: !!row.completed,
      guesses: row.guess_count ?? 0,
      timeSeconds: row.time_seconds ?? 0,
      score: Math.round(row.composite_score ?? 0),
    });
  }
  return out;
}

// Keep in sync with DAILY_MODES on the profile page + home — 9 modes
// have solo daily seeds today (DUEL, QUORDLE, OCTORDLE, SEQUENCE,
// RESCUE, DUEL_6, DUEL_7, GAUNTLET, PROPERNOUNDLE).
const DAILY_MODE_COUNT = 9;
const DAILY_SWEEP_XP = 200;
const FLAWLESS_EXTRA_XP = 400;

export interface DailyBonusResult {
  sweepAwarded: boolean;
  flawlessAwarded: boolean;
  xpBonus: number;
}

/**
 * Called after recordDailyResult lands a new row. Counts today's daily
 * results and, if the user has completed all N dailies for the first
 * time today, writes the one-shot daily_bonuses row and adds bonus XP
 * to their profile. Flawless Victory piles on +400 XP more if every
 * one of those N is a win.
 *
 * Returns a summary so the caller can surface the bonus via XpToast.
 * Returns null when nothing new was awarded (still short of 7, or
 * already awarded today).
 */
export async function awardDailyBonusesIfComplete(_userId: string): Promise<DailyBonusResult | null> {
  const day = getTodayLocal();

  // Delegated to /api/daily/award-bonuses. The client used to write the
  // daily_bonuses row itself, but that row IS the all-time sweep leaderboard —
  // alltime_sweep_leaderboard ranks players by counting rows with
  // sweep_awarded = true, so a client that can write the flag can award itself
  // any number of sweeps for days it never played. The server recomputes the
  // whole thing from daily_results and grants the XP.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  try {
    const res = await fetch('/api/daily/award-bonuses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ day }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.awarded) return null;
    return {
      sweepAwarded: !!data.sweepAwarded,
      flawlessAwarded: !!data.flawlessAwarded,
      xpBonus: data.xpBonus ?? 0,
    };
  } catch {
    // Best-effort: a failed bonus call must never break result recording.
    return null;
  }
}
