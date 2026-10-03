import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sweepAll } from '@/lib/supabase-sweep';
import { isoDaysAgo } from '@/lib/admin/admin-queries';
import { activationFunnel, tallyBy, type SignupRow } from '@/lib/admin/admin-aggregates';

export const dynamic = 'force-dynamic';

/**
 * admin > Players > Onboarding: new-player activation for signups in the last
 * N days (7–60, default 14), built only from fields that already exist —
 * profiles.avatar_config (saved a mascot in the guided setup), daily_results
 * (played; came back another day) and friendships (added a friend). The
 * first-run tour's own `onboarded-v2` flag is per-device localStorage, so the
 * tour steps themselves aren't tracked and aren't invented here. Read-only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 14, 7), 60);
  const since = isoDaysAgo(days);

  // avatar_config may not be applied yet; then count signups without it.
  const probe = await admin.from('profiles').select('avatar_config').limit(1);
  const mascotTracked = !probe.error;
  const signups: SignupRow[] = mascotTracked
    ? await sweepAll<SignupRow>((f, t) =>
        admin.from('profiles').select('id, created_at, avatar_config').gte('created_at', since).order('id').range(f, t),
      )
    : (
        await sweepAll<{ id: string; created_at: string }>((f, t) =>
          admin.from('profiles').select('id, created_at').gte('created_at', since).order('id').range(f, t),
        )
      ).map((p) => ({ ...p, avatar_config: null }));

  const ids = signups.map((s) => s.id);
  const playDays = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const rows = await sweepAll<{ user_id: string; day: string }>((f, t) =>
      admin.from('daily_results').select('user_id, day').in('user_id', chunk).order('id').range(f, t),
    );
    for (const r of rows) {
      const set = playDays.get(r.user_id) ?? new Set<string>();
      set.add(String(r.day).slice(0, 10));
      playDays.set(r.user_id, set);
    }
  }

  const idSet = new Set(ids);
  const pairs = await sweepAll<{ requester_id: string; addressee_id: string }>((f, t) =>
    admin.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted').order('requester_id').order('addressee_id').range(f, t),
  );
  const withFriend = new Set<string>();
  for (const p of pairs) {
    if (idSet.has(p.requester_id)) withFriend.add(p.requester_id);
    if (idSet.has(p.addressee_id)) withFriend.add(p.addressee_id);
  }

  const perDay = tallyBy(signups, (s) => s.created_at.slice(0, 10)).sort((a, b) => (a.key < b.key ? -1 : 1));

  return NextResponse.json({
    days,
    mascotTracked,
    funnel: activationFunnel(signups, playDays, withFriend),
    perDay,
  });
}
