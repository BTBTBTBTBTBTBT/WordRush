import { supabase } from './supabase-client';
import { isDailySeed } from '@wordle-duel/core';
import { recordDailyResult, recordDailyVsResult, checkAndUpdateRecord } from './daily-service';
import { checkAchievements } from './achievement-service';
import { awardGameCoins, awardStreakBonus } from './coin-service';
import { grantFreeShield } from './shield-service';

/**
 * Record a game result (solo or VS) — upserts user_stats and updates profile.
 * If the seed is a daily seed, also records daily results and checks all-time records.
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
) {
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
    const newXp = profile.xp + xpGain + streakBonus;
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
    const isDailyGame = seed ? isDailySeed(seed) : false;
    awardGameCoins(userId, won, isDailyGame).catch(() => {});
  }

  // --- Daily result recording ---
  if (seed && isDailySeed(seed)) {
    const boards = boardsSolved ?? (won ? (totalBoards ?? 1) : 0);
    const total = totalBoards ?? 1;

    if (playType === 'vs') {
      await recordDailyVsResult(userId, gameMode, won);
    } else {
      await recordDailyResult(
        userId, gameMode, playType, won, guessCount, timeSeconds, boards, total,
      );
    }
  }

  // --- All-time record checks ---
  if (won && timeSeconds > 0) {
    await checkAndUpdateRecord('fastest_win', gameMode, playType, userId, timeSeconds, false);
  }
  if (won && guessCount > 0) {
    await checkAndUpdateRecord('fewest_guesses', gameMode, playType, userId, guessCount, false);
  }

  // Check achievements (fire-and-forget, don't block game flow)
  checkAchievements(userId, gameMode, playType, won, guessCount, timeSeconds, seed).catch(() => {});
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
