import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Operational health: anti-cheat watchlist and cron heartbeats. (VS match health moved to
// /api/admin/vs, Games > VS & Bots.)
// (The store webhook ledger moved to /api/admin/store-feed, Pro & Gifts > Store feed.)
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
  'friends-recap': { label: 'Friends weekly recap (Mon 13:00 UTC)', maxAgeHours: 7 * 24 + 2 },
  'social-publish': { label: 'Social Studio publisher (every 15 min)', maxAgeHours: 1 },
  'purge-under13': { label: 'Under-13 account purge (13:30 UTC)', maxAgeHours: 26 },
  integrity: { label: 'Data integrity sweep (11:30 UTC)', maxAgeHours: 26 },
};

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = Date.now();
  const since30 = new Date(now - 30 * 86400000).toISOString().slice(0, 10);

  const [suspectsRes, heartbeatsRes] = await Promise.all([
    admin
      .from('daily_results')
      .select('user_id, day, game_mode, play_type, composite_score, guess_count, total_boards, time_seconds, vs_games, profiles(username)')
      .gte('day', since30)
      .or(
        `and(play_type.eq.solo,composite_score.gt.${SOLO_LEGIT_MAX}),` +
        `and(play_type.eq.vs,composite_score.gt.${VS_LEGIT_MAX}),` +
        'guess_count.gte.200,total_boards.gte.22,time_seconds.gte.172800,vs_games.gte.1000', // §260: Gauntlet is 21 boards — 21 was flagging every Gauntlet run
      )
      .order('composite_score', { ascending: false })
      .limit(50),
    admin.from('system_heartbeats').select('*'),
  ]);

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
    suspects,
    crons,
  });
}
