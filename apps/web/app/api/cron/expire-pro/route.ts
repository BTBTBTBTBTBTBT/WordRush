import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Server-side Pro-expiry sweep. The clients each compare pro_expires_at to
// their OWN device clock, so without this the DB `is_pro` stays true forever
// after a subscription/Day Pass lapses, and a user who rolls their clock back
// keeps Pro (audit #6). This flips is_pro=false for every row whose expiry has
// passed — the DB becomes the authority for admin views, counts, and any
// server-trusting read, independent of device clocks. Runs hourly (Day Pass is
// 24h, so hourly bounds the over-grant window to ~1h).
//
// It does NOT touch pro_expires_at (kept as an audit trail) and never revokes a
// row with a future or null expiry, so an active subscriber is untouched. The
// webhooks remain the authority for *extending* Pro on renewal.

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();
  const nowIso = new Date().toISOString();

  const { data, error } = await sb
    .from('profiles')
    .update({ is_pro: false })
    .eq('is_pro', true)
    .not('pro_expires_at', 'is', null)
    .lt('pro_expires_at', nowIso)
    .select('id');

  if (error) {
    return NextResponse.json({ error: 'sweep failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: data?.length ?? 0 });
}
