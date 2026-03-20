import { supabase } from './supabase-client';

/**
 * Record a game result (solo or VS) — upserts user_stats and updates profile.
 */
export async function recordGameResult(
  userId: string,
  gameMode: string,
  playType: 'solo' | 'vs',
  won: boolean,
  guessCount: number,
  timeMs: number
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

  // Update profile totals
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('total_wins, total_losses, current_streak, best_streak, xp, level')
    .eq('id', userId)
    .single() as { data: any };

  if (profile) {
    const newStreak = won ? profile.current_streak + 1 : 0;
    const newBestStreak = Math.max(profile.best_streak, newStreak);
    const xpGain = won ? 100 : 25;
    const streakBonus = won && newStreak > 1 ? 50 : 0;
    const newXp = profile.xp + xpGain + streakBonus;
    const newLevel = Math.floor(newXp / 1000) + 1;

    await (supabase as any)
      .from('profiles')
      .update({
        total_wins: profile.total_wins + (won ? 1 : 0),
        total_losses: profile.total_losses + (won ? 0 : 1),
        current_streak: newStreak,
        best_streak: newBestStreak,
        xp: newXp,
        level: newLevel,
      })
      .eq('id', userId);
  }
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
