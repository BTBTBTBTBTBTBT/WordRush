import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const userId = params.id;
  const { amount, reason } = await request.json();

  if (typeof amount !== 'number' || !reason) {
    return NextResponse.json({ error: 'amount (number) and reason (string) required' }, { status: 400 });
  }

  // Get current balance
  const { data: profile } = await admin.from('profiles').select('coins').eq('id', userId).single();
  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newBalance = profile.coins + amount;
  if (newBalance < 0) {
    return NextResponse.json({ error: 'Would result in negative balance' }, { status: 400 });
  }

  // Update balance and create transaction
  const [updateRes] = await Promise.all([
    admin.from('profiles').update({ coins: newBalance }).eq('id', userId).select().single(),
    admin.from('coin_transactions').insert({
      user_id: userId,
      amount,
      type: amount >= 0 ? 'earn' : 'spend',
      reason: `[Admin] ${reason}`,
    }),
    admin.from('admin_audit_log').insert({
      admin_id: auth.admin.id,
      action: 'adjust_coins',
      target_user_id: userId,
      details: { amount, reason, previous_balance: profile.coins, new_balance: newBalance },
    }),
  ]);

  if (updateRes.error) {
    return NextResponse.json({ error: updateRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: updateRes.data });
}
