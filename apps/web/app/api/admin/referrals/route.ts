import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Admin referral-program overview: aggregate stats + every referral with
 * inviter/invitee usernames resolved (referrals references profiles, so no
 * PostgREST embed — batch the username lookup like the profile match list).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { data: rows } = await admin
    .from('referrals')
    .select('id, inviter_id, invitee_id, code, status, created_at, redeemed_at, converted_at, converted_plan, expires_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const referrals = rows ?? [];
  const userIds = Array.from(new Set(
    referrals.flatMap((r) => [r.inviter_id, r.invitee_id]).filter(Boolean) as string[],
  ));
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin.from('profiles')
      .select('id, username').in('id', userIds);
    for (const p of profiles ?? []) names.set(p.id, p.username);
  }

  const now = Date.now();
  const count = (s: string) => referrals.filter((r) => r.status === s).length;
  const openPending = referrals.filter(
    (r) => r.status === 'pending' && new Date(r.expires_at).getTime() > now,
  ).length;
  const redeemed = count('redeemed') + count('converted');
  const converted = count('converted');
  // Pro-days given away: 7/redemption to the friend, +3 instant to the
  // inviter (approximation: cap nuances ignored), 30/60 per conversion.
  const proDaysGranted = redeemed * (7 + 3)
    + referrals.filter((r) => r.status === 'converted')
      .reduce((sum, r) => sum + (r.converted_plan === 'pro_yearly' ? 90 : 30), 0);

  return NextResponse.json({
    stats: {
      total: referrals.length,
      openPending,
      redeemed,
      converted,
      conversionRate: redeemed > 0 ? Math.round((converted / redeemed) * 100) : 0,
      proDaysGranted,
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      code: r.code,
      status: r.status,
      inviter: names.get(r.inviter_id) ?? r.inviter_id.slice(0, 8),
      invitee: r.invitee_id ? (names.get(r.invitee_id) ?? r.invitee_id.slice(0, 8)) : null,
      created_at: r.created_at,
      redeemed_at: r.redeemed_at,
      converted_at: r.converted_at,
      converted_plan: r.converted_plan,
      expires_at: r.expires_at,
      expired: r.status === 'pending' && new Date(r.expires_at).getTime() < now,
    })),
  });
}
