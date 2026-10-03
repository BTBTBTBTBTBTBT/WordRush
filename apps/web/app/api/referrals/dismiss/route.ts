import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Referral CREDIT notices the caller dismissed on the "Gift a week of Pro" card (founder 10-03),
 * so an X sticks across relaunches and devices. Backed by referrals.inviter_dismissed_at
 * (docs/sql/20261003-referral-credit-dismiss.sql). Before that column exists: GET → { ids: [] },
 * POST → { ok: false } — the clients' local dismissed lists carry it meanwhile.
 *
 *   GET            → { ids: string[] }   the caller's dismissed referral ids (as inviter)
 *   POST { ids }   → { ok: boolean }     dismiss these (only the caller's own rows)
 */
export async function GET(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await getAdminSupabase()
    .from('referrals')
    .select('id')
    .eq('inviter_id', user.id)
    .not('inviter_dismissed_at', 'is', null)
    .limit(200);
  const ids = error ? [] : (data ?? []).map((r: { id: string }) => r.id);
  return NextResponse.json({ ids }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let ids: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) ids = body.ids.filter((x: unknown): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x));
  } catch { /* empty body */ }
  if (!ids.length) return NextResponse.json({ ok: false, reason: 'no_ids' }, { status: 400 });
  const { error } = await getAdminSupabase()
    .from('referrals')
    .update({ inviter_dismissed_at: new Date().toISOString() })
    .eq('inviter_id', user.id)
    .in('id', ids.slice(0, 50));
  return NextResponse.json({ ok: !error });
}
