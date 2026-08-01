import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Player persona for the public profile — the aggregates that CANNOT be
// computed client-side because their raw rows live behind the matches
// participants-only policy (guess arrays are private), plus a couple that
// need cross-player scans no client should run. Server aggregates only;
// no raw guesses leave here.
//
//   archetype        — from daily_results (rule set documented inline; the
//                      SAME labels render on all three platforms, so this is
//                      the single source — never re-derive client-side)
//   opener           — most frequent first REAL guess word across solo matches
//   longestWinStreak — max consecutive solo wins
//   bestPercentile   — best "top N%" standing across modes (user_stats)
//   nemesis          — other player sharing the most (day, mode) dailies
//   flawless         — target's flawless-day count + share of players with one
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const admin = getAdminSupabase();

  // ── matches-derived: opener + win streak (solo only, newest 1000) ────────
  const { data: mrows } = await admin
    .from('matches')
    .select('player1_guesses, winner_id, created_at')
    .eq('player1_id', id)
    .is('player2_id', null)
    .not('player1_guesses', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  const openerCounts = new Map<string, { count: number; wins: number }>();
  for (const r of mrows ?? []) {
    const first = (r.player1_guesses as string[]).find((w) => /^[A-Z]+$/i.test(String(w)));
    if (!first) continue;
    const w = String(first).toUpperCase();
    const e = openerCounts.get(w) ?? { count: 0, wins: 0 };
    e.count++;
    if (r.winner_id === id) e.wins++;
    openerCounts.set(w, e);
  }
  const opener = [...openerCounts.entries()]
    .map(([word, s]) => ({ word, count: s.count, winRate: s.count ? Math.round((s.wins / s.count) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)[0] ?? null;

  let longestWinStreak = 0;
  {
    let run = 0;
    // oldest → newest so the streak reads chronologically
    for (const r of [...(mrows ?? [])].reverse()) {
      run = r.winner_id === id ? run + 1 : 0;
      if (run > longestWinStreak) longestWinStreak = run;
    }
  }

  // ── daily_results-derived: archetype (newest 500 completed) ──────────────
  const { data: drows } = await admin
    .from('daily_results')
    .select('day, game_mode, guess_count, time_seconds, total_boards, completed, created_at')
    .eq('user_id', id)
    .eq('play_type', 'solo')
    .order('created_at', { ascending: false })
    .limit(500);

  const done = (drows ?? []).filter((r) => r.completed);
  const byDay = new Map<string, number>();
  for (const r of done) byDay.set(r.day, (byDay.get(r.day) ?? 0) + 1);
  const sweepDays = [...byDay.values()].filter((n) => n >= 9).length;
  const times = done.map((r) => r.time_seconds).filter((t) => t > 0);
  const avgTime = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const singles = done.filter((r) => r.total_boards === 1 && r.guess_count > 0);
  const avgGuess = singles.length
    ? singles.reduce((a, r) => a + r.guess_count, 0) / singles.length
    : 0;
  // "Night" is measured in UTC (created_at has no timezone context); the
  // 03:00–09:00 UTC band ≈ US late night. Approximate by design, and the
  // archetype card's explainer says so.
  const nightPlays = done.filter((r) => {
    const h = new Date(r.created_at).getUTCHours();
    return h >= 3 && h < 9;
  }).length;
  const nightPct = done.length ? nightPlays / done.length : 0;

  // Priority order is part of the contract: a Grinder who is also fast is a
  // GRINDER — sweeping all nine every day is the rarer, more telling habit.
  let archetype = 'CHALLENGER';
  if (sweepDays >= 3) archetype = 'GRINDER';
  else if (times.length >= 10 && avgTime <= 90) archetype = 'SPEEDRUNNER';
  else if (singles.length >= 10 && avgGuess <= 3.6) archetype = 'SNIPER';
  else if (done.length >= 10 && nightPct >= 0.4) archetype = 'NIGHT_OWL';

  // ── user_stats-derived: best percentile across modes (≥5 games) ──────────
  const { data: myStats } = await admin
    .from('user_stats')
    .select('game_mode, best_score, wins, losses')
    .eq('user_id', id)
    .eq('play_type', 'solo');
  let bestPercentile: { mode: string; topPct: number } | null = null;
  for (const s of myStats ?? []) {
    if ((s.wins ?? 0) + (s.losses ?? 0) < 5 || !(s.best_score > 0)) continue;
    const [{ count: better }, { count: total }] = await Promise.all([
      admin.from('user_stats').select('user_id', { count: 'exact', head: true })
        .eq('game_mode', s.game_mode).eq('play_type', 'solo').gt('best_score', s.best_score),
      admin.from('user_stats').select('user_id', { count: 'exact', head: true })
        .eq('game_mode', s.game_mode).eq('play_type', 'solo').gt('best_score', 0),
    ]);
    if (!total) continue;
    const topPct = Math.max(1, Math.ceil((((better ?? 0) + 1) / total) * 100));
    if (!bestPercentile || topPct < bestPercentile.topPct) bestPercentile = { mode: s.game_mode, topPct };
  }

  // ── nemesis: most shared (day, mode) boards with any other player ────────
  // Capped scan (400 recent days-of-play × 4000 candidate rows) — fine at
  // current scale; the cap is declared here so a future silent truncation
  // is a known trade, not a surprise.
  let nemesis: { userId: string; username: string; sharedBoards: number } | null = null;
  const myPairs = new Set(done.slice(0, 400).map((r) => `${r.day}|${r.game_mode}`));
  const myDays = [...new Set(done.slice(0, 400).map((r) => r.day))];
  if (myDays.length) {
    const { data: others } = await admin
      .from('daily_results')
      .select('user_id, day, game_mode')
      .in('day', myDays.slice(0, 60))
      .neq('user_id', id)
      .eq('play_type', 'solo')
      .limit(4000);
    const shared = new Map<string, number>();
    for (const o of others ?? []) {
      if (myPairs.has(`${o.day}|${o.game_mode}`)) shared.set(o.user_id, (shared.get(o.user_id) ?? 0) + 1);
    }
    const top = [...shared.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) {
      const { data: prof } = await admin.from('profiles').select('username').eq('id', top[0]).single();
      if (prof?.username) nemesis = { userId: top[0], username: prof.username, sharedBoards: top[1] };
    }
  }

  // ── flawless rarity: days where a player completed all 9 ─────────────────
  // Same declared-cap stance: newest 10k solo daily rows.
  const { data: sweepRows } = await admin
    .from('daily_results')
    .select('user_id, day, completed')
    .eq('play_type', 'solo')
    .eq('completed', true)
    .order('created_at', { ascending: false })
    .limit(10000);
  const perUserDay = new Map<string, number>();
  for (const r of sweepRows ?? []) {
    const k = `${r.user_id}|${r.day}`;
    perUserDay.set(k, (perUserDay.get(k) ?? 0) + 1);
  }
  const holders = new Set<string>();
  let myFlawless = 0;
  for (const [k, n] of perUserDay) {
    if (n >= 9) {
      const uid = k.split('|')[0];
      holders.add(uid);
      if (uid === id) myFlawless++;
    }
  }
  const allPlayers = new Set((sweepRows ?? []).map((r) => r.user_id)).size;
  const flawless = {
    count: myFlawless,
    pctOfPlayers: allPlayers ? Math.max(1, Math.round((holders.size / allPlayers) * 100)) : 0,
  };

  return NextResponse.json(
    { archetype, opener, longestWinStreak, bestPercentile, nemesis, flawless },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
  );
}
