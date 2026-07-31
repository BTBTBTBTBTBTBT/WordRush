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
  // Mode filter follows the page's dropdown; 'ALL' (or absent) means everything.
  const mode = searchParams.get('mode') || 'ALL';

  let query = admin
    .from('matches')
    // Usernames joined here so the table shows people, not uuid prefixes.
    // Winner is always player1/player2/null, so the client maps its name
    // from these two joins rather than a third.
    .select('*, player1:profiles!matches_player1_id_fkey(username), player2:profiles!matches_player2_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (mode !== 'ALL') query = query.eq('game_mode', mode);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data || [] });
}
