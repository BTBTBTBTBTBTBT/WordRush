import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, areFriends, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { tauntById } from '@/lib/friends-taunts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/taunt { friendId, tauntId, day }
 *
 * One-tap canned taunt (bible §207): the id must exist in FRIEND_TAUNTS
 * (no free text ever crosses this route), the pair must be accepted
 * friends, and the friend_taunts primary key enforces one taunt per
 * sender→recipient per local day — a second attempt 409s and the client
 * shows "already taunted today".
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { friendId?: string; tauntId?: string; day?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isUuid(body.friendId) || !body.tauntId || !body.day || !DAY_RE.test(body.day)) {
    return NextResponse.json({ error: 'friendId, tauntId, day required' }, { status: 400 });
  }
  const taunt = tauntById(body.tauntId);
  if (!taunt) return NextResponse.json({ error: 'Unknown taunt' }, { status: 400 });

  const admin = getAdminSupabase();
  if (!(await areFriends(admin, me, body.friendId))) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 });
  }

  const { error } = await admin.from('friend_taunts').insert({
    sender_id: me,
    recipient_id: body.friendId,
    day: body.day,
    taunt_id: taunt.id,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Already taunted today' }, { status: 429 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  void broadcastPush(
    {
      title: `Taunt from ${meProf?.username ?? 'a friend'}`,
      body: taunt.text,
      url: '/daily',
    },
    new Set([body.friendId]),
  ).catch(() => {});

  return NextResponse.json({ sent: true });
}
