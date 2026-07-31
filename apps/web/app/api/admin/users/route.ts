import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '25');
  const offset = (page - 1) * limit;

  let query = admin
    .from('profiles')
    .select('id, username, avatar_url, level, is_pro, is_banned, last_played_at, created_at, role', { count: 'exact' });

  if (q) {
    query = query.ilike('username', `%${q}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Acquisition data ("where we acquired the user") — assembled from what the
  // system actually records, per user:
  //   email + auth provider: auth.users (service role). Apple implies the iOS
  //     app (Sign in with Apple exists nowhere else); Google/email are
  //     cross-platform, so no platform is invented for them.
  //   referral: a referrals row with this invitee_id, joined to the inviter's
  //     username. Everyone else is Organic.
  // listUsers pulls one 1,000-user page and maps by id — fine far beyond the
  // current user count; revisit pagination past ~1k users.
  const rows = data || [];
  const ids = rows.map((r) => r.id);
  const [authRes, refRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ids.length
      ? admin.from('referrals').select('invitee_id, status, inviter:profiles!referrals_inviter_id_fkey(username)').in('invitee_id', ids)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const authById = new Map((authRes.data?.users || []).map((u: any) => [u.id, u]));
  const refByInvitee = new Map(((refRes.data as any[]) || []).map((r: any) => [r.invitee_id, r]));
  const users = rows.map((r) => {
    const au: any = authById.get(r.id);
    const ref: any = refByInvitee.get(r.id);
    return {
      ...r,
      email: au?.email ?? null,
      provider: au?.app_metadata?.provider ?? null,
      referred_by: ref?.inviter?.username ?? null,
    };
  });

  return NextResponse.json({
    users,
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
