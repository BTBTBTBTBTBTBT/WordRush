import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser, isUuid } from '@/lib/friends-server';
import { gameView, grantPocketAchievements, profilesById, sideOf, type GameRow } from '@/lib/friendly-games-server';

export const dynamic = 'force-dynamic';

/** POST /api/friends/games/<id>/resign → { game }: leave a game; the friend wins it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  if (!isUuid(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const admin = getAdminSupabase();
  const { data } = await admin.from('friendly_games').select('*').eq('id', params.id).maybeSingle();
  const row = data as GameRow | null;
  const side = row ? sideOf(row, me) : null;
  if (!row || !side) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const oppId = side === 'a' ? row.player_b : row.player_a;
  let next = row;
  if (row.status === 'active') {
    const { data: saved } = await admin
      .from('friendly_games')
      .update({ status: 'resigned', winner: oppId, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('*')
      .single();
    if (saved) next = saved as GameRow;
  }
  const profs = await profilesById(admin, [oppId]);
  // FINISH_SPEC BE + BF1: the friend just won — both players' pocket achievements update.
  const [newAchievements] = await Promise.all([grantPocketAchievements(admin, me), grantPocketAchievements(admin, oppId)]);
  return NextResponse.json({ game: gameView(next, me, profs.get(oppId)), newAchievements });
}
