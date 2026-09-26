import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, areFriends, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/challenge { friendId, gameMode }
 *
 * Challenge-from-row (Stats + Friends redesign D3, founder 2026-09-26: "real
 * reasons to tap"). Creates a TARGETED match invite for an accepted friend and
 * — the part targeted invites never had — pushes it to them, deep-linking to
 * /vs/join/<code>. Free for friends: the invite code bypasses the Pro gate on
 * both sides (vs-game.tsx), so a free player can challenge and be challenged.
 * The caller then enters the same private lobby with the code.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/l — easier to type
const VS_MODES = new Set(['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE', 'DUEL_6', 'DUEL_7']);

function code(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { friendId?: string; gameMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const gameMode = body.gameMode ?? 'DUEL';
  if (!isUuid(body.friendId) || !VS_MODES.has(gameMode)) {
    return NextResponse.json({ error: 'friendId and a VS gameMode required' }, { status: 400 });
  }
  if (body.friendId === me) return NextResponse.json({ error: "You can't challenge yourself" }, { status: 400 });

  const admin = getAdminSupabase();
  if (!(await areFriends(admin, me, body.friendId))) {
    return NextResponse.json({ error: 'Not friends' }, { status: 403 });
  }

  let inviteCode: string | null = null;
  for (let attempt = 0; attempt < 3 && !inviteCode; attempt++) {
    const c = code();
    const { error } = await admin.from('match_invites').insert({
      inviter_id: me,
      invitee_id: body.friendId,
      invite_code: c,
      game_mode: gameMode,
    });
    if (!error) inviteCode = c;
    else if ((error as { code?: string }).code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!inviteCode) return NextResponse.json({ error: 'Could not create the invite' }, { status: 500 });

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  const title = MODE_BY_DBKEY[gameMode]?.title ?? gameMode;
  void broadcastPush(
    {
      title: `${meProf?.username ?? 'A friend'} challenges you!`,
      body: `${title} VS Battle — tap to play now`,
      url: `/vs/join/${inviteCode}`,
    },
    new Set([body.friendId]),
  ).catch(() => {});

  return NextResponse.json({ code: inviteCode, gameMode });
}
