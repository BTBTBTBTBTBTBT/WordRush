import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  // Filters follow the page's dropdowns; 'ALL' (or absent) means everything.
  // Solo vs VS uses the codebase's canonical rule (MatchStatsService et al.):
  // a solo game is a matches row with player2_id NULL; VS has an opponent.
  const mode = searchParams.get('mode') || 'ALL';
  const playType = searchParams.get('play_type') || 'vs';

  let query = admin
    .from('matches')
    // Usernames joined here so the table shows people, not uuid prefixes.
    // Winner is always player1/player2/null, so the client maps its name
    // from these two joins rather than a third.
    .select('*, player1:profiles!matches_player1_id_fkey(username), player2:profiles!matches_player2_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (mode !== 'ALL') query = query.eq('game_mode', mode);
  if (playType === 'solo') query = query.is('player2_id', null);
  else query = query.not('player2_id', 'is', null);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data || [] });
}
