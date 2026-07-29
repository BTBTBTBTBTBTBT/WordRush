import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Public code lookup for the /join landing page (referrals RLS is
 * inviter-read-only, so anonymous visitors need this server hop).
 * Returns only what the page renders — no ids.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.toUpperCase();
  if (!code || !/^[A-Z2-9]{4,16}$/.test(code)) {
    return NextResponse.json({ status: 'notfound' });
  }

  const sb = getAdminSupabase();
  const { data: ref } = await sb.from('referrals')
    .select('inviter_id, status, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (!ref) return NextResponse.json({ status: 'notfound' });
  if (ref.status !== 'pending') return NextResponse.json({ status: 'used' });
  if (new Date(ref.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ status: 'expired' });
  }

  const { data: inviter } = await sb.from('profiles')
    .select('username').eq('id', ref.inviter_id).maybeSingle();
  return NextResponse.json({ status: 'ok', inviterName: inviter?.username ?? null });
}
