import { NextRequest, NextResponse } from 'next/server';
import { pocketRecords, type PocketGameRow } from '@wordle-duel/core';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends/pocket-records — the caller's pocket-game record (FRIDAY-QUEUE item 16, 2.8):
 * one row per pocket game (wins / losses / draws + Word Chain's best run) and the same per friend,
 * counted from finished friendly_games rows by core `pocketRecords` (the same numbers the Stats
 * page's POCKET GAMES section, the Friends cards and a friend's profile strip show). Only the
 * caller's own games; expired / unfinished games never count.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from('friendly_games')
    .select('kind, player_a, player_b, status, winner, state')
    .or(`player_a.eq.${me},player_b.eq.${me}`)
    .in('status', ['done', 'resigned'])
    .limit(2000);
  const rows: PocketGameRow[] = ((data ?? []) as Array<PocketGameRow & { state?: { words?: unknown[] } }>).map((g) => ({
    kind: g.kind,
    player_a: g.player_a,
    player_b: g.player_b,
    status: g.status,
    winner: g.winner,
    chainWords: g.kind === 'chain' ? (g.state?.words?.length ?? 0) : undefined,
  }));
  return NextResponse.json(pocketRecords(rows, me));
}
