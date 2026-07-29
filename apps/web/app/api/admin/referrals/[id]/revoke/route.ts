import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Revoke a PENDING referral code (kills the link before anyone redeems it).
 * Redeemed/converted rows are history and can't be revoked — clawing back
 * granted Pro time is a founder decision done by hand, not a button.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('referrals')
    .update({ status: 'revoked' })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select('id, code')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Not found or not pending' }, { status: 404 });
  }

  await admin.from('admin_audit_log').insert({
    admin_id: auth.admin.id,
    action: 'revoke_referral',
    details: { referral_id: data.id, code: data.code },
  });

  return NextResponse.json({ ok: true });
}
