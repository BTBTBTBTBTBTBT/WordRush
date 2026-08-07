import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, pairBlocked, getFriendship, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/request  { addresseeId? , username? }
 *
 * Send (or complete) a friend request. Accepts either a profile id (Add
 * Friend button) or a username (the Add-by-username field — exact,
 * case-insensitive, same lookup as VS invites). Order of checks:
 *   self → target exists/banned → pair-block (either direction, service
 *   role) → existing row (idempotent) → REVERSE PENDING AUTO-ACCEPTS →
 *   insert pending + push.
 *
 * Responses always carry { status } so the client can render the button
 * state without a follow-up fetch: 'pending' | 'accepted'.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { addresseeId?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // Resolve the target.
  let target: { id: string; username: string; is_banned: boolean } | null = null;
  if (isUuid(body.addresseeId)) {
    const { data } = await admin
      .from('profiles')
      .select('id, username, is_banned')
      .eq('id', body.addresseeId)
      .maybeSingle();
    target = data;
  } else if (typeof body.username === 'string' && body.username.trim()) {
    // Exact case-insensitive match — invite-service precedent; usernames are
    // citext-unique so ilike without wildcards is an exact lookup.
    const { data } = await admin
      .from('profiles')
      .select('id, username, is_banned')
      .ilike('username', body.username.trim())
      .maybeSingle();
    target = data;
  } else {
    return NextResponse.json({ error: 'addresseeId or username required' }, { status: 400 });
  }

  if (!target) return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  if (target.id === me) {
    return NextResponse.json({ error: "You can't friend yourself" }, { status: 400 });
  }
  if (target.is_banned) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

  // Blocks kill the whole flow, without revealing which side blocked.
  if (await pairBlocked(admin, me, target.id)) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const existing = await getFriendship(admin, me, target.id);
  if (existing) {
    if (existing.status === 'accepted') {
      return NextResponse.json({ status: 'accepted', friendId: target.id });
    }
    if (existing.requester_id === me) {
      // Re-request: idempotent no-op (no push spam).
      return NextResponse.json({ status: 'pending', friendId: target.id });
    }
    // They already asked US — mutual intent, auto-accept.
    const { error } = await admin
      .from('friendships')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('requester_id', target.id)
      .eq('addressee_id', me)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const myName = await usernameOf(admin, me);
    void broadcastPush(
      { title: 'Friend request accepted 🎉', body: `You and ${myName} are now friends on Wordocious`, url: `/profile/${me}` },
      new Set([target.id]),
    ).catch(() => {});
    return NextResponse.json({ status: 'accepted', friendId: target.id });
  }

  const { error } = await admin.from('friendships').insert({
    requester_id: me,
    addressee_id: target.id,
    status: 'pending',
  });
  if (error) {
    // Race on the pair-unique index → treat as idempotent pending.
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ status: 'pending', friendId: target.id });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const myName = await usernameOf(admin, me);
  void broadcastPush(
    { title: '🤝 Friend request', body: `${myName} wants to be friends on Wordocious`, url: `/profile/${me}` },
    new Set([target.id]),
  ).catch(() => {});

  return NextResponse.json({ status: 'pending', friendId: target.id });
}

async function usernameOf(admin: ReturnType<typeof getAdminSupabase>, id: string): Promise<string> {
  const { data } = await admin.from('profiles').select('username').eq('id', id).maybeSingle();
  return data?.username ?? 'A player';
}
