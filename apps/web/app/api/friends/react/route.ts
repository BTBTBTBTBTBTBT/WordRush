import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { friendAchievements } from '@wordle-duel/core';
import { grantAchievements } from '@/lib/achievements-server';
import { requireUser, areFriends, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';

export const dynamic = 'force-dynamic';

/** The fixed reaction set (no free text — same rule as taunts). */
const REACTIONS = { clap: '👏', fire: '🔥', wow: '😱', grr: '😤', rematch: 'Rematch' } as const;
type Emoji = keyof typeof REACTIONS;

/**
 * POST /api/friends/react { momentId, ownerId, emoji, on } → { ok }. Toggle
 * one reaction on a Moments row (spec docs/FRIENDS_REDESIGN_SPEC.md §6).
 * The first time someone reacts with a given emoji, the moment's owner gets a
 * push (category 'feed').
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { momentId?: string; ownerId?: string; emoji?: string; on?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const momentId = typeof body.momentId === 'string' ? body.momentId.slice(0, 120) : '';
  const emoji = body.emoji as Emoji;
  if (!momentId || !(emoji in REACTIONS)) return NextResponse.json({ error: 'momentId and emoji required' }, { status: 400 });

  const admin = getAdminSupabase();
  if (body.on === false) {
    await admin.from('moment_reactions').delete().eq('moment_id', momentId).eq('user_id', me).eq('emoji', emoji);
    return NextResponse.json({ ok: true });
  }
  const { error } = await admin.from('moment_reactions').insert({ moment_id: momentId, user_id: me, emoji });
  const fresh = !error;
  if (error && (error as { code?: string }).code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });

  if (fresh && isUuid(body.ownerId) && body.ownerId !== me && (await areFriends(admin, me, body.ownerId))) {
    const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
    const who = meProf?.username ?? 'A friend';
    void broadcastPush(
      { title: emoji === 'rematch' ? `${who} wants a rematch` : `${who} reacted ${REACTIONS[emoji]}`, body: 'Tap to see it in Friends.', url: '/friends' },
      new Set([body.ownerId]),
      'feed',
    ).catch(() => {});
  }
  // FINISH_SPEC BE + BF1: Cheerleader (25 reactions sent), returned as newAchievements.
  let newAchievements: Awaited<ReturnType<typeof grantAchievements>> = [];
  if (fresh) {
    try {
      const { count } = await admin.from('moment_reactions').select('*', { count: 'exact', head: true }).eq('user_id', me);
      newAchievements = await grantAchievements(admin, me, friendAchievements({ friendCount: 0, reactionsSent: count ?? 0, bestFriendStreak: 0, wonRace: false }));
    } catch { /* best effort */ }
  }
  return NextResponse.json({ ok: true, newAchievements });
}
