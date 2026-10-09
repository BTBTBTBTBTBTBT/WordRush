import { randomInt } from 'node:crypto';
import { PUSH_TITLE, pushCopy, richPushTitle } from '@wordle-duel/core';
import { NextRequest, NextResponse } from 'next/server';
import { FRIENDLY_TITLES, friendlyScoreLabel, applyFriendlyMove, containsBlockedTerm, friendlyCardLine, type FriendlyMove } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { publishGameChange } from '@/lib/friendly-live-server';
import { gameView, grantPocketAchievements, hasWordPrefix, isListWord, passWordOk, profilesById, sideOf, winnerId, type GameRow } from '@/lib/friendly-games-server';

export const dynamic = 'force-dynamic';

/** A friend watching the game (polled in the last 25 s) gets the move live, not a push. */
const WATCHING_MS = 25 * 1000;

/**
 * POST /api/friends/games/<id>/move { move } → { game }. The server runs the
 * rules (core applyFriendlyMove): the coin flip is server randomness; Pass the
 * Puzzle, Ghost and Word Chain check the word lists and the blocked-term list;
 * an RPS pick stays hidden from the friend until both are in. The other player is pushed when
 * it becomes their turn or the game ends — unless they are watching.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { move?: FriendlyMove };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  if (!body.move || typeof body.move !== 'object') return NextResponse.json({ error: 'move required' }, { status: 400 });

  const admin = getAdminSupabase();
  const { data } = await admin.from('friendly_games').select('*').eq('id', params.id).maybeSingle();
  const row = data as GameRow | null;
  const side = row ? sideOf(row, me) : null;
  if (!row || !side) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (row.status !== 'active') return NextResponse.json({ error: 'This game is over' }, { status: 409 });

  const result = applyFriendlyMove(row.state, side, body.move, {
    random: () => randomInt(0, 1_000_000) / 1_000_000,
    solution: row.secret ?? undefined,
    isValidWord: passWordOk,
    isWord: isListWord,
    hasPrefix: hasWordPrefix,
    blocked: containsBlockedTerm,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    state: result.state,
    updated_at: now,
    [side === 'a' ? 'a_seen_at' : 'b_seen_at']: now,
  };
  if (result.done) {
    update.status = 'done';
    update.winner = winnerId(row, result.state);
  }
  // Optimistic concurrency: only apply over the state we read (two quick taps
  // or both RPS picks landing together must not overwrite each other).
  const { data: saved } = await admin
    .from('friendly_games')
    .update(update)
    .eq('id', row.id)
    .eq('updated_at', row.updated_at)
    .select('*')
    .maybeSingle();
  if (!saved) return NextResponse.json({ error: 'The game moved on — try again', retry: true }, { status: 409 });

  const next = saved as GameRow;
  const oppId = side === 'a' ? row.player_b : row.player_a;
  const profs = await profilesById(admin, [me, oppId]);
  const oppSeen = side === 'a' ? row.b_seen_at : row.a_seen_at;
  const watching = !!oppSeen && Date.now() - new Date(oppSeen).getTime() < WATCHING_MS;
  const theirView = gameView(next, oppId, profs.get(me));
  // 9b live play: the receiver's view goes out on the game channel the instant it is saved (best effort, 1.5 s cap).
  const published = publishGameChange(admin, next, me, theirView);
  if (!watching && (theirView.yourTurn || result.done)) {
    const who = profs.get(me)?.username ?? 'Your friend';
    const title = FRIENDLY_TITLES[row.kind];
    const line = friendlyCardLine({ kind: row.kind, state: next.state, me: side === 'a' ? 'b' : 'a', them: who, minutesAgo: 0 });
    void broadcastPush(
      // FINISH_SPEC AE: "{name} played. Your turn! 🎯" (shared copy) when it's their move.
      // Item 34: a title that reads complete ("Ava played Hubbub"); the move detail lives in the body.
      { title: richPushTitle('played', who, title), body: result.done ? `${line} It's over. Rematch?` : `${pushCopy('yourTurn', { name: who })} ${line}`.trim(), url: `/friends/games/${row.id}` },
      new Set([oppId]),
      'challenge',
      { senderId: me, senderName: who, gameId: `pocket-${row.kind}`, gameTitle: title, gameRowId: row.id, score: friendlyScoreLabel(next.state, side), kind: 'move', url: `/friends/games/${row.id}` },
    ).catch(() => {});
  }

  // FINISH_SPEC BE + BF1: a finished game (or a long Word Chain) can earn the
  // pocket achievements — granted for BOTH players; the mover gets theirs back
  // as newAchievements, the friend sees theirs on their next open / focus.
  let newAchievements: Awaited<ReturnType<typeof grantPocketAchievements>> = [];
  if (result.done || row.kind === 'chain') {
    [newAchievements] = await Promise.all([grantPocketAchievements(admin, me), result.done ? grantPocketAchievements(admin, oppId) : Promise.resolve([])]);
  }

  await published;
  return NextResponse.json({ game: gameView(next, me, profs.get(oppId)), newAchievements });
}
