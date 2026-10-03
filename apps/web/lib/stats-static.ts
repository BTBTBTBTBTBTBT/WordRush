// The Stats tab's per-user "static" bundle (user_stats, matches + opponent
// names, medals, achievements, today's dailies, the sweep points, standing,
// today's VS result, sweep stats) — one fetch behind the SWR key
// statsStaticKey(id). Moved out of app/stats/page.tsx (BI19) so the launch /
// post-finish prefetch can warm the same cache entry the page reads; the SWR
// cache itself is persisted (components/providers/data-cache-provider.tsx).

import { supabase } from './supabase-client';
import { fetchDailyVsResult, fetchTodayDailyCompletions, fetchUserMedals, getTodayLocal } from './daily-service';
import { fetchDailyPointsOverTime, fetchDailySweepStats, fetchTodayDailyStanding, type DailySweepStats } from './stats-service';
import { fetchUserAchievements } from './achievement-service';
import type { Database } from './database.types';

type UserStats = Database['public']['Tables']['user_stats']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];

/** The SWR key the Stats page reads this bundle under. */
export function statsStaticKey(profileId: string): [string, string] {
  return ['profile-static', profileId];
}

export async function fetchStatsStatic(profileId: string) {
  const [statsRes, matchBundle, medalsRes, achievementsRes, dailiesRes, sweepPointsRes, standingRes, vsTodayRes, sweepStatsRes] = await Promise.all([
    // BI19: a failed core read THROWS, so SWR keeps the cached bundle on
    // screen instead of swapping in an empty one during an outage.
    supabase.from('user_stats').select('*').eq('user_id', profileId).then((r) => { if (r.error) throw r.error; return r.data || []; }),
    // Matches + opponent usernames chained INSIDE the Promise.all — the
    // name lookup used to run after it, adding a round trip to everything.
    (async () => {
      // The newest 50 plus every game of the last 36 h, so Today's Games is never cut short
      // by a long Unlimited session (founder, 2026-09-29); `seed` tells daily from Unlimited.
      const cols = 'id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, player1_time, player2_time, created_at, forfeit, seed';
      const mine = `player1_id.eq.${profileId},player2_id.eq.${profileId}`;
      const since = new Date(Date.now() - 36 * 3600_000).toISOString();
      const [recent, today] = await Promise.all([
        supabase.from('matches').select(cols).or(mine).order('created_at', { ascending: false }).limit(50),
        supabase.from('matches').select(cols).or(mine).gte('created_at', since).order('created_at', { ascending: false }).limit(400),
      ]);
      const byId = new Map<string, Match>();
      for (const m of [...((today.data || []) as Match[]), ...((recent.data || []) as Match[])]) byId.set(m.id, m);
      const matchRows = Array.from(byId.values()).sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : 0));
      const oppIds = Array.from(new Set(
        matchRows
          .filter((m) => m.player2_id)
          .map((m) => (m.player1_id === profileId ? m.player2_id! : m.player1_id)),
      ));
      const opponentNames: Record<string, string> = {};
      if (oppIds.length > 0) {
        const { data: oppProfiles } = await (supabase as any)
          .from('profiles')
          .select('id, username')
          .in('id', oppIds);
        for (const p of (oppProfiles as Array<{ id: string; username: string }> | null) || []) {
          opponentNames[p.id] = p.username;
        }
      }
      return { matchRows, opponentNames };
    })(),
    fetchUserMedals(profileId, 120),
    fetchUserAchievements(profileId),
    fetchTodayDailyCompletions(profileId, { throwOnError: true }),
    fetchDailyPointsOverTime(profileId, 30),
    fetchTodayDailyStanding(profileId),
    fetchDailyVsResult(profileId).catch(() => null),
    fetchDailySweepStats(profileId).catch(() => null),
  ]);
  return {
    /** The local day this bundle was read on — a persisted copy from an earlier day has no "today" data. */
    day: getTodayLocal(),
    stats: statsRes as UserStats[],
    matches: matchBundle.matchRows,
    opponentNames: matchBundle.opponentNames,
    medals: medalsRes,
    userAchievements: new Set(achievementsRes.map(a => a.key)),
    achievementDates: new Map<string, string | null>(achievementsRes.map(a => [a.key, a.unlocked_at ?? null])),
    todayDailies: dailiesRes,
    sweepPoints: sweepPointsRes,
    standing: standingRes,
    vsDailyWon: vsTodayRes as boolean | null,
    sweepStats: sweepStatsRes as DailySweepStats | null,
  };
}

export type StatsStatic = Awaited<ReturnType<typeof fetchStatsStatic>>;
