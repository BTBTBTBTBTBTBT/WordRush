import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/remove { friendId } — unfriend: delete the pair's row in
 * whatever direction/state it exists. Silent (no push). Also called by the
 * block flow so blocking someone severs the friendship in the same motion.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { friendId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isUuid(body.friendId)) {
    return NextResponse.json({ error: 'friendId required' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${me},addressee_id.eq.${body.friendId}),and(requester_id.eq.${body.friendId},addressee_id.eq.${me})`,
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: 'none' });
}
