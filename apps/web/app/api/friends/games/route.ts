import { NextRequest, NextResponse } from 'next/server';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, newFriendlyState, type FriendlyKind } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, areFriends, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { expireIdle, gameView, passAnswer, profilesById, type GameRow } from '@/lib/friendly-games-server';

export const dynamic = 'force-dynamic';

/**
 * Friends pocket games (founder, 2026-10-01; spec docs/FRIENDS_REDESIGN_SPEC.md §4).
 *
 * GET  → { active, recent }: my games in play (my turn first) and the ones
 *        that ended in the last 7 days.
 * POST { kind, friendId, stake? } → { game }: start one with an accepted
 *        friend (free for everyone). One open game per kind per pair — a
 *        second start returns the open one. The friend gets a push.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const admin = getAdminSupabase();
  await expireIdle(admin, me);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('friendly_games')
    .select('*')
    .or(`player_a.eq.${me},player_b.eq.${me}`)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(60);
  const rows = (data ?? []) as GameRow[];
  const profs = await profilesById(admin, rows.map((r) => (r.player_a === me ? r.player_b : r.player_a)));
  const views = rows.map((r) => gameView(r, me, profs.get(r.player_a === me ? r.player_b : r.player_a)));
  const active = views.filter((v) => v.status === 'active').sort((x, y) => Number(y.yourTurn) - Number(x.yourTurn));
  const recent = views.filter((v) => v.status !== 'active').slice(0, 10);
  return NextResponse.json({ active, recent });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { kind?: string; friendId?: string; stake?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const kind = body.kind as FriendlyKind;
  if (!FRIENDLY_KINDS.includes(kind) || !isUuid(body.friendId) || body.friendId === me) {
    return NextResponse.json({ error: 'kind and friendId required' }, { status: 400 });
  }
  const admin = getAdminSupabase();
  if (!(await areFriends(admin, me, body.friendId))) return NextResponse.json({ error: 'Not friends' }, { status: 403 });

  // One open game of a kind per pair.
  await expireIdle(admin, me);
  const { data: open } = await admin
    .from('friendly_games')
    .select('*')
    .eq('kind', kind)
    .eq('status', 'active')
    .or(`and(player_a.eq.${me},player_b.eq.${body.friendId}),and(player_a.eq.${body.friendId},player_b.eq.${me})`)
    .limit(1);
  const profs = await profilesById(admin, [me, body.friendId]);
  if (open && open.length > 0) {
    return NextResponse.json({ game: gameView(open[0] as GameRow, me, profs.get(body.friendId)), existing: true });
  }

  const { data: row, error } = await admin
    .from('friendly_games')
    .insert({
      kind,
      player_a: me,
      player_b: body.friendId,
      state: newFriendlyState(kind, body.stake),
      secret: kind === 'pass' ? passAnswer() : null,
      a_seen_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error || !row) return NextResponse.json({ error: error?.message ?? 'Could not start the game' }, { status: 500 });

  const who = profs.get(me)?.username ?? 'A friend';
  const title = FRIENDLY_TITLES[kind];
  void broadcastPush(
    {
      title: `${who} started ${title} with you`,
      body: kind === 'rps' ? 'Make your pick. Best of 3.' : kind === 'coin' ? 'Best of 5. They call first.' : `${who} goes first. You're up next.`,
      url: `/friends/games/${row.id}`,
    },
    new Set([body.friendId]),
    'challenge',
  ).catch(() => {});

  return NextResponse.json({ game: gameView(row as GameRow, me, profs.get(body.friendId)), existing: false });
}
