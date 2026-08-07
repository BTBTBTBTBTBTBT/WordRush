import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';

/** POST /api/friends/accept { requesterId } — accept a pending request aimed at me. */
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
  const { data, error } = await admin
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('requester_id', body.requesterId)
    .eq('addressee_id', me)
    .eq('status', 'pending')
    .select('requester_id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: 'No pending request' }, { status: 404 });

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  void broadcastPush(
    {
      title: 'Friend request accepted 🎉',
      body: `You and ${meProf?.username ?? 'a player'} are now friends on Wordocious`,
      url: `/profile/${me}`,
    },
    new Set([body.requesterId]),
  ).catch(() => {});

  return NextResponse.json({ status: 'accepted', friendId: body.requesterId });
}
