import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const revalidate = 300; // Top Inviters changes slowly — cache 5 min

/**
 * Top Inviters this calendar month — the Viral Loops "leaderboard template"
 * rendered with our own data. Public: usernames are already public via
 * profiles RLS.
 */
export async function GET() {
  const sb = getAdminSupabase();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: rows } = await sb.from('referrals')
    .select('inviter_id')
    .in('status', ['redeemed', 'converted'])
    .gte('redeemed_at', monthStart.toISOString());

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    counts.set(r.inviter_id, (counts.get(r.inviter_id) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length === 0) return NextResponse.json({ leaders: [] });

  const { data: profiles } = await sb.from('profiles')
    .select('id, username')
    .in('id', top.map(([id]) => id));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  return NextResponse.json({
    leaders: top.map(([id, count]) => ({ username: names.get(id) ?? 'Player', count })),
  });
}
