import { supabase } from './supabase-client';

// ============================================================
// Composite Score Calculation
// ============================================================

interface ScoreConfig {
  maxGuesses: number;
  guessWeight: number;
  timeCap: number;
  totalBoards: number;
}

const MODE_SCORE_CONFIG: Record<string, ScoreConfig> = {
  DUEL:          { maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1 },
  QUORDLE:       { maxGuesses: 9,  guessWeight: 50,  timeCap: 600,  totalBoards: 4 },
  OCTORDLE:      { maxGuesses: 13, guessWeight: 30,  timeCap: 900,  totalBoards: 8 },
  SEQUENCE:      { maxGuesses: 10, guessWeight: 60,  timeCap: 480,  totalBoards: 4 },
  RESCUE:        { maxGuesses: 6,  guessWeight: 80,  timeCap: 480,  totalBoards: 4 },
  GAUNTLET:      { maxGuesses: 44, guessWeight: 20,  timeCap: 1800, totalBoards: 21 },
  PROPERNOUNDLE: { maxGuesses: 6,  guessWeight: 100, timeCap: 300,  totalBoards: 1 },
};

export function calculateCompositeScore(
  gameMode: string,
  completed: boolean,
  guessCount: number,
  timeSeconds: number,
  boardsSolved: number,
  totalBoards: number,
): number {
  const config = MODE_SCORE_CONFIG[gameMode];
  if (!config) return 0;

  const basePoints = completed ? 1000 : 0;
  const guessBonus = completed
    ? Math.max(0, config.maxGuesses - guessCount) * config.guessWeight
    : 0;
  const timeBonus = completed
    ? Math.max(0, config.timeCap - timeSeconds)
    : 0;
  const completionBonus = (boardsSolved / Math.max(1, totalBoards)) * 200;

  return Math.round((basePoints + guessBonus + timeBonus + completionBonus) * 100) / 100;
}

export function calculateVsCompositeScore(
  vsWins: number,
  vsLosses: number,
  vsGames: number,
): number {
  if (vsGames < 3) return 0; // Minimum games to qualify
  const winRate = vsWins / Math.max(1, vsGames);
  return Math.round((vsWins * 100 + winRate * 50 + vsGames * 5) * 100) / 100;
}

// ============================================================
// Daily Seed Management
// ============================================================

/**
 * Get today's date as YYYY-MM-DD in UTC.
 */
export function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Fetch the daily seed for a specific mode and day.
 * If it doesn't exist yet, create it on the fly.
 */
export async function fetchDailySeed(
  gameMode: string,
  day?: string,
): Promise<{ seed: string; solutions: string[] } | null> {
  const targetDay = day || getTodayUTC();

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
) {
  const day = getTodayUTC();
  const compositeScore = calculateCompositeScore(
    gameMode, completed, guessCount, timeSeconds, boardsSolved, totalBoards,
  );

  const { data: existing } = await (supabase as any)
    .from('daily_results')
    .select('id, composite_score')
    .eq('user_id', userId)
    .eq('day', day)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .maybeSingle();

  if (existing) {
    // Only update if new score is better
    if (compositeScore > existing.composite_score) {
      await (supabase as any)
        .from('daily_results')
        .update({
          completed,
          guess_count: guessCount,
          time_seconds: timeSeconds,
          boards_solved: boardsSolved,
          total_boards: totalBoards,
          composite_score: compositeScore,
        })
        .eq('id', existing.id);
    }
  } else {
    await (supabase as any)
      .from('daily_results')
      .insert({
        user_id: userId,
        day,
        game_mode: gameMode,
        play_type: playType,
        completed,
        guess_count: guessCount,
        time_seconds: timeSeconds,
        boards_solved: boardsSolved,
        total_boards: totalBoards,
        composite_score: compositeScore,
      });
  }

  // Check for streak and perfect game medals (fire-and-forget)
  checkAndAwardStreakMedals(userId, day).catch(() => {});
  checkAndAwardPerfectMedal(userId, gameMode, day, guessCount, boardsSolved, totalBoards, completed).catch(() => {});

  return compositeScore;
}

/**
 * Record or update a daily VS result (accumulates wins/losses for the day).
 */
export async function recordDailyVsResult(
  userId: string,
  gameMode: string,
  won: boolean,
) {
  const day = getTodayUTC();

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
    const newLosses = existing.vs_losses + (won ? 0 : 1);
    const newGames = existing.vs_games + 1;
    const compositeScore = calculateVsCompositeScore(newWins, newLosses, newGames);

    await (supabase as any)
      .from('daily_results')
      .update({
        vs_wins: newWins,
        vs_losses: newLosses,
        vs_games: newGames,
        composite_score: compositeScore,
        completed: true,
      })
      .eq('id', existing.id);
  } else {
    const wins = won ? 1 : 0;
    const losses = won ? 0 : 1;
    const compositeScore = calculateVsCompositeScore(wins, losses, 1);

    await (supabase as any)
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
  }
}

// ============================================================
// Leaderboard Queries
// ============================================================

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  composite_score: number;
  guess_count: number;
  time_seconds: number;
  boards_solved: number;
  total_boards: number;
  vs_wins: number;
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
): Promise<LeaderboardEntry[]> {
  const targetDay = day || getTodayUTC();

  const { data } = await (supabase as any)
    .from('daily_results')
    .select(`
      user_id,
      composite_score,
      guess_count,
      time_seconds,
      boards_solved,
      total_boards,
      vs_wins,
      vs_games,
      completed,
      profiles!inner(username, avatar_url)
    `)
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .order('composite_score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!data) return [];

  return data.map((row: any) => ({
    user_id: row.user_id,
    username: row.profiles?.username || 'Unknown',
    avatar_url: row.profiles?.avatar_url || null,
    composite_score: row.composite_score,
    guess_count: row.guess_count,
    time_seconds: row.time_seconds,
    boards_solved: row.boards_solved,
    total_boards: row.total_boards,
    vs_wins: row.vs_wins,
    vs_games: row.vs_games,
    completed: row.completed,
  }));
}

/**
 * Get the current user's rank for today's daily.
 */
export async function getUserDailyRank(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  day?: string,
): Promise<{ rank: number; totalPlayers: number } | null> {
  const targetDay = day || getTodayUTC();

  // Get the user's score
  const { data: userResult } = await (supabase as any)
    .from('daily_results')
    .select('composite_score')
    .eq('user_id', userId)
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .maybeSingle();

  if (!userResult) return null;

  // Count how many players scored higher
  const { count: higherCount } = await (supabase as any)
    .from('daily_results')
    .select('id', { count: 'exact', head: true })
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .gt('composite_score', userResult.composite_score);

  // Count total players
  const { count: totalPlayers } = await (supabase as any)
    .from('daily_results')
    .select('id', { count: 'exact', head: true })
    .eq('day', targetDay)
    .eq('game_mode', gameMode)
    .eq('play_type', playType);

  return {
    rank: (higherCount ?? 0) + 1,
    totalPlayers: totalPlayers ?? 0,
  };
}

/**
 * Get the count of players who played today's daily for a given mode.
 */
export async function getDailyPlayerCount(
  gameMode: string,
  day?: string,
): Promise<number> {
  const targetDay = day || getTodayUTC();

  const { count } = await (supabase as any)
    .from('daily_results')
    .select('id', { count: 'exact', head: true })
    .eq('day', targetDay)
    .eq('game_mode', gameMode);

  return count ?? 0;
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

/**
 * Assign medals for the previous day. Called client-side as a best-effort
 * or via a server cron. Idempotent due to UNIQUE constraint.
 */
export async function assignDailyMedals(day?: string) {
  const targetDay = day || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const gameModes = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE'];
  const playTypes = ['solo', 'vs'] as const;

  for (const mode of gameModes) {
    for (const pt of playTypes) {
      const leaderboard = await fetchDailyLeaderboard(mode, pt, targetDay, 3);
      const medalTypes = ['gold', 'silver', 'bronze'] as const;

      for (let i = 0; i < Math.min(leaderboard.length, 3); i++) {
        const entry = leaderboard[i];
        if (entry.composite_score <= 0) continue;

        // Insert medal (UNIQUE constraint prevents duplicates)
        await (supabase as any)
          .from('medals')
          .upsert({
            user_id: entry.user_id,
            day: targetDay,
            game_mode: mode,
            play_type: pt,
            medal_type: medalTypes[i],
            composite_score: entry.composite_score,
          }, { onConflict: 'user_id,day,game_mode,play_type' });

        // Update profile medal counter
        const medalCol = `${medalTypes[i]}_medals`;
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select(medalCol)
          .eq('id', entry.user_id)
          .single();

        if (profile) {
          await (supabase as any)
            .from('profiles')
            .update({ [medalCol]: (profile[medalCol] || 0) + 1 })
            .eq('id', entry.user_id);
        }
      }
    }
  }
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
  const query = (supabase as any)
    .from('all_time_records')
    .select('id, record_value')
    .eq('record_type', recordType);

  if (gameMode) query.eq('game_mode', gameMode);
  else query.is('game_mode', null);

  if (playType) query.eq('play_type', playType);
  else query.is('play_type', null);

  const { data: existing } = await query.maybeSingle();

  const isBetter = existing
    ? (higherIsBetter ? newValue > existing.record_value : newValue < existing.record_value)
    : true;

  if (isBetter) {
    await (supabase as any)
      .from('all_time_records')
      .upsert({
        record_type: recordType,
        game_mode: gameMode,
        play_type: playType,
        holder_id: holderId,
        record_value: newValue,
        achieved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'record_type,game_mode,play_type' });

    return true; // Record broken!
  }

  return false;
}

/**
 * Fetch all all-time records.
 */
export async function fetchAllTimeRecords(): Promise<AllTimeRecord[]> {
  const { data } = await (supabase as any)
    .from('all_time_records')
    .select(`
      *,
      profiles!inner(username, avatar_url)
    `)
    .order('record_type');

  if (!data) return [];

  return data.map((row: any) => ({
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
  };

  const modeName = modeNames[gameMode] || gameMode;
  const day = getTodayUTC();
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
 * Get seconds remaining until UTC midnight.
 */
export function getSecondsUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

/**
 * Return the set of game_modes the user has completed (won or attempted)
 * in today's daily for the solo play_type. Used by the profile page to
 * render the "Today's Dailies" strip.
 */
export async function fetchTodayDailyCompletions(userId: string): Promise<Set<string>> {
  const day = getTodayUTC();
  const { data } = await (supabase as any)
    .from('daily_results')
    .select('game_mode')
    .eq('user_id', userId)
    .eq('day', day)
    .eq('play_type', 'solo') as { data: Array<{ game_mode: string }> | null };

  return new Set((data || []).map((r) => r.game_mode));
}
