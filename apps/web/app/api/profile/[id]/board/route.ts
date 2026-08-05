import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';
import { gateProfilePrivacy, privateProfileResponse } from '@/lib/profile-privacy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEED = /^daily-(\d{4}-\d{2}-\d{2})-([A-Z0-9_]{1,32})$/;

// The spoiler-guarded board viewer: another player's solved daily board,
// released ONLY to a requester who has already finished that same daily.
//
// This is the one rule that makes the whole clickable-profile layer
// spoiler-safe. It is enforced HERE, server-side, because guess arrays are
// what the matches participants-only policy exists to protect — the client
// never gets to decide whether it deserves them.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const seed = req.nextUrl.searchParams.get('seed') ?? '';
  const m = SEED.exec(seed);
  if (!m) return NextResponse.json({ error: 'Invalid seed' }, { status: 400 });
  const [, day, mode] = m;

  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Private profiles: a full board (guesses + solutions) is the deepest
  // strategy read there is. The finished-the-daily guard below is necessary
  // but not sufficient once the target opted out.
  const gate = await gateProfilePrivacy(req, id);
  if (gate.status === 'private') return privateProfileResponse();

  const admin = getAdminSupabase();

  // The guard: requester must have a daily_results row for this day+mode.
  // Played-but-lost still unlocks (they've seen the solution either way).
  const { data: mine } = await admin
    .from('daily_results')
    .select('id')
    .eq('user_id', user.id)
    .eq('day', day)
    .eq('game_mode', mode)
    .eq('play_type', 'solo')
    .limit(1);
  if (!mine || mine.length === 0) {
    return NextResponse.json({ locked: true, error: 'Finish this daily first' }, { status: 403 });
  }

  const { data: rows } = await admin
    .from('matches')
    .select('game_mode, player1_guesses, solutions, player1_time, winner_id, hints_used')
    .eq('player1_id', id)
    .eq('seed', seed)
    .is('player2_id', null)
    .order('created_at', { ascending: false })
    .limit(1);
  const row = rows?.[0];
  if (!row) return NextResponse.json({ error: 'No board recorded' }, { status: 404 });

  return NextResponse.json(
    {
      seed,
      gameMode: row.game_mode,
      guesses: row.player1_guesses ?? [],
      solutions: row.solutions ?? [],
      timeSeconds: Math.round(row.player1_time ?? 0),
      won: row.winner_id === id,
      hintsUsed: row.hints_used ?? 0,
    },
    // Private: the response depends on the REQUESTER's completion state.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
