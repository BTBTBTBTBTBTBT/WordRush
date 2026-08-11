import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/remind { addresseeId } — nudge a pending invite (§212).
 * The real reason invites die is the addressee never saw the first push.
 * Rate limit: one reminder per request per 24h, tracked in
 * friendships.reminded_at (service-role write, like every friends mutation).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { addresseeId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isUuid(body.addresseeId)) {
    return NextResponse.json({ error: 'addresseeId required' }, { status: 400 });
  }

  const admin = getAdminSupabase();
  const { data: row, error } = await admin
    .from('friendships')
    .select('reminded_at')
    .eq('requester_id', me)
    .eq('addressee_id', body.addresseeId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'No pending request' }, { status: 404 });

  if (row.reminded_at && Date.now() - Date.parse(row.reminded_at) < 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: 'Already reminded today' }, { status: 429 });
  }

  const remindedAt = new Date().toISOString();
  const { error: upErr } = await admin
    .from('friendships')
    .update({ reminded_at: remindedAt })
    .eq('requester_id', me)
    .eq('addressee_id', body.addresseeId)
    .eq('status', 'pending');
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  void broadcastPush(
    {
      title: 'Friend request waiting 🤝',
      body: `Reminder: ${meProf?.username ?? 'A player'} wants to be friends on Wordocious`,
      url: `/profile/${me}`,
    },
    new Set([body.addresseeId]),
  ).catch(() => {});

  return NextResponse.json({ remindedAt });
}
