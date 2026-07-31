import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const today = new Date().toISOString().split('T')[0];

  // Run queries in parallel
  const [
    totalUsersRes,
    activeToday,
    proUsers,
    gamesToday,
    recentSignups,
    modePopularity,
    bannedCount,
  ] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }),
    admin.from('profiles').select('id', { count: 'exact', head: true }).gte('last_played_at', `${today}T00:00:00Z`),
    // is_pro alone overstates: the expiry sweep only runs hourly, so a lapsed
    // row reads Pro until it fires. Match the clients' isProActive rule —
    // flag set AND (no expiry OR expiry in the future).
    admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_pro', true)
      .or(`pro_expires_at.is.null,pro_expires_at.gt.${new Date().toISOString()}`),
    admin.from('daily_results').select('id', { count: 'exact', head: true }).eq('day', today),
    admin.from('profiles').select('id, username, avatar_url, created_at, is_pro, level').order('created_at', { ascending: false }).limit(5),
    admin.from('user_stats').select('game_mode, total_games'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_banned', true),
  ]);

  // Aggregate mode popularity
  const modeStats: Record<string, number> = {};
  if (modePopularity.data) {
    for (const row of modePopularity.data) {
      modeStats[row.game_mode] = (modeStats[row.game_mode] || 0) + row.total_games;
    }
  }

  return NextResponse.json({
    totalUsers: totalUsersRes.count || 0,
    activeToday: activeToday.count || 0,
    proSubscribers: proUsers.count || 0,
    gamesToday: gamesToday.count || 0,
    bannedUsers: bannedCount.count || 0,
    recentSignups: recentSignups.data || [],
    modePopularity: modeStats,
  });
}
