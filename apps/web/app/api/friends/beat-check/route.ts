import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, acceptedFriendIds } from '@/lib/friends-server';
import { broadcastPush } from '@/lib/push/broadcast';
import { modeLabel } from '@/lib/mode-labels';
import { formatScore } from '@/lib/composite-scoring';

export const dynamic = 'force-dynamic';

/**
 * POST /api/friends/beat-check { day, gameMode, playType? }
 *
 * The overtake push — automated smack talk (bible §207). Fired
 * fire-and-forget by the FINISHER's client right after a daily result saves.
 * The server re-reads the caller's own daily_results row (server-trusted
 * score — the body carries no numbers, so nothing can be spoofed) and pushes
 * every accepted friend whose earlier finish on the same board scored lower:
 *   "😤 Brian just passed you on OctoWord — 2,145 to your 2,016"
 *
 * Idempotency is the created_at freshness window: the caller's row must be
 * < 15 min old, so replays outside the save moment do nothing. Within the
 * window a duplicate call could re-push; clients fire once per save (the
 * recorded-flag machinery from §205 guarantees single saves).
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FRESH_MS = 15 * 60 * 1000;
const MAX_PUSHES = 10;

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  let body: { day?: string; gameMode?: string; playType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { day, gameMode } = body;
  const playType = body.playType === 'vs' ? 'vs' : 'solo';
  if (!day || !DAY_RE.test(day) || !gameMode || !/^[A-Z0-9_]{2,20}$/.test(gameMode)) {
    return NextResponse.json({ error: 'day and gameMode required' }, { status: 400 });
  }

  const admin = getAdminSupabase();

  // My freshly-saved row — the trusted source of my score.
  const { data: mine } = await admin
    .from('daily_results')
    .select('composite_score, created_at')
    .eq('user_id', me)
    .eq('day', day)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .maybeSingle();
  if (!mine) return NextResponse.json({ overtaken: 0 });
  if (Date.now() - new Date(mine.created_at).getTime() > FRESH_MS) {
    return NextResponse.json({ overtaken: 0, stale: true });
  }

  const friendIds = await acceptedFriendIds(admin, me);
  if (!friendIds.length) return NextResponse.json({ overtaken: 0 });

  // Friends who finished this board EARLIER with a LOWER score.
  const { data: passed } = await admin
    .from('daily_results')
    .select('user_id, composite_score')
    .eq('day', day)
    .eq('game_mode', gameMode)
    .eq('play_type', playType)
    .in('user_id', friendIds)
    .lt('composite_score', mine.composite_score)
    .lt('created_at', mine.created_at)
    .order('composite_score', { ascending: false })
    .limit(MAX_PUSHES);
  if (!passed?.length) return NextResponse.json({ overtaken: 0 });

  const { data: meProf } = await admin.from('profiles').select('username').eq('id', me).maybeSingle();
  const myName = meProf?.username ?? 'A friend';
  const label = modeLabel(gameMode);

  await Promise.allSettled(
    passed.map((row: { user_id: string; composite_score: number }) =>
      broadcastPush(
        {
          title: `😤 ${myName} just passed you`,
          body: `${label}: ${formatScore(mine.composite_score)} to your ${formatScore(row.composite_score)}`,
          url: '/daily',
        },
        new Set([row.user_id]),
      ),
    ),
  );

  return NextResponse.json({ overtaken: passed.length });
}
