import { supabase } from './supabase-client';

export interface HeadToHeadRecord {
  myWins: number;
  theirWins: number;
  draws: number;
}

export interface VsProfile {
  username: string;
  avatarUrl: string | null;
  level: number;
}

/**
 * All-time head-to-head record between two players, counted from the
 * `matches` table (rows where the two ids occupy player1/player2 in
 * either order). A draw is a VS row (player2_id set) with no winner_id.
 */
export async function fetchHeadToHead(
  myId: string,
  opponentId: string,
): Promise<HeadToHeadRecord> {
  const { data } = await (supabase as any)
    .from('matches')
    .select('player1_id, player2_id, winner_id')
    .or(
      `and(player1_id.eq.${myId},player2_id.eq.${opponentId}),and(player1_id.eq.${opponentId},player2_id.eq.${myId})`,
    )
    .limit(1000) as {
    data: Array<{ player1_id: string; player2_id: string | null; winner_id: string | null }> | null;
  };

  let myWins = 0;
  let theirWins = 0;
  let draws = 0;
  for (const row of data || []) {
    if (row.winner_id === myId) myWins++;
    else if (row.winner_id === opponentId) theirWins++;
    else if (row.player2_id) draws++;
  }
  return { myWins, theirWins, draws };
}

/** Minimal public profile bits needed by the VS intro/header/result UI. */
export async function fetchVsProfile(userId: string): Promise<VsProfile | null> {
  const { data } = await (supabase as any)
    .from('profiles')
    .select('username, avatar_url, level')
    .eq('id', userId)
    .maybeSingle() as {
    data: { username: string; avatar_url: string | null; level: number | null } | null;
  };

  if (!data) return null;
  return {
    username: data.username || 'Player',
    avatarUrl: data.avatar_url,
    level: data.level ?? 1,
  };
}
