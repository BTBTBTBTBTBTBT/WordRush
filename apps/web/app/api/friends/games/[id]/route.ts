import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';
import { gameView, profilesById, sideOf, type GameRow } from '@/lib/friendly-games-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends/games/<id> → { game }. The game screen polls this every
 * two seconds while open (live play when both are on). Each read stamps the
 * viewer's seen time, so a move only pushes a friend who is NOT watching.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const admin = getAdminSupabase();
  const { data } = await admin.from('friendly_games').select('*').eq('id', params.id).maybeSingle();
  const row = data as GameRow | null;
  const side = row ? sideOf(row, me) : null;
  if (!row || !side) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await admin.from('friendly_games').update({ [side === 'a' ? 'a_seen_at' : 'b_seen_at']: new Date().toISOString() }).eq('id', row.id);
  const oppId = side === 'a' ? row.player_b : row.player_a;
  const profs = await profilesById(admin, [oppId]);
  return NextResponse.json({ game: gameView(row, me, profs.get(oppId)) });
}
