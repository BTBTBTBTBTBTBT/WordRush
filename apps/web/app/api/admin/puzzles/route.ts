import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Puzzle analytics: per-day per-mode difficulty (win rate, avg guesses), mode
// popularity, sweep/flawless rates, and the streak/shield economy — all
// derived from daily_results + profiles, which have collected this since
// launch with no eyes on them.
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = new Date();
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days')) || 14, 7), 60);
  const since = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);

  const [resultsRes, profilesRes] = await Promise.all([
    admin
      .from('daily_results')
      .select('day, game_mode, play_type, completed, guess_count, boards_solved, total_boards')
      .gte('day', since),
    admin.from('profiles').select('daily_login_streak, best_daily_login_streak, streak_shields, is_pro'),
  ]);
  const results = resultsRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  // Per-day per-mode difficulty (solo dailies only — VS rows measure matchups,
  // not puzzle difficulty).
  const byDayMode = new Map<string, { plays: number; wins: number; guesses: number; boards: number; boardsTotal: number }>();
  for (const r of results) {
    if (r.play_type !== 'solo') continue;
    const key = `${String(r.day).slice(0, 10)}|${r.game_mode}`;
    if (!byDayMode.has(key)) byDayMode.set(key, { plays: 0, wins: 0, guesses: 0, boards: 0, boardsTotal: 0 });
    const c = byDayMode.get(key)!;
    c.plays++;
    if (r.completed) { c.wins++; c.guesses += r.guess_count; }
    c.boards += r.boards_solved;
    c.boardsTotal += r.total_boards;
  }
  const difficulty = [...byDayMode.entries()]
    .map(([key, c]) => {
      const [day, mode] = key.split('|');
      return {
        day,
        mode,
        plays: c.plays,
        winRate: c.plays ? Math.round((1000 * c.wins) / c.plays) / 10 : 0,
        avgGuesses: c.wins ? Math.round((10 * c.guesses) / c.wins) / 10 : 0,
        boardRate: c.boardsTotal ? Math.round((1000 * c.boards) / c.boardsTotal) / 10 : 0,
      };
    })
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.mode.localeCompare(b.mode)));

  // Mode popularity across the window.
  const byMode = new Map<string, { plays: number; wins: number; vsPlays: number }>();
  for (const r of results) {
    if (!byMode.has(r.game_mode)) byMode.set(r.game_mode, { plays: 0, wins: 0, vsPlays: 0 });
    const c = byMode.get(r.game_mode)!;
    if (r.play_type === 'solo') { c.plays++; if (r.completed) c.wins++; }
    else c.vsPlays++;
  }
  const popularity = [...byMode.entries()]
    .map(([mode, c]) => ({
      mode,
      plays: c.plays,
      vsPlays: c.vsPlays,
      winRate: c.plays ? Math.round((1000 * c.wins) / c.plays) / 10 : 0,
    }))
    .sort((a, b) => b.plays - a.plays);

  // Sweep days: players completing every mode in one local day (a proxy from
  // rows — the true sweep leaderboard has its own RPCs; this is trend-level).
  const modesSeen = new Set(results.filter((r) => r.play_type === 'solo').map((r) => r.game_mode));
  const totalModes = modesSeen.size || 1;

  // Streak/shield economy.
  const streaks = profiles.map((p) => p.daily_login_streak ?? 0);
  const buckets = [
    { label: '0', min: 0, max: 0 },
    { label: '1-2', min: 1, max: 2 },
    { label: '3-6', min: 3, max: 6 },
    { label: '7-13', min: 7, max: 13 },
    { label: '14-29', min: 14, max: 29 },
    { label: '30+', min: 30, max: Infinity },
  ].map((b) => ({ label: b.label, count: streaks.filter((s) => s >= b.min && s <= b.max).length }));

  const streakEconomy = {
    distribution: buckets,
    longestActive: Math.max(0, ...streaks),
    bestEver: Math.max(0, ...profiles.map((p) => p.best_daily_login_streak ?? 0)),
    shieldsHeld: profiles.reduce((a, p) => a + (p.streak_shields ?? 0), 0),
    shieldHolders: profiles.filter((p) => (p.streak_shields ?? 0) > 0).length,
    proHolders: profiles.filter((p) => p.is_pro).length,
  };

  return NextResponse.json({ days, totalModes, difficulty, popularity, streakEconomy });
}
