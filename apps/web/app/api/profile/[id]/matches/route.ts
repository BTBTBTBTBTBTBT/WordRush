import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { gateProfilePrivacy, privateProfileResponse, privacyCacheHeader } from '@/lib/profile-privacy';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('matches')
    .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at, forfeit')
    .or(`player1_id.eq.${id},player2_id.eq.${id}`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });

  return NextResponse.json(
    { matches: data ?? [] },
    { headers: { 'Cache-Control': privacyCacheHeader(gate, 'public, s-maxage=30, stale-while-revalidate=120') } },
  );
}
