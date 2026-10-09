import { NextRequest, NextResponse } from 'next/server';
import { ageCheckVerdict } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

/**
 * 13+ age check, server side (FRIDAY-QUEUE item 29). The client is never the authority: the picked
 * year is re-validated here, and only this route (service role) can write the age_* columns
 * (protect_age_columns trigger). Stores the flag + the year only, never a full date.
 *
 *   pass  -> age_confirmed_13 = true   (only if not already set; the year itself is never stored server-side)
 *   under -> age_under13_at = now()  (the client signs the account out; /api/cron/purge-under13
 *            deletes it after 7 days)
 *
 * Old (2.7.1) clients never call this; their accounts are asked on their first 2.8 launch.
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let year: unknown;
  try {
    ({ year } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const verdict = ageCheckVerdict(year);
  if (verdict === 'invalid') return NextResponse.json({ error: 'Invalid year' }, { status: 400 });

  const admin = getAdminSupabase();
  if (verdict === 'pass') {
    const { error } = await admin
      .from('profiles')
      .update({ age_confirmed_13: true, age_under13_at: null })
      .eq('id', user.id)
      .eq('age_confirmed_13', false);
    if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Under 13. Never demote an account that already passed (the .eq below), so a later wrong tap
  // cannot undo a confirmation.
  const { error } = await admin
    .from('profiles')
    .update({ age_under13_at: new Date().toISOString() })
    .eq('id', user.id)
    .eq('age_confirmed_13', false);
  if (error) return NextResponse.json({ error: 'Could not save' }, { status: 500 });
  return NextResponse.json({ ok: false, under: true });
}
