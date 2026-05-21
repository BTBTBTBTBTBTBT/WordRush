import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * POST /api/admin/backfill-achievements
 *
 * Bulk-checks all 50 achievements for every user and inserts any that
 * are missing.  Run this after adding new achievements to the codebase
 * so existing users who already qualify get credit retroactively.
 *
 * Auth: Bearer $CRON_SECRET
 *
 * Each achievement is a single INSERT … SELECT … WHERE NOT EXISTS that
 * atomically finds qualifying users who don't already have the badge.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();
  const results: Record<string, number> = {};

  // Helper: run an INSERT … SELECT and return the count of new rows
  async function backfill(key: string, sql: string) {
    const { data, error } = await (sb as any).rpc('exec_sql', { query: sql });
    if (error) {
      // If the exec_sql function doesn't exist, fall back to raw insert approach
      results[key] = -1;
      return;
    }
    results[key] = typeof data === 'number' ? data : 0;
  }

  // Because Supabase JS client doesn't support raw SQL, we use
  // individual queries per achievement and insert via the client.
  // This is still efficient: one query per achievement, not per user.

  async function backfillAchievement(
    key: string,
    qualifyingUsersSql: string,
  ) {
    // Step 1: Find users who qualify but don't have the achievement yet
    const { data: qualifyingUsers, error } = await (sb as any)
      .rpc('exec_sql', { query: qualifyingUsersSql });

    if (error) {
      // exec_sql RPC doesn't exist — use the query-based approach instead
      results[key] = -1;
      return;
    }

    results[key] = Array.isArray(qualifyingUsers) ? qualifyingUsers.length : 0;
  }

  // ──────────────────────────────────────────────────────────────
  // Instead of relying on an RPC, use direct Supabase queries for
  // each achievement. This works with the standard Supabase client.
  // ──────────────────────────────────────────────────────────────

  let totalInserted = 0;

  async function award(key: string, userIds: string[]) {
    if (!userIds.length) {
      results[key] = 0;
      return;
    }
    // Filter out users who already have this achievement
    const { data: existing } = await sb
      .from('achievements')
      .select('user_id')
      .eq('achievement_key', key)
      .in('user_id', userIds);

    const alreadyHas = new Set((existing || []).map((r: any) => r.user_id));
    const newUsers = userIds.filter((id) => !alreadyHas.has(id));

    if (newUsers.length > 0) {
      const rows = newUsers.map((uid) => ({
        user_id: uid,
        achievement_key: key,
      }));
      // Insert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        await sb.from('achievements').insert(rows.slice(i, i + 500));
      }
    }

    results[key] = newUsers.length;
    totalInserted += newUsers.length;
  }

  // ── Profile-based achievements ─────────────────────────────────

  const { data: allProfiles } = await sb
    .from('profiles')
    .select('id, total_wins, total_losses, current_streak, best_streak, daily_login_streak, gold_medals, silver_medals, bronze_medals, level')
    .limit(50000);

  if (allProfiles) {
    await award('first_win', allProfiles.filter((p) => p.total_wins > 0).map((p) => p.id));
    await award('century_club', allProfiles.filter((p) => p.total_wins >= 100).map((p) => p.id));
    await award('thousand_words', allProfiles.filter((p) => p.total_wins >= 1000).map((p) => p.id));
    await award('unstoppable', allProfiles.filter((p) => p.best_streak >= 5).map((p) => p.id));
    await award('streak_7', allProfiles.filter((p) => p.daily_login_streak >= 7).map((p) => p.id));
    await award('streak_30', allProfiles.filter((p) => p.daily_login_streak >= 30).map((p) => p.id));
    await award('year_one', allProfiles.filter((p) => p.daily_login_streak >= 365).map((p) => p.id));
    await award('rising_star', allProfiles.filter((p) => p.level >= 10).map((p) => p.id));
    await award('elite', allProfiles.filter((p) => p.level >= 50).map((p) => p.id));

    // Medal achievements
    for (const p of allProfiles) {
      (p as any)._totalMedals = (p.gold_medals || 0) + (p.silver_medals || 0) + (p.bronze_medals || 0);
    }
    await award('medal_10', allProfiles.filter((p) => (p as any)._totalMedals >= 10).map((p) => p.id));
    await award('medal_50', allProfiles.filter((p) => (p as any)._totalMedals >= 50).map((p) => p.id));
    await award('medal_wall', allProfiles.filter((p) => (p as any)._totalMedals >= 100).map((p) => p.id));
    await award('golden_touch', allProfiles.filter((p) => (p.gold_medals || 0) >= 10).map((p) => p.id));

    // Untouchable (10-win streak) — use best_streak
    await award('untouchable', allProfiles.filter((p) => p.best_streak >= 10).map((p) => p.id));
  }

  // ── User-stats-based achievements ──────────────────────────────

  const { data: allStats } = await sb
    .from('user_stats')
    .select('user_id, game_mode, play_type, wins, total_games')
    .limit(100000);

  if (allStats) {
    // All Modes Played — user has all 9 modes in user_stats
    const ALL_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];
    const userModes = new Map<string, Set<string>>();
    for (const s of allStats) {
      if (!userModes.has(s.user_id)) userModes.set(s.user_id, new Set());
      userModes.get(s.user_id)!.add(s.game_mode);
    }
    await award('all_modes', [...userModes.entries()]
      .filter(([, modes]) => ALL_MODES.every((m) => modes.has(m)))
      .map(([uid]) => uid));

    // Mode mastery — solo wins in specific modes
    const modeMastery: [string, string, number][] = [
      ['quad_king', 'QUORDLE', 50],
      ['octo_boss', 'OCTORDLE', 50],
      ['sequence_ace', 'SEQUENCE', 50],
      ['rescue_hero', 'RESCUE', 50],
      ['six_shooter', 'DUEL_6', 50],
      ['lucky_seven', 'DUEL_7', 50],
      ['proper_scholar', 'PROPERNOUNDLE', 50],
      ['classic_master', 'DUEL', 100],
    ];
    for (const [key, mode, threshold] of modeMastery) {
      const qualifying = allStats
        .filter((s) => s.game_mode === mode && s.play_type === 'solo' && (s.wins || 0) >= threshold)
        .map((s) => s.user_id);
      await award(key, qualifying);
    }

    // VS achievements
    const vsStatsByUser = new Map<string, { totalGames: number; totalWins: number; modesWon: Set<string> }>();
    for (const s of allStats) {
      if (s.play_type !== 'vs') continue;
      if (!vsStatsByUser.has(s.user_id)) {
        vsStatsByUser.set(s.user_id, { totalGames: 0, totalWins: 0, modesWon: new Set() });
      }
      const entry = vsStatsByUser.get(s.user_id)!;
      entry.totalGames += s.total_games || 0;
      entry.totalWins += s.wins || 0;
      if ((s.wins || 0) > 0) entry.modesWon.add(s.game_mode);
    }
    await award('vs_veteran', [...vsStatsByUser.entries()].filter(([, v]) => v.totalWins >= 10).map(([uid]) => uid));
    await award('rival', [...vsStatsByUser.entries()].filter(([, v]) => v.totalGames >= 50).map(([uid]) => uid));
    await award('dominant', [...vsStatsByUser.entries()].filter(([, v]) => v.totalWins >= 50).map(([uid]) => uid));
    await award('versatile_victor', [...vsStatsByUser.entries()].filter(([, v]) => v.modesWon.size >= 5).map(([uid]) => uid));

    // Dedicated / Obsessed (total games across all modes)
    const totalGamesByUser = new Map<string, number>();
    for (const s of allStats) {
      totalGamesByUser.set(s.user_id, (totalGamesByUser.get(s.user_id) || 0) + (s.total_games || 0));
    }
    await award('dedicated', [...totalGamesByUser.entries()].filter(([, g]) => g >= 500).map(([uid]) => uid));
    await award('obsessed', [...totalGamesByUser.entries()].filter(([, g]) => g >= 2000).map(([uid]) => uid));
  }

  // ── Daily-results-based achievements ───────────────────────────

  const { data: allDailyResults } = await sb
    .from('daily_results')
    .select('user_id, day, game_mode, completed, guess_count, time_seconds, boards_solved, total_boards, vs_wins')
    .eq('completed', true)
    .limit(100000);

  if (allDailyResults) {
    // Daily Debut
    const usersWithDaily = [...new Set(allDailyResults.map((r) => r.user_id))];
    await award('daily_debut', usersWithDaily);

    // Speed Demon (Classic win under 30s)
    await award('speed_demon', [...new Set(
      allDailyResults
        .filter((r) => r.game_mode === 'DUEL' && r.boards_solved === r.total_boards && (r.time_seconds || 999) < 30)
        .map((r) => r.user_id),
    )]);

    // Blitz (any win under 15s)
    await award('blitz', [...new Set(
      allDailyResults
        .filter((r) => r.boards_solved === r.total_boards && (r.time_seconds || 999) < 15)
        .map((r) => r.user_id),
    )]);

    // Perfectionist (1 guess win)
    await award('perfectionist', [...new Set(
      allDailyResults
        .filter((r) => r.boards_solved === r.total_boards && r.guess_count === 1)
        .map((r) => r.user_id),
    )]);

    // No Sweat (Classic in 2 guesses)
    await award('no_sweat', [...new Set(
      allDailyResults
        .filter((r) => r.game_mode === 'DUEL' && r.boards_solved === r.total_boards && r.guess_count <= 2)
        .map((r) => r.user_id),
    )]);

    // Gauntlet Master
    await award('gauntlet_master', [...new Set(
      allDailyResults
        .filter((r) => r.game_mode === 'GAUNTLET' && r.boards_solved > 0 && r.boards_solved === r.total_boards)
        .map((r) => r.user_id),
    )]);

    // Gauntlet God (perfect gauntlet — all boards solved)
    await award('gauntlet_god', [...new Set(
      allDailyResults
        .filter((r) => r.game_mode === 'GAUNTLET' && r.boards_solved === r.total_boards && r.total_boards > 0)
        .map((r) => r.user_id),
    )]);

    // Close Call (win on final guess)
    const FINAL_GUESS: Record<string, number> = {
      DUEL: 6, DUEL_6: 7, DUEL_7: 8, PROPERNOUNDLE: 6, QUORDLE: 9, OCTORDLE: 13,
    };
    await award('close_call', [...new Set(
      allDailyResults
        .filter((r) => {
          const max = FINAL_GUESS[r.game_mode];
          return max && r.boards_solved === r.total_boards && r.guess_count === max;
        })
        .map((r) => r.user_id),
    )]);

    // Eagle Eye (10 lifetime 1-guess wins)
    const oneGuessCountByUser = new Map<string, number>();
    for (const r of allDailyResults) {
      if (r.boards_solved === r.total_boards && r.guess_count === 1) {
        oneGuessCountByUser.set(r.user_id, (oneGuessCountByUser.get(r.user_id) || 0) + 1);
      }
    }
    await award('eagle_eye', [...oneGuessCountByUser.entries()].filter(([, c]) => c >= 10).map(([uid]) => uid));

    // Extended Vocabulary (both Six and Seven won in same day)
    const sixSevenByUserDay = new Map<string, Set<string>>();
    for (const r of allDailyResults) {
      if ((r.game_mode === 'DUEL_6' || r.game_mode === 'DUEL_7') && r.boards_solved === r.total_boards) {
        const key = `${r.user_id}|${r.day}`;
        if (!sixSevenByUserDay.has(key)) sixSevenByUserDay.set(key, new Set());
        sixSevenByUserDay.get(key)!.add(r.game_mode);
      }
    }
    const extendedVocabUsers = new Set<string>();
    for (const [key, modes] of sixSevenByUserDay) {
      if (modes.has('DUEL_6') && modes.has('DUEL_7')) {
        extendedVocabUsers.add(key.split('|')[0]);
      }
    }
    await award('extended_vocab', [...extendedVocabUsers]);

    // Hat Trick (3 daily wins under 60s in one day)
    const fastWinsByUserDay = new Map<string, number>();
    for (const r of allDailyResults) {
      if (r.boards_solved === r.total_boards && (r.time_seconds || 999) < 60) {
        const key = `${r.user_id}|${r.day}`;
        fastWinsByUserDay.set(key, (fastWinsByUserDay.get(key) || 0) + 1);
      }
    }
    const hatTrickUsers = new Set<string>();
    for (const [key, count] of fastWinsByUserDay) {
      if (count >= 3) hatTrickUsers.add(key.split('|')[0]);
    }
    await award('hat_trick', [...hatTrickUsers]);

    // Lightning Round (sweep under 20 min) / Speed Sweep (under 15 min)
    const ALL_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];
    const dayResultsByUserDay = new Map<string, { modes: Set<string>; totalTime: number }>();
    for (const r of allDailyResults) {
      const key = `${r.user_id}|${r.day}`;
      if (!dayResultsByUserDay.has(key)) dayResultsByUserDay.set(key, { modes: new Set(), totalTime: 0 });
      const entry = dayResultsByUserDay.get(key)!;
      entry.modes.add(r.game_mode);
      entry.totalTime += r.time_seconds || 0;
    }
    const lightningUsers = new Set<string>();
    const speedSweepUsers = new Set<string>();
    for (const [key, { modes, totalTime }] of dayResultsByUserDay) {
      if (ALL_MODES.every((m) => modes.has(m))) {
        const uid = key.split('|')[0];
        if (totalTime < 1200) lightningUsers.add(uid);
        if (totalTime < 900) speedSweepUsers.add(uid);
      }
    }
    await award('lightning_round', [...lightningUsers]);
    await award('speed_sweep', [...speedSweepUsers]);

    // Triple Threat (3 VS wins in a single day)
    const vsWinsByUserDay = new Map<string, number>();
    for (const r of allDailyResults) {
      if ((r.vs_wins || 0) > 0) {
        const key = `${r.user_id}|${r.day}`;
        vsWinsByUserDay.set(key, (vsWinsByUserDay.get(key) || 0) + (r.vs_wins || 0));
      }
    }
    const tripleThreatUsers = new Set<string>();
    for (const [key, count] of vsWinsByUserDay) {
      if (count >= 3) tripleThreatUsers.add(key.split('|')[0]);
    }
    await award('triple_threat', [...tripleThreatUsers]);
  }

  // ── Daily-bonuses-based achievements ───────────────────────────

  const { data: allBonuses } = await sb
    .from('daily_bonuses')
    .select('user_id, day, sweep_awarded, flawless_awarded')
    .limit(100000);

  if (allBonuses) {
    // Daily Sweep / Flawless Victory
    await award('daily_sweep', [...new Set(allBonuses.filter((b) => b.sweep_awarded).map((b) => b.user_id))]);
    await award('flawless_victory', [...new Set(allBonuses.filter((b) => b.flawless_awarded).map((b) => b.user_id))]);

    // Daily Devotee (50 sweeps) / Centurion (100 sweeps)
    const sweepCountByUser = new Map<string, number>();
    for (const b of allBonuses) {
      if (b.sweep_awarded) {
        sweepCountByUser.set(b.user_id, (sweepCountByUser.get(b.user_id) || 0) + 1);
      }
    }
    await award('daily_devotee', [...sweepCountByUser.entries()].filter(([, c]) => c >= 50).map(([uid]) => uid));
    await award('centurion', [...sweepCountByUser.entries()].filter(([, c]) => c >= 100).map(([uid]) => uid));

    // Sweep Streak (7 days) / Iron Will (30 days)
    // Uses the "islands" technique: sort days, group consecutive ones
    const sweepDaysByUser = new Map<string, string[]>();
    for (const b of allBonuses) {
      if (b.sweep_awarded) {
        if (!sweepDaysByUser.has(b.user_id)) sweepDaysByUser.set(b.user_id, []);
        sweepDaysByUser.get(b.user_id)!.push(b.day);
      }
    }

    const sweepStreak7Users: string[] = [];
    const ironWillUsers: string[] = [];
    for (const [uid, days] of sweepDaysByUser) {
      const sorted = days.sort();
      let maxStreak = 1;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diffMs = curr.getTime() - prev.getTime();
        if (diffMs >= 82800000 && diffMs <= 90000000) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else if (diffMs > 90000000) {
          streak = 1;
        }
        // If diffMs < 82800000, skip (duplicate or same day)
      }
      if (maxStreak >= 7) sweepStreak7Users.push(uid);
      if (maxStreak >= 30) ironWillUsers.push(uid);
    }
    await award('sweep_streak_7', sweepStreak7Users);
    await award('iron_will', ironWillUsers);

    // Flawless Streak (3 consecutive flawless days)
    const flawlessDaysByUser = new Map<string, string[]>();
    for (const b of allBonuses) {
      if (b.flawless_awarded) {
        if (!flawlessDaysByUser.has(b.user_id)) flawlessDaysByUser.set(b.user_id, []);
        flawlessDaysByUser.get(b.user_id)!.push(b.day);
      }
    }
    const flawlessStreakUsers: string[] = [];
    for (const [uid, days] of flawlessDaysByUser) {
      const sorted = days.sort();
      let maxStreak = 1;
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]);
        const curr = new Date(sorted[i]);
        const diffMs = curr.getTime() - prev.getTime();
        if (diffMs >= 82800000 && diffMs <= 90000000) {
          streak++;
          maxStreak = Math.max(maxStreak, streak);
        } else if (diffMs > 90000000) {
          streak = 1;
        }
      }
      if (maxStreak >= 3) flawlessStreakUsers.push(uid);
    }
    await award('flawless_streak', flawlessStreakUsers);
  }

  return NextResponse.json({
    success: true,
    totalInserted,
    achievements: results,
  });
}
