import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;

  const [profileRes, statsRes, matchesRes, auditRes] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('user_stats').select('*').eq('user_id', userId),
    admin.from('matches').select('*').or(`player1_id.eq.${userId},player2_id.eq.${userId}`).order('created_at', { ascending: false }).limit(10),
    admin.from('admin_audit_log').select('*').eq('target_user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    profile: profileRes.data,
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
