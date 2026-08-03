import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { stampHeartbeat } from '@/lib/heartbeat';

// Vercel Pro raises the serverless function limit above Hobby's 10s cap. This
// route batches over rows, so give it headroom to finish instead of timing out.
export const maxDuration = 60;

const GAME_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];
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
  // which means medals for players in timezones east of UTC can lag up to
  // ~24h behind their local midnight. This cron is the ONLY awarder of
  // daily podium medals (there is no client-side path); the lag is an
  // accepted trade-off, and re-runs are idempotent via the INSERT guard below.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let medalsAssigned = 0;
  let xpGranted = 0;
  let alreadyAwarded = 0;

  for (const mode of GAME_MODES) {
    for (const pt of PLAY_TYPES) {
      // Podium ranking (founder call, 2026-08-03): score first, then FASTER
      // GAME breaks ties — "recorded earlier in the day" was the old breaker
      // and it isn't a skill signal. If score AND time are both identical,
      // the players SHARE the medal (competition ranking: two golds consume
      // ranks 1+2, next player takes bronze). Fetch 6 so a shared podium can
      // still fill three tiers; created_at stays only as a determinism
      // fallback for the fetch order, never to split a medal.
      const { data: leaderboard } = await sb
        .from('daily_results')
        .select('user_id, composite_score, time_seconds')
        .eq('day', yesterday)
        .eq('game_mode', mode)
        .eq('play_type', pt)
        .gt('composite_score', 0)
        .order('composite_score', { ascending: false })
        .order('time_seconds', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(6);

      if (!leaderboard || leaderboard.length === 0) continue;

      // Competition ranks: position of the first row with the same
      // (score, time) decides the tier for every row tied with it.
      const podium = leaderboard
        .map((entry, i) => {
          const firstTied = leaderboard.findIndex(
            (e) => e.composite_score === entry.composite_score
              && e.time_seconds === entry.time_seconds,
          );
          return { entry, rank: firstTied };
        })
        .filter(({ rank }) => rank < MEDAL_TYPES.length);

      for (const { entry, rank } of podium) {
        const medalType = MEDAL_TYPES[rank];

        // INSERT (not upsert): if the medal row already exists — cron re-run,
        // manual retry, or a perfect medal sharing the key — skip the counter
        // and XP grant entirely. The old upsert "succeeded" on conflict and
        // double-incremented gold/silver/bronze counters + XP on every re-run
        // (and silently overwrote same-day perfect medals).
        const { error: medalError } = await sb
          .from('medals')
          .insert({
            user_id: entry.user_id,
            day: yesterday,
            game_mode: mode,
            play_type: pt,
            medal_type: medalType,
            composite_score: entry.composite_score,
          });

        if (medalError) {
          // Duplicate (already awarded) or transient — never re-grant. COUNTED,
          // because Vercel crons are at-least-once: a second firing finds every
          // medal already inserted and would otherwise stamp a bare "medals 0",
          // which reads as "the cron did nothing" when the truth is "another run
          // already did the work". 2026-08-01 cost a morning of investigation.
          alreadyAwarded++;
          continue;
        }

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

  await stampHeartbeat(
    'daily-medals',
    true,
    `medals ${medalsAssigned}, xp ${xpGranted}` +
      (alreadyAwarded ? `, ${alreadyAwarded} already awarded` : ''),
  );
  return NextResponse.json({
    success: true,
    day: yesterday,
    medalsAssigned,
    xpGranted,
  });
}
