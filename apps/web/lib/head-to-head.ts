import { supabase } from './supabase-client';
import { avatarFieldsOf, selectWithAvatarColumns } from './avatar-fields-server';

export interface HeadToHeadRecord {
  myWins: number;
  theirWins: number;
  draws: number;
}

export interface VsProfile {
  username: string;
  avatarUrl: string | null;
  level: number;
  /** FINISH_SPEC AN5: the player's id (the avatar's own-match / directory key) when a real person. */
  userId?: string | null;
  /** FINISH_SPEC AN5: the opponent's saved mascot / frame / cast + active Pro (null / false when unknown or the columns are missing). */
  avatarConfig?: Record<string, unknown> | null;
  avatarFrame?: string | null;
  avatarCastId?: string | null;
  isPro?: boolean;
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
    .order('created_at', { ascending: false })
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
  // AN5: the avatar columns ride along through the tolerant select (retried
  // without them while they are missing) — a missing column never breaks the
  // opponent load.
  let data: { username: string; avatar_url: string | null; level: number | null } | null = null;
  try {
    const res = await selectWithAvatarColumns<{ username: string; avatar_url: string | null; level: number | null }>(
      (extra) => (supabase as any)
        .from('profiles')
        .select(`username, avatar_url, level${extra}`)
        .eq('id', userId)
        .maybeSingle(),
    );
    data = res.data;
  } catch {
    data = null;
  }

  if (!data) return null;
  const fields = avatarFieldsOf(data);
  return {
    username: data.username || 'Player',
    userId,
    avatarUrl: data.avatar_url,
    level: data.level ?? 1,
    avatarConfig: fields.avatar_config,
    avatarFrame: fields.avatar_frame,
    avatarCastId: fields.avatar_cast_id,
    isPro: fields.is_pro,
  };
}
