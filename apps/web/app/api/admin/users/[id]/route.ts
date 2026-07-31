import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;

  const [profileRes, statsRes, matchesRes, auditRes, authRes, refRes, devicesRes, sentRes, reportsRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('user_stats').select('*').eq('user_id', userId),
    admin.from('matches').select('*').or(`player1_id.eq.${userId},player2_id.eq.${userId}`).order('created_at', { ascending: false }).limit(10),
    admin.from('admin_audit_log').select('*').eq('target_user_id', userId).order('created_at', { ascending: false }).limit(10),
    // Acquisition: email + auth provider from auth.users; referral attribution
    // from referrals (invited-by username, else organic).
    admin.auth.admin.getUserById(userId),
    admin.from('referrals').select('status, redeemed_at, inviter:profiles!referrals_inviter_id_fkey(username)').eq('invitee_id', userId).maybeSingle(),
    // CRM extras: devices (reachability + which platforms they actually use),
    // their own invites (referral value both directions), and moderation
    // context (reports filed by or against them).
    admin.from('device_tokens').select('platform, created_at').eq('user_id', userId),
    admin.from('referrals').select('status, created_at, invitee:profiles!referrals_invitee_id_fkey(username)').eq('inviter_id', userId).order('created_at', { ascending: false }),
    admin.from('reports').select('id, reporter_id, reported_user_id, reason, context, created_at').or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(10),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const authUser: any = (authRes as any).data?.user ?? null;
  const referral: any = (refRes as any).data ?? null;

  return NextResponse.json({
    profile: profileRes.data,
    email: authUser?.email ?? null,
    provider: authUser?.app_metadata?.provider ?? null,
    referral: referral
      ? { inviter: referral.inviter?.username ?? null, status: referral.status, redeemed_at: referral.redeemed_at }
      : null,
    devices: (devicesRes as any).data || [],
    invitesSent: ((sentRes as any).data || []).map((r: any) => ({
      invitee: r.invitee?.username ?? null, status: r.status, created_at: r.created_at,
    })),
    reports: ((reportsRes as any).data || []).map((r: any) => ({
      ...r, direction: r.reporter_id === userId ? 'filed' : 'against',
    })),
    stats: statsRes.data || [],
    recentMatches: matchesRes.data || [],
    auditLog: auditRes.data || [],
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;
  const body = await request.json();

  // Only allow specific fields to be updated
  const allowedFields = ['username', 'streak_shields', 'current_streak', 'xp', 'level'];
  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log the action
  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'update_profile',
    target_user_id: userId,
    details: { fields: Object.keys(updates), values: updates },
  });

  return NextResponse.json({ profile: data });
}
