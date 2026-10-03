import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { ONLINE_WINDOW_MS } from '@wordle-duel/core';
import { headCount, isoDaysAgo } from '@/lib/admin/admin-queries';

export const dynamic = 'force-dynamic';

/**
 * The Dashboard's second row: one head count per newer feature (achievements,
 * mascots, friends, pocket games, VS challenges, reactions, gifts). Head
 * queries only — cheap, no row reads, no cap. A table or column that isn't
 * applied yet comes back null (shown as "—"), never 0. Read-only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = Date.now();
  const since1 = isoDaysAgo(1, now);
  const since7 = isoDaysAgo(7, now);
  const count = (table: string, col = 'id') => admin.from(table).select(col, { count: 'exact', head: true });

  const [
    achievementsAll, achievements24h, mascots, friendships, friendRequests,
    pocketActive, pocket7, challenges7, reactions7, giftsRedeemed, onNow,
  ] = await Promise.all([
    headCount(count('achievements')),
    headCount(count('achievements').gte('unlocked_at', since1)),
    headCount(count('profiles').not('avatar_config', 'is', null)),
    headCount(count('friendships', 'status').eq('status', 'accepted')),
    headCount(count('friendships', 'status').eq('status', 'pending')),
    headCount(count('friendly_games').eq('status', 'active')),
    headCount(count('friendly_games').gte('created_at', since7)),
    headCount(count('vs_challenges').gte('created_at', since7)),
    headCount(count('moment_reactions', 'user_id').gte('created_at', since7)),
    headCount(count('referrals').in('status', ['redeemed', 'converted'])),
    headCount(count('profiles').gte('last_seen_at', new Date(now - ONLINE_WINDOW_MS).toISOString())),
  ]);

  return NextResponse.json({
    achievementsAll, achievements24h, mascots, friendships, friendRequests,
    pocketActive, pocket7, challenges7, reactions7, giftsRedeemed, onNow,
  });
}
