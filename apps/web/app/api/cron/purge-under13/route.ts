import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { stampHeartbeat } from '@/lib/heartbeat';

// Purges existing accounts that answered "under 13" on the age check (FRIDAY-QUEUE item 29). The app
// signs them out immediately; after a 7-day grace window (a parent can write to
// privacy@wordocious.com to correct a mistaken tap) this deletes the auth user, which cascades
// through profiles to everything they own.
export const runtime = 'nodejs';

const GRACE_DAYS = 7;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = getAdminSupabase();
  const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString();
  const { data, error } = await sb
    .from('profiles')
    .select('id')
    .eq('age_confirmed_13', false)
    .not('age_under13_at', 'is', null)
    .lt('age_under13_at', cutoff)
    .limit(200);
  if (error) {
    await stampHeartbeat('purge-under13', false, error.message);
    return NextResponse.json({ error: 'sweep failed', detail: error.message }, { status: 500 });
  }
  let deleted = 0;
  for (const row of data ?? []) {
    const { error: delErr } = await sb.auth.admin.deleteUser(row.id as string);
    if (!delErr) deleted++;
  }
  await stampHeartbeat('purge-under13', true, `deleted ${deleted}`);
  return NextResponse.json({ ok: true, deleted });
}
