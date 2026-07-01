/**
 * "Beat Your Best" ghost — replays the pace of the player's own best recorded
 * run for a mode as a CPU opponent. Reuses the `matches` table (no new storage):
 * the ghost's guess count + total time drive a bot trajectory on the CURRENT
 * seed, so the player races their personal best rather than a synthetic bot.
 */
import { supabase } from '@/lib/supabase-client';

export interface GhostRun {
  guessCount: number;
  timeMs: number;
}

/** Fewest-guesses, then fastest winning solo run for (user, mode). null if none. */
export async function fetchBestGhostRun(userId: string, gameMode: string): Promise<GhostRun | null> {
  try {
    const { data } = await (supabase as any)
      .from('matches')
      .select('player1_score, player1_time')
      .eq('player1_id', userId)
      .eq('game_mode', gameMode)
      .eq('winner_id', userId)
      .gt('player1_time', 0)
      .gt('player1_score', 0)
      .order('player1_score', { ascending: true })
      .order('player1_time', { ascending: true })
      .limit(1);
    const row = data?.[0];
    if (!row) return null;
    return { guessCount: row.player1_score, timeMs: row.player1_time * 1000 };
  } catch {
    return null;
  }
}
