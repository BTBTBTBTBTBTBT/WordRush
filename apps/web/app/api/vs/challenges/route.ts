import { NextRequest, NextResponse } from 'next/server';
import { vsClock } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, acceptedFriendIds, isUuid } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { VS_MODES, challengeCode, isPro, parseRun, toView, type RunBody } from '@/lib/vs-challenges-server';

export const dynamic = 'force-dynamic';

/**
 * Async VS challenges, "race my run" (founder, 2026-10-01; spec
 * docs/VS_REDESIGN_SPEC.md §4).
 *
 * POST { gameMode, seed, run, friendIds?, link? } — the challenger has just
 *   played `seed`; store the run, push each listed friend. Sending is Pro.
 *   Returns { code, url }.
 * GET — { incoming, sent }: open challenges waiting for me (newest first), and
 *   my recent challenges with each friend's result.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { gameMode?: string; seed?: string; run?: RunBody; friendIds?: unknown; link?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const gameMode = body.gameMode ?? '';
  const seed = typeof body.seed === 'string' ? body.seed : '';
  const run = parseRun(body.run);
  if (!VS_MODES.has(gameMode) || !seed || seed.length > 80 || !run) {
    return NextResponse.json({ error: 'gameMode, seed and run required' }, { status: 400 });
  }
  const requested = Array.isArray(body.friendIds) ? body.friendIds.filter(isUuid).filter((id) => id !== me) : [];
  const link = body.link === true;
  if (requested.length === 0 && !link) return NextResponse.json({ error: 'Pick a friend or send a link' }, { status: 400 });

  const admin = getAdminSupabase();
  if (!(await isPro(admin, me))) return NextResponse.json({ error: 'Sending challenges is a Pro feature' }, { status: 403 });

  const friends = new Set(await acceptedFriendIds(admin, me));
  const invitees = [...new Set(requested)].filter((id) => friends.has(id)).slice(0, 20);

  let code: string | null = null;
  for (let attempt = 0; attempt < 4 && !code; attempt++) {
    const c = challengeCode();
    const { error } = await admin.from('vs_challenges').insert({
      code: c,
      challenger_id: me,
      game_mode: gameMode,
      seed,
      solved: run.solved,
      boards_solved: run.boardsSolved,
      total_boards: run.totalBoards,
      guesses: run.guesses,
      time_ms: run.timeMs,
      guess_log: run.guessLog,
      solutions: run.solutions,
      invitee_ids: invitees,
      is_link: link,
    });
    if (!error) code = c;
    else if ((error as { code?: string }).code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!code) return NextResponse.json({ error: 'Could not create the challenge' }, { status: 500 });

  if (invitees.length > 0) {
    const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
    const title = MODE_BY_DBKEY[gameMode]?.title ?? gameMode;
    const result = run.solved ? `solved in ${run.guesses} · ${vsClock(run.timeMs)}` : 'a run to beat';
    void broadcastPush(
      {
        title: `${meProf?.username ?? 'A friend'} challenged you!`,
        body: `${title}: ${result}. Race their run within 24 hours.`,
        url: `/vs/challenge/${code}`,
      },
      new Set(invitees),
      'challenge',
    ).catch(() => {});
  }

  return NextResponse.json({ code, url: `/vs/challenge/${code}`, invitees: invitees.length });
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const admin = getAdminSupabase();
  const nowIso = new Date().toISOString();

  const [{ data: inRows }, { data: sentRows }, { data: mine }] = await Promise.all([
    admin.from('vs_challenges').select('*').contains('invitee_ids', [me]).gt('expires_at', nowIso).order('created_at', { ascending: false }).limit(20),
    admin.from('vs_challenges').select('*').eq('challenger_id', me).order('created_at', { ascending: false }).limit(10),
    admin.from('vs_challenge_entries').select('challenge_id').eq('user_id', me).limit(500),
  ]);
  const raced = new Set((mine ?? []).map((r: { challenge_id: string }) => r.challenge_id));
  const open = (inRows ?? []).filter((r: any) => !raced.has(r.id));

  const sentIds = (sentRows ?? []).map((r: any) => r.id);
  const { data: entries } = sentIds.length
    ? await admin.from('vs_challenge_entries').select('challenge_id, user_id, outcome, guesses, time_ms, solved, created_at').in('challenge_id', sentIds)
    : { data: [] as any[] };

  const ids = new Set<string>();
  for (const r of open) ids.add(r.challenger_id);
  for (const e of entries ?? []) ids.add(e.user_id);
  const { data: profs } = ids.size
    ? await admin.from('profiles').select('id, username, avatar_url').in('id', [...ids])
    : { data: [] as any[] };
  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));

  return NextResponse.json({
    incoming: open.map((r: any) => toView(r, byId.get(r.challenger_id))),
    sent: (sentRows ?? []).map((r: any) => ({
      code: r.code,
      gameMode: r.game_mode,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      invitees: (r.invitee_ids ?? []).length,
      results: (entries ?? []).filter((e: any) => e.challenge_id === r.id).map((e: any) => ({
        username: (byId.get(e.user_id) as any)?.username ?? 'Player',
        // From the CHALLENGER's side, so the sender reads "you won" directly.
        outcome: e.outcome === 'win' ? 'loss' : e.outcome === 'loss' ? 'win' : 'draw',
        guesses: e.guesses,
        timeMs: e.time_ms,
        solved: e.solved,
      })),
    })),
  });
}
