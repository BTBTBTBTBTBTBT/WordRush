import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;
  const { grant, days } = await request.json();

  const { data: profile } = await admin.from('profiles').select('is_pro, pro_expires_at').eq('id', userId).single();
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let updates: Record<string, any>;
  if (grant) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (days || 30));
    updates = { is_pro: true, pro_expires_at: expiry.toISOString() };
  } else {
    updates = { is_pro: false, pro_expires_at: null };
  }

  const { data, error } = await admin.from('profiles').update(updates).eq('id', userId).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: grant ? 'grant_pro' : 'revoke_pro',
    target_user_id: userId,
    details: { grant, days, previous_pro: profile.is_pro },
  });

  return NextResponse.json({ profile: data });
}
