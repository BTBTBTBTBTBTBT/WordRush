import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * The gifted-Pro-week marker for the CALLER (FINISH_SPEC AP: "Welcome to Pro" also greets the
 * first activation of a gifted week). The server marker is the caller's redeemed referral row
 * (referrals.invitee_id + redeemed_at, written by redeemReferral when it grants the 7-day week);
 * RLS lets only the inviter read that table, so the invitee asks here (Bearer token).
 * `{ gift: { redeemedAt } | null }` — clients welcome only inside lib/pro-welcome GIFT_WELCOME_DAYS.
 */
export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await getAdminSupabase()
    .from('referrals')
    .select('redeemed_at')
    .eq('invitee_id', user.id)
    .not('redeemed_at', 'is', null)
    .order('redeemed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ gift: null, error: 'lookup_failed' }, { status: 200 });
  return NextResponse.json(
    { gift: data?.redeemed_at ? { redeemedAt: data.redeemed_at } : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
