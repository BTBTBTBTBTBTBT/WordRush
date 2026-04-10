import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;
  const { ban, reason } = await request.json();

  // Don't allow banning yourself
  if (userId === auth.admin.id) {
    return NextResponse.json({ error: 'Cannot ban yourself' }, { status: 400 });
  }

  const updates = ban
    ? { is_banned: true, ban_reason: reason || 'Banned by admin' }
    : { is_banned: false, ban_reason: null };

  const { data, error } = await admin.from('profiles').update(updates).eq('id', userId).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: ban ? 'ban_user' : 'unban_user',
    target_user_id: userId,
    details: { ban, reason },
  });

  return NextResponse.json({ profile: data });
}
