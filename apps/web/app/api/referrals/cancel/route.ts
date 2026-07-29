import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

/**
 * Cancel one of YOUR OWN pending invites (frees the slot immediately).
 * Service-role write because clients have no UPDATE policy on referrals;
 * ownership + pending status are both enforced in the WHERE clause.
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {}
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const sb = getAdminSupabase();
  const { data, error } = await sb.from('referrals')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('inviter_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'Not found or not cancellable' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
