import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Operational health: webhook ledger, anti-cheat watchlist, VS match health,
// and cron heartbeats.
//
// Anti-cheat thresholds come from guard_precision.sql (manual-migration
// 20260723000003): the DB clamps are deliberately loose (solo composite ≤
// 10,000 vs a legit V2 max of 3,072; vs ≤ 120,000 vs a real max of 105,050),
// so a row can pass the clamp and still be impossible. This view flags the
// gap the clamps leave open.
const SOLO_LEGIT_MAX = 3072;
const VS_LEGIT_MAX = 105050;

// Expected cadence per cron (vercel.json): expire-pro hourly, the others daily.
const CRON_SCHEDULE: Record<string, { label: string; maxAgeHours: number }> = {
  'expire-pro': { label: 'Pro expiry sweep (hourly)', maxAgeHours: 2 },
  'daily-medals': { label: 'Daily medals (12:05 UTC)', maxAgeHours: 26 },
  'daily-reminder': { label: 'Daily reminder push (14:00 UTC)', maxAgeHours: 26 },
};

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = Date.now();
  const since14 = new Date(now - 14 * 86400000).toISOString();
  const since30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

  const [webhooksRes, suspectsRes, matchesRes, heartbeatsRes] = await Promise.all([
    admin.from('store_webhook_events').select('event_id, source, processed_at').order('processed_at', { ascending: false }).limit(50),
    admin
      .from('daily_results')
      .select('user_id, day, game_mode, play_type, composite_score, guess_count, total_boards, time_seconds, vs_games, profiles(username)')
      .gte('day', since30)
      .or(
        `and(play_type.eq.solo,composite_score.gt.${SOLO_LEGIT_MAX}),` +
        `and(play_type.eq.vs,composite_score.gt.${VS_LEGIT_MAX}),` +
        'guess_count.gte.200,total_boards.gte.21,time_seconds.gte.172800,vs_games.gte.1000',
      )
      .order('composite_score', { ascending: false })
      .limit(50),
    admin.from('matches').select('created_at, started_at, completed_at, forfeit, player1_id, player2_id, winner_id').gte('created_at', since14),
    admin.from('system_heartbeats').select('*'),
  ]);

  // Webhook activity by day/source (the ledger records successes only —
  // a FAILED webhook never lands here, so the signal is silence, not errors).
  const webhookByDay = new Map<string, { appstore: number; playstore: number }>();
  for (const e of webhooksRes.data ?? []) {
    const d = String(e.processed_at).slice(0, 10);
    if (!webhookByDay.has(d)) webhookByDay.set(d, { appstore: 0, playstore: 0 });
    const c = webhookByDay.get(d)!;
    if (e.source === 'appstore') c.appstore++;
    else c.playstore++;
  }

  // Anti-cheat: annotate why each row was flagged, then drop rows whose only
  // "reason" turns out to be legitimate.
  //
  // GAUNTLET legitimately totals 21 boards (1+4+8+4+4 across its five stages),
  // which is exactly the clamp ceiling — so a blanket total_boards>=21 rule
  // flags every honest Gauntlet run. The first live look at this page was
  // nothing but Gauntlet false positives. A watchlist that cries wolf gets
  // ignored, which is worse than not having one, so the board ceiling only
  // applies to non-Gauntlet modes (max there is Octordle's 8).
  const suspects = (suspectsRes.data ?? [])
    .map((r) => {
      const reasons: string[] = [];
      if (r.play_type === 'solo' && r.composite_score > SOLO_LEGIT_MAX) reasons.push(`score ${r.composite_score} > legit solo max ${SOLO_LEGIT_MAX}`);
      if (r.play_type === 'vs' && r.composite_score > VS_LEGIT_MAX) reasons.push(`score ${r.composite_score} > legit vs max ${VS_LEGIT_MAX}`);
      if (r.guess_count >= 200) reasons.push('guess_count at clamp ceiling');
      if (r.game_mode !== 'GAUNTLET' && r.total_boards > 8) reasons.push(`total_boards ${r.total_boards} exceeds the 8 of Octordle, the widest non-Gauntlet mode`);
      if (r.time_seconds >= 172800) reasons.push('time at 48h clamp (real value unknowable)');
      if ((r.vs_games ?? 0) >= 1000) reasons.push('vs_games at clamp ceiling');
      return {
        userId: r.user_id,
        username: (r as { profiles?: { username?: string } }).profiles?.username ?? r.user_id,
        day: String(r.day).slice(0, 10),
        mode: r.game_mode,
        playType: r.play_type,
        score: r.composite_score,
        reasons,
      };
    })
    .filter((s) => s.reasons.length > 0);

  // VS health from human matches (CPU games write user_stats only — they never
  // create a matches row, so bot fill is invisible here by design).
  const matches = matchesRes.data ?? [];
  const completed = matches.filter((m) => m.completed_at);
  const durations = completed
    .map((m) => (new Date(m.completed_at!).getTime() - new Date(m.started_at).getTime()) / 1000)
    .filter((s) => s > 0 && s < 3600);
  const vsHealth = {
    matches14d: matches.length,
    completed14d: completed.length,
    forfeits14d: matches.filter((m) => m.forfeit).length,
    abandonRate: matches.length ? Math.round((1000 * (matches.length - completed.length)) / matches.length) / 10 : 0,
    avgDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
    distinctPlayers: new Set(matches.flatMap((m) => [m.player1_id, m.player2_id].filter(Boolean))).size,
  };

  // Cron heartbeats vs expected cadence. Table may predate the migration —
  // report 'not instrumented' rather than erroring.
  const beats = heartbeatsRes.data ?? [];
  const crons = Object.entries(CRON_SCHEDULE).map(([job, cfg]) => {
    const beat = beats.find((b) => b.job === job);
    if (!beat) return { job, label: cfg.label, status: 'never', lastRun: null, ok: null, detail: heartbeatsRes.error ? 'migration not applied' : 'no run recorded yet' };
    const ageHours = (now - new Date(beat.last_run_at).getTime()) / 3600000;
    return {
      job,
      label: cfg.label,
      status: !beat.ok ? 'failed' : ageHours > cfg.maxAgeHours ? 'stale' : 'healthy',
      lastRun: beat.last_run_at,
      ok: beat.ok,
      detail: beat.detail,
    };
  });

  return NextResponse.json({
    webhooks: {
      recent: (webhooksRes.data ?? []).slice(0, 20),
      byDay: [...webhookByDay.entries()].map(([day, c]) => ({ day, ...c })).sort((a, b) => (a.day < b.day ? 1 : -1)),
    },
    suspects,
    vsHealth,
    crons,
  });
}
