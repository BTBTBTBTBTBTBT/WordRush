import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

const GAME_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE'];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();

  const { data: users } = await sb
    .from('profiles')
    .select('id')
    .limit(10000);

  if (!users?.length) {
    return NextResponse.json({ message: 'No users found', records: 0 });
  }

  let recordsWritten = 0;

  for (const user of users) {
    for (const mode of GAME_MODES) {
      const { data: matches } = await sb
        .from('matches')
        .select('winner_id')
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('game_mode', mode)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!matches?.length) continue;

      let best = 0;
      let streak = 0;
      for (const m of matches) {
        if (m.winner_id === user.id) {
          streak++;
          best = Math.max(best, streak);
        } else {
          streak = 0;
        }
      }

      if (best <= 0) continue;

      for (const playType of ['solo', 'vs']) {
        const { data: existing } = await sb
          .from('all_time_records')
          .select('id, record_value')
          .eq('record_type', 'longest_streak')
          .eq('game_mode', mode)
          .eq('play_type', playType)
          .maybeSingle();

        if (!existing || best > existing.record_value) {
          await sb
            .from('all_time_records')
            .upsert({
              record_type: 'longest_streak',
              game_mode: mode,
              play_type: playType,
              holder_id: user.id,
              record_value: best,
              achieved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'record_type,game_mode,play_type' });
          recordsWritten++;
        }
      }
    }
  }

  return NextResponse.json({ success: true, usersProcessed: users.length, recordsWritten });
}
