import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, areFriends, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/gift-shield { friendId, weekStart }
 *
 * Streak-shield gifting (Stats + Friends redesign D3.4, founder 2026-09-26):
 * send a friend one of YOUR streak shields (profiles.streak_shields — a paid /
 * referral benefit, service-role only) so a night they missed doesn't cost
 * them the streak. Once per (sender, recipient, week) via the shield_gifts
 * primary key; the sender is decremented, the recipient incremented, the
 * recipient is pushed, and the feed shows the gift.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { friendId?: string; weekStart?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!isUuid(body.friendId) || !body.weekStart || !DAY_RE.test(body.weekStart)) {
    return NextResponse.json({ error: 'friendId and weekStart required' }, { status: 400 });
  }
  if (body.friendId === me) return NextResponse.json({ error: "You can't gift yourself" }, { status: 400 });

  const admin = getAdminSupabase();
  if (!(await areFriends(admin, me, body.friendId))) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 });
  }
  const { data: meProf } = await admin.from('profiles').select('username, streak_shields').eq('id', me).maybeSingle() as { data: { username: string; streak_shields: number } | null };
  if (!meProf || (meProf.streak_shields ?? 0) < 1) {
    return NextResponse.json({ error: 'No shields to give' }, { status: 409 });
  }

  const { error } = await admin.from('shield_gifts').insert({ sender_id: me, recipient_id: body.friendId, week_start: body.weekStart });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Already gifted this week' }, { status: 429 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Move the shield. Two plain updates (no RPC): the gift row above is the
  // idempotency guard, and a failure here is visible in the response.
  const { data: friendProf } = await admin.from('profiles').select('streak_shields').eq('id', body.friendId).maybeSingle() as { data: { streak_shields: number } | null };
  await admin.from('profiles').update({ streak_shields: Math.max(0, (meProf.streak_shields ?? 0) - 1) }).eq('id', me);
  await admin.from('profiles').update({ streak_shields: (friendProf?.streak_shields ?? 0) + 1 }).eq('id', body.friendId);

  void broadcastPush(
    {
      title: `🛡️ ${meProf.username ?? 'A friend'} sent you a streak shield`,
      body: 'Your streak is covered for a missed night — it will be offered when you need it.',
      url: '/friends',
    },
    new Set([body.friendId]),
    'feed',
  ).catch(() => {});

  return NextResponse.json({ sent: true, shieldsLeft: Math.max(0, (meProf.streak_shields ?? 0) - 1) });
}
