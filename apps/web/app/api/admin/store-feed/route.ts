import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * The store webhook ledger (store_webhook_events), for Pro & Gifts > Store feed.
 * It records processed Apple / Google notifications only (event id + source), so
 * it works as a liveness feed: a failing webhook shows up as silence while
 * subscriptions are active, not as an error row. This used to be served twice
 * (the Payments page and Ops Health); it lives here once.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();
  // Windowed, not top-N: per-day counts derived from a recency LIMIT silently
  // understate busy days. 2000 is a declared safety bound far above current volume.
  const { data, error } = await admin
    .from('store_webhook_events')
    .select('event_id, source, processed_at')
    .gte('processed_at', since14)
    .order('processed_at', { ascending: false })
    .limit(2000);
  if (error) return NextResponse.json({ error: 'Could not read the store webhook ledger.' }, { status: 500 });

  const byDay = new Map<string, { appstore: number; playstore: number }>();
  for (const e of data ?? []) {
    const d = String(e.processed_at).slice(0, 10);
    if (!byDay.has(d)) byDay.set(d, { appstore: 0, playstore: 0 });
    const c = byDay.get(d)!;
    if (e.source === 'appstore') c.appstore++;
    else c.playstore++;
  }

  return NextResponse.json({
    recent: (data ?? []).slice(0, 25),
    byDay: [...byDay.entries()].map(([day, c]) => ({ day, ...c })).sort((a, b) => (a.day < b.day ? 1 : -1)),
  });
}
