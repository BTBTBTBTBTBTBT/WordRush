import { supabase } from './supabase-client';
import { isDailySeed } from '@wordle-duel/core';
import { recordDailyResult, recordDailyVsResult, checkAndUpdateRecord, awardDailyBonusesIfComplete } from './daily-service';
import { checkAchievements } from './achievement-service';
import { awardGameCoins, awardStreakBonus } from './coin-service';
import { grantFreeShield } from './shield-service';

export interface XpResult {
  xpGain: number;
  streakBonus: number;
  dailyBonus: number;
  totalXp: number;
  newLevel: number;
  leveledUp: boolean;
  /** +200 XP the first time the user completes all 7 dailies today. */
  sweepBonus?: number;
  /** +400 XP additional if every one of those 7 was a win. */
  flawlessBonus?: number;
}

/**
 * Record a game result (solo or VS) — upserts user_stats and updates profile.
 * If the seed is a daily seed, also records daily results and checks all-time records.
 * Returns XP details for post-game display.
 */
export async function recordGameResult(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  won: boolean,
  guessCount: number,
  timeMs: number,
  seed?: string,
  boardsSolved?: number,
  totalBoards?: number,
): Promise<XpResult | null> {
  const timeSeconds = Math.round(timeMs / 1000);

  // Fetch existing stats for this mode+playType
  const { data: existing } = await (supabase as any)
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .maybeSingle() as { data: any };

  if (existing) {
    const newTotalGames = existing.total_games + 1;
    const newAvgTime = existing.average_time > 0
      ? Math.round((existing.average_time * existing.total_games + timeSeconds) / newTotalGames)
      : timeSeconds;

    await (supabase as any)
      .from('user_stats')
      .update({
        wins: existing.wins + (won ? 1 : 0),
        losses: existing.losses + (won ? 0 : 1),
        total_games: newTotalGames,
        best_score: guessCount > 0 && (existing.best_score === 0 || guessCount < existing.best_score)
          ? guessCount
          : existing.best_score,
        average_time: newAvgTime,
        fastest_time: timeSeconds > 0 && (existing.fastest_time === 0 || timeSeconds < existing.fastest_time)
          ? timeSeconds
          : existing.fastest_time,
      })
      .eq('id', existing.id);
  } else {
    await (supabase as any)
      .from('user_stats')
      .insert({
        user_id: userId,
        game_mode: gameMode,
        play_type: playType,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        total_games: 1,
        best_score: guessCount,
        average_time: timeSeconds,
        fastest_time: timeSeconds,
      });
  }

  // Update profile totals + daily login streak in a single fetch/update
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('total_wins, total_losses, current_streak, best_streak, xp, level, last_played_at, daily_login_streak, best_daily_login_streak')
    .eq('id', userId)
    .single() as { data: any };

  if (profile) {
    // --- Win streak (resets on loss) ---
    const newWinStreak = won ? profile.current_streak + 1 : 0;
    const newBestWinStreak = Math.max(profile.best_streak, newWinStreak);

    // --- XP ---
    const xpGain = won ? 100 : 25;
    const streakBonus = won && newWinStreak > 1 ? 50 : 0;
    const isDailyGame = seed ? isDailySeed(seed) : false;
    const dailyBonus = isDailyGame ? 50 : 0;
    const totalXpGain = xpGain + streakBonus + dailyBonus;
    const newXp = profile.xp + totalXpGain;
    const oldLevel = profile.level || Math.floor(profile.xp / 1000) + 1;
    const newLevel = Math.floor(newXp / 1000) + 1;

    // --- Daily login streak (consecutive days played, UTC) ---
    const now = new Date();
    const lastPlayed = profile.last_played_at ? new Date(profile.last_played_at) : null;
    let newDailyStreak = profile.daily_login_streak || 0;

    if (lastPlayed) {
      const lastDay = lastPlayed.toISOString().slice(0, 10);
      const today = now.toISOString().slice(0, 10);
      const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

      if (lastDay === today) {
        // Same UTC day — no change to daily streak
      } else if (lastDay === yesterday) {
        // Consecutive UTC day — increment
        newDailyStreak += 1;
        if (newDailyStreak % 7 === 0) {
          awardStreakBonus(userId, newDailyStreak).catch(() => {});
          grantFreeShield(userId).catch(() => {});
        }
      } else {
        // Missed a day — reset to 1 (today counts)
        newDailyStreak = 1;
      }
    } else {
      newDailyStreak = 1;
    }

    const newBestDailyStreak = Math.max(profile.best_daily_login_streak || 0, newDailyStreak);

    await (supabase as any)
      .from('profiles')
      .update({
        total_wins: profile.total_wins + (won ? 1 : 0),
        total_losses: profile.total_losses + (won ? 0 : 1),
        current_streak: newWinStreak,
        best_streak: newBestWinStreak,
        xp: newXp,
        level: newLevel,
        last_played_at: now.toISOString(),
        daily_login_streak: newDailyStreak,
        best_daily_login_streak: newBestDailyStreak,
      })
      .eq('id', userId);

    // Award SpellCoins for game result
    awardGameCoins(userId, won, isDailyGame).catch(() => {});
  }

  // --- Daily result recording ---
  let sweepResult: Awaited<ReturnType<typeof awardDailyBonusesIfComplete>> = null;
  if (seed && isDailySeed(seed)) {
    const boards = boardsSolved ?? (won ? (totalBoards ?? 1) : 0);
    const total = totalBoards ?? 1;

    if (playType === 'vs') {
      await recordDailyVsResult(userId, gameMode, won);
    } else {
      await recordDailyResult(
        userId, gameMode, playType, won, guessCount, timeSeconds, boards, total,
      );
      // After the solo daily row lands, see whether this was the 7th
      // of the day and award the one-shot Daily Sweep / Flawless
      // Victory bonuses if so. Awaited so the XpResult below can carry
      // the new XP into the XpToast in a single render.
      sweepResult = await awardDailyBonusesIfComplete(userId);
    }
  }

  // --- All-time record checks ---
  if (won && timeSeconds > 0) {
    checkAndUpdateRecord('fastest_win', gameMode, playType, userId, timeSeconds, false).catch(() => {});
  }
  if (won && guessCount > 0) {
    checkAndUpdateRecord('fewest_guesses', gameMode, playType, userId, guessCount, false).catch(() => {});
  }

  // Most games played (per mode) — fetch current total_games from user_stats
  try {
    const { data: stats } = await (supabase as any)
      .from('user_stats')
      .select('total_games')
      .eq('user_id', userId)
      .eq('game_mode', gameMode)
      .eq('play_type', playType)
      .maybeSingle() as { data: any };
    if (stats?.total_games) {
      checkAndUpdateRecord('most_games_played', gameMode, playType, userId, stats.total_games, true).catch(() => {});
    }
  } catch {}

  // Longest win streak (global — profile best_streak)
  if (profile) {
    const newBestStreak = Math.max(profile.best_streak || 0, won ? (profile.current_streak || 0) + 1 : 0);
    if (newBestStreak > 0) {
      checkAndUpdateRecord('longest_streak', null, null, userId, newBestStreak, true).catch(() => {});
    }
  }

  // Highest level (global)
  if (profile) {
    const xpForLevel = (won ? 100 : 25) + (won && (profile.current_streak || 0) > 0 ? 50 : 0) + ((seed && isDailySeed(seed)) ? 50 : 0);
    const currentLevel = Math.floor(((profile.xp || 0) + xpForLevel) / 1000) + 1;
    checkAndUpdateRecord('highest_level', null, null, userId, currentLevel, true).catch(() => {});
  }

  // Most gold medals (global)
  if (profile) {
    try {
      const { data: medalProfile } = await (supabase as any)
        .from('profiles')
        .select('gold_medals')
        .eq('id', userId)
        .single() as { data: any };
      if (medalProfile?.gold_medals > 0) {
        checkAndUpdateRecord('most_gold_medals', null, null, userId, medalProfile.gold_medals, true).catch(() => {});
      }
    } catch {}
  }

  // Most daily completions (global — count from daily_results)
  if (seed && isDailySeed(seed)) {
    try {
      const { count } = await (supabase as any)
        .from('daily_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true);
      if (count && count > 0) {
        checkAndUpdateRecord('most_daily_completions', null, null, userId, count, true).catch(() => {});
      }
    } catch {}
  }

  // Check achievements (fire-and-forget, don't block game flow)
  checkAchievements(userId, gameMode, playType, won, guessCount, timeSeconds, seed).catch(() => {});

  // Return XP details for post-game display
  if (profile) {
    const xpGain = won ? 100 : 25;
    const streakBonusVal = won && (profile.current_streak + (won ? 1 : 0)) > 1 ? 50 : 0;
    const dailyBonusVal = (seed && isDailySeed(seed)) ? 50 : 0;
    const sweepExtraXp = sweepResult?.xpBonus ?? 0;
    const sweepBonus = sweepResult?.sweepAwarded
      ? (sweepResult.flawlessAwarded ? 200 : sweepResult.xpBonus)
      : 0;
    const flawlessBonus = sweepResult?.flawlessAwarded ? 400 : 0;
    const totalXp = xpGain + streakBonusVal + dailyBonusVal + sweepExtraXp;
    return {
      xpGain,
      streakBonus: streakBonusVal,
      dailyBonus: dailyBonusVal,
      totalXp,
      newLevel: Math.floor(((profile.xp || 0) + totalXp) / 1000) + 1,
      leveledUp: Math.floor(((profile.xp || 0) + totalXp) / 1000) + 1 > (profile.level || 1),
      sweepBonus: sweepBonus > 0 ? sweepBonus : undefined,
      flawlessBonus: flawlessBonus > 0 ? flawlessBonus : undefined,
    };
  }
  return null;
}

/**
 * Record a match entry for match history.
 */
export async function recordMatch(data: {
  gameMode: string;
  player1Id: string;
  player2Id?: string;
  winnerId?: string;
  player1Score: number;
  player2Score?: number;
  player1Time: number;
  player2Time?: number;
  seed: string;
  solutions: string[];
  player1Guesses: string[];
  player2Guesses?: string[];
  startedAt: string;
  completedAt: string;
}) {
  await (supabase as any).from('matches').insert({
    game_mode: data.gameMode,
    player1_id: data.player1Id,
    player2_id: data.player2Id || null,
    winner_id: data.winnerId || null,
    player1_score: data.player1Score,
    player2_score: data.player2Score ?? null,
    player1_time: data.player1Time,
    player2_time: data.player2Time ?? null,
    seed: data.seed,
    solutions: data.solutions,
    player1_guesses: data.player1Guesses,
    player2_guesses: data.player2Guesses ?? null,
    started_at: data.startedAt,
    completed_at: data.completedAt,
  });
}

/**
 * Record a solo game completion as a match-history row.
 * Writes to the `matches` table with player2_id = null so it appears in the
 * profile's Recent Matches list alongside VS results.
 */
export async function recordSoloMatch(data: {
  userId: string;
  gameMode: string;
  won: boolean;
  score: number;
  timeSeconds: number;
  seed: string;
  solutions: string[];
  guesses: string[];
  startedAtIso: string;
}) {
  try {
    await (supabase as any).from('matches').insert({
      game_mode: data.gameMode,
      player1_id: data.userId,
      player2_id: null,
      winner_id: data.won ? data.userId : null,
      player1_score: data.score,
      player1_time: data.timeSeconds,
      seed: data.seed,
      solutions: data.solutions,
      player1_guesses: data.guesses,
      started_at: data.startedAtIso,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('recordSoloMatch failed:', err);
  }
}

/**
 * Fetch recent matches for a user.
 */
export async function fetchRecentMatches(userId: string, limit: number = 10) {
  const { data } = await (supabase as any)
    .from('matches')
    .select('*')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit) as { data: any[] | null };

  return data || [];
}

/**
 * Fetch per-day match counts for the last N days, anchored to today's
 * UTC date. Returns an array of length `days` from oldest → newest, each
 * entry `{ day: 'YYYY-MM-DD', count: number }`. Empty days get count 0
 * so the caller can render a gapless bar chart.
 */
export async function fetchActivityByDay(userId: string, days: number = 7) {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));

  const { data } = await (supabase as any)
    .from('matches')
    .select('created_at')
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .gte('created_at', since.toISOString()) as { data: Array<{ created_at: string }> | null };

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of data || []) {
    const key = row.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}
