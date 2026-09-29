import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { gateProfilePrivacy, privateProfileResponse, privacyCacheHeader } from '@/lib/profile-privacy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECENT_LIMIT = 50;
const TODAY_WINDOW_H = 36;
const TODAY_CAP = 400;

// Public recent-match history for a player's profile page.
//
// The `matches` SELECT policy is participants-only (score/guess rows are
// self-readable, by design), so the client-side queries every platform's
// public-profile screen used to run returned zero rows for anyone but
// yourself — "Recent Matches" was permanently empty on other players'
// profiles. This endpoint reads with the service role and returns only the
// columns those screens render: NO guess arrays, which is the sensitive part
// the RLS lock exists to protect.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  // Private profiles: match history is exactly the "recent games" surface the
  // toggle exists to hide. Owner/admin (Bearer-authed) still get it.
  const gate = await gateProfilePrivacy(req, id);
  if (gate.status === 'private') return privateProfileResponse();

  // The newest RECENT_LIMIT games, plus every game of the last TODAY_WINDOW_H hours
  // (up to TODAY_CAP): the apps' "Today's Games" filters this list by the device's
  // local day, and a long Unlimited session (founder, 2026-09-29: dozens of Starsweep
  // replays) used to push the morning's dailies past the old flat 50. 36 h covers
  // "today" in every time zone.
  const admin = getAdminSupabase();
  const cols = 'id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at, forfeit, seed';
  const mine = `player1_id.eq.${id},player2_id.eq.${id}`;
  const since = new Date(Date.now() - TODAY_WINDOW_H * 3600_000).toISOString();
  const [recent, today] = await Promise.all([
    admin.from('matches').select(cols).or(mine).order('created_at', { ascending: false }).limit(RECENT_LIMIT),
    admin.from('matches').select(cols).or(mine).gte('created_at', since).order('created_at', { ascending: false }).limit(TODAY_CAP),
  ]);
  if (recent.error || today.error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  const byId = new Map<string, NonNullable<typeof recent.data>[number]>();
  for (const m of [...(today.data ?? []), ...(recent.data ?? [])]) byId.set(m.id, m);
  // `daily` (from the seed, which itself is not sent) lets Today's Games list each daily on its
  // own row and fold the Unlimited replays into one row per game.
  const data = Array.from(byId.values())
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .map(({ seed, ...m }) => ({ ...m, daily: typeof seed === 'string' ? seed.startsWith('daily-') : null }));

  return NextResponse.json(
    { matches: data },
    { headers: { 'Cache-Control': privacyCacheHeader(gate, 'public, s-maxage=30, stale-while-revalidate=120') } },
  );
}
