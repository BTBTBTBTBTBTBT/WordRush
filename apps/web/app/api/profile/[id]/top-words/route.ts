import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { gateProfilePrivacy, privateProfileResponse, privacyCacheHeader } from '@/lib/profile-privacy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODE = /^[A-Z0-9_]{1,32}$/;

// Top-5 most-guessed words for a player + mode, aggregated SERVER-side.
//
// Companion to ./matches: the participants-only `matches` policy blanked
// this on other players' profiles too. Raw guess rows never leave the
// server — only the aggregated {word, count, wins} list does, mirroring
// fetchTopWords in lib/stats-service.ts (player1 rows only; hint rows are
// space-padded strings and are excluded by the all-letters test).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const mode = req.nextUrl.searchParams.get('mode') ?? '';
  if (!MODE.test(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  const play = req.nextUrl.searchParams.get('play') === 'vs' ? 'vs' : 'solo';

  // Private profiles: top words ARE the player's strategy — the core thing
  // the privacy toggle hides. Owner/admin (Bearer-authed) still get them.
  const gate = await gateProfilePrivacy(req, id);
  if (gate.status === 'private') return privateProfileResponse();

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('matches')
    .select('player1_guesses, winner_id')
    .eq('player1_id', id)
    .eq('game_mode', mode)
    .not('player1_guesses', 'is', null)
    .filter('player2_id', play === 'vs' ? 'not.is' : 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });

  const wordMap = new Map<string, { count: number; wins: number }>();
  for (const row of (data ?? []) as Array<{ player1_guesses: string[] | null; winner_id: string | null }>) {
    if (!Array.isArray(row.player1_guesses)) continue;
    const won = row.winner_id === id;
    for (const w0 of row.player1_guesses) {
      const w = String(w0).toUpperCase();
      if (!/^[A-Z]+$/.test(w)) continue;
      const e = wordMap.get(w) ?? { count: 0, wins: 0 };
      e.count++;
      if (won) e.wins++;
      wordMap.set(w, e);
    }
  }
  const topWords = Array.from(wordMap.entries())
    .map(([word, s]) => ({ word, count: s.count, wins: s.wins }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return NextResponse.json(
    { topWords },
    { headers: { 'Cache-Control': privacyCacheHeader(gate, 'public, s-maxage=30, stale-while-revalidate=120') } },
  );
}
