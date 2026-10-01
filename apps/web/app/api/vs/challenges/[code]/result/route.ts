import { NextRequest, NextResponse } from 'next/server';
import { vsOutcome, vsMargin, vsClock } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { addVsStat, parseRun, type RunBody } from '@/lib/vs-challenges-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/vs/challenges/<code>/result { run } — the racer finished the
 * challenger's puzzle. Scores it with the live rule (core vsOutcome), then,
 * once per racer:
 *   - stores the entry,
 *   - writes ONE VS `matches` row (player1 = racer, player2 = challenger) so
 *     head-to-head, Rivals and Recent Matches count it like a live match,
 *   - adds the challenger's side to their user_stats 'vs' row (the racer's
 *     client records its own side, with XP, through the normal VS path),
 *   - pushes the challenger the result.
 * `quit: true` (left mid-race) is a forfeit: always a loss for the racer.
 * Returns { outcome, margin, challengerRun } from the racer's side. A repeat
 * post returns the first result unchanged (alreadyRecorded: true).
 */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const { code } = params;

  let body: { run?: RunBody; quit?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const run = parseRun(body.run);
  if (!run) return NextResponse.json({ error: 'run required' }, { status: 400 });

  const admin = getAdminSupabase();
  const { data: row } = await admin.from('vs_challenges').select('*').eq('code', (code ?? '').toUpperCase()).maybeSingle();
  if (!row) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
  if (row.challenger_id === me) return NextResponse.json({ error: "You can't race your own run" }, { status: 400 });
  if (!(row.is_link || (row.invitee_ids ?? []).includes(me))) return NextResponse.json({ error: 'Not your challenge' }, { status: 403 });

  const theirs = { solved: row.solved, boardsSolved: row.boards_solved, guesses: row.guesses, timeMs: row.time_ms };
  const challengerRun = { ...theirs, totalBoards: row.total_boards, guessLog: row.guess_log ?? [], solutions: row.solutions ?? [] };

  const { data: prior } = await admin.from('vs_challenge_entries').select('outcome').eq('challenge_id', row.id).eq('user_id', me).maybeSingle();
  if (prior) {
    return NextResponse.json({ outcome: prior.outcome, margin: vsMargin(run, theirs), challengerRun, alreadyRecorded: true });
  }
  // A run finished after the window still scores for the racer's own screen,
  // but only an in-time run is recorded (the card said "within 24 hours").
  if (new Date(row.expires_at).getTime() + 15 * 60 * 1000 < Date.now()) {
    return NextResponse.json({ error: 'This challenge has expired' }, { status: 410 });
  }

  // A quit mid-race is a forfeit: a loss for the racer even when both runs
  // failed (otherwise two unsolved runs would score a draw).
  const outcome = body.quit === true ? 'loss' : vsOutcome(run, theirs);
  const { error: entryErr } = await admin.from('vs_challenge_entries').insert({
    challenge_id: row.id,
    user_id: me,
    solved: run.solved,
    boards_solved: run.boardsSolved,
    guesses: run.guesses,
    time_ms: run.timeMs,
    guess_log: run.guessLog,
    outcome,
  });
  if (entryErr) {
    if ((entryErr as { code?: string }).code === '23505') {
      return NextResponse.json({ outcome, margin: vsMargin(run, theirs), challengerRun, alreadyRecorded: true });
    }
    return NextResponse.json({ error: entryErr.message }, { status: 500 });
  }

  await admin.from('matches').insert({
    game_mode: row.game_mode,
    player1_id: me,
    player2_id: row.challenger_id,
    winner_id: outcome === 'win' ? me : outcome === 'loss' ? row.challenger_id : null,
    player1_score: run.guesses,
    player2_score: row.guesses,
    player1_time: Math.round(run.timeMs / 1000),
    player2_time: Math.round(row.time_ms / 1000),
    seed: row.seed,
    solutions: row.solutions ?? [],
    player1_guesses: run.guessLog,
    player2_guesses: row.guess_log ?? [],
    started_at: new Date(Date.now() - run.timeMs).toISOString(),
  });

  const challengerOutcome = outcome === 'win' ? 'loss' : outcome === 'loss' ? 'win' : 'draw';
  await addVsStat(admin, row.challenger_id, row.game_mode, challengerOutcome, row.guesses, row.time_ms).catch(() => {});

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  const who = meProf?.username ?? 'Your friend';
  const title = MODE_BY_DBKEY[row.game_mode]?.title ?? row.game_mode;
  const margin = vsMargin(run, theirs).toLowerCase();
  const line = outcome === 'win' ? `${who} beat your ${title} run (${margin})`
    : outcome === 'loss' ? `Your ${title} run held against ${who} (${margin})`
    : `${who} tied your ${title} run`;
  void broadcastPush(
    { title: line, body: `${run.solved ? `Solved in ${run.guesses} · ${vsClock(run.timeMs)}` : 'Not solved'}. Tap to challenge back.`, url: `/vs/challenge/${row.code}` },
    new Set([row.challenger_id]),
    'challenge',
  ).catch(() => {});

  return NextResponse.json({ outcome, margin: vsMargin(run, theirs), challengerRun, alreadyRecorded: false });
}
