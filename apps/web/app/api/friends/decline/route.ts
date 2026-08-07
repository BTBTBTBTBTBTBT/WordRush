import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/decline { requesterId } — silently delete a pending
 * request aimed at me (no push; the requester just sees "Requested" until
 * they look again — the blocks precedent for quiet rejection). Also serves
 * as "cancel my outgoing request" when the ids are reversed.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { requesterId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isUuid(body.requesterId)) {
    return NextResponse.json({ error: 'requesterId required' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { error } = await admin
    .from('friendships')
    .delete()
    .eq('status', 'pending')
    .or(
      `and(requester_id.eq.${body.requesterId},addressee_id.eq.${me}),and(requester_id.eq.${me},addressee_id.eq.${body.requesterId})`,
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: 'none' });
}
