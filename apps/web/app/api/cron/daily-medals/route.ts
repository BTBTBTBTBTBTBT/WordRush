import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

const GAME_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'GAUNTLET', 'PROPERNOUNDLE'];
const PLAY_TYPES = ['solo', 'vs'] as const;
const MEDAL_TYPES = ['gold', 'silver', 'bronze'] as const;
const MEDAL_XP: Record<string, number> = { gold: 100, silver: 50, bronze: 25 };

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this automatically for cron jobs)
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();
  // Cron runs in Vercel's UTC clock, so "yesterday" here is yesterday-UTC.
  // daily_results.day is stored as player-local date (see getTodayLocal),
  // which means this cron can lag up to ~24h for players in timezones east
  // of UTC. The client-side assignDailyMedals() best-effort path covers
  // those cases; this cron is a safety net for players who didn't revisit.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let medalsAssigned = 0;
  let xpGranted = 0;

  for (const mode of GAME_MODES) {
    for (const pt of PLAY_TYPES) {
      // Fetch top 3 for this mode/playType on yesterday
      const { data: leaderboard } = await sb
        .from('daily_results')
        .select('user_id, composite_score')
        .eq('day', yesterday)
        .eq('game_mode', mode)
        .eq('play_type', pt)
        .gt('composite_score', 0)
        .order('composite_score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(3);

      if (!leaderboard || leaderboard.length === 0) continue;

      for (let i = 0; i < leaderboard.length; i++) {
        const entry = leaderboard[i];
        const medalType = MEDAL_TYPES[i];

        // Upsert medal (unique constraint prevents duplicates)
        const { error: medalError } = await sb
          .from('medals')
          .upsert({
            user_id: entry.user_id,
            day: yesterday,
            game_mode: mode,
            play_type: pt,
            medal_type: medalType,
            composite_score: entry.composite_score,
          }, { onConflict: 'user_id,day,game_mode,play_type' });

        if (medalError) continue;

        // Increment profile medal counter + grant XP bonus
        const medalCol = `${medalType}_medals`;
        const xpBonus = MEDAL_XP[medalType];

        const { data: profile } = await sb
          .from('profiles')
          .select(`${medalCol}, xp, level`)
          .eq('id', entry.user_id)
          .single() as { data: any };

        if (profile) {
          const newXp = (profile.xp || 0) + xpBonus;
          const newLevel = Math.floor(newXp / 1000) + 1;

          await sb
            .from('profiles')
            .update({
              [medalCol]: (profile[medalCol] || 0) + 1,
              xp: newXp,
              level: newLevel,
            })
            .eq('id', entry.user_id);

          medalsAssigned++;
          xpGranted += xpBonus;
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    day: yesterday,
    medalsAssigned,
    xpGranted,
  });
}
