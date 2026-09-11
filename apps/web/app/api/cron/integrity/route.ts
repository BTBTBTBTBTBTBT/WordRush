import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { stampHeartbeat } from '@/lib/heartbeat';
import { sweepAll } from '@/lib/supabase-sweep';
import { wordOfDay, dateKey } from '@/lib/word-of-day';
import { isCircular, isStub } from '@/lib/sense-rank';
import { isPlausibleDailyResult, MAX_TIME_SECONDS } from '@/lib/plausibility';

/**
 * §260: the nightly data-integrity sweep. Every check here is a bug class
 * that reached a player before anyone noticed:
 *
 *   - the friends race lost whole users to PostgREST's silent 1,000-row cap
 *     (§257) → every paged sweep is compared with an exact count;
 *   - "Play again" recorded 0/6 wins for a while (§255) → zero-guess wins;
 *   - a 3-second Seven record sat in all_time_records (§255) → implausible
 *     times, in both daily_results and the records table;
 *   - NASTY's Word of the Day read "Something nasty." (§259) → the next
 *     seven days' words must lead with a real definition.
 *
 * Findings land in system_heartbeats as job 'integrity' (ok=false with the
 * list) so the admin Ops page shows them beside the other crons. Vercel
 * triggers it daily; run by hand with the CRON_SECRET bearer token.
 */
export const maxDuration = 60;
export const runtime = 'nodejs';

const WINDOW_DAYS = 90;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const admin = getAdminSupabase();
  const findings: string[] = [];
  const checked: string[] = [];
  const today = new Date();
  const todayKey = dateKey(today);
  const since = new Date(today.getTime() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const week = new Date(today.getTime() - 7 * 86400000).toISOString().slice(0, 10);

  // 1. Paged sweeps must see every row an exact count reports (§257 guard).
  for (const table of ['daily_results', 'matches'] as const) {
    const col = table === 'daily_results' ? 'day' : 'created_at';
    const lower = table === 'daily_results' ? since : `${since}T00:00:00Z`;
    const { count } = await admin.from(table).select('id', { count: 'exact', head: true }).gte(col, lower);
    const rows = await sweepAll<{ id: string }>((f, t) => admin.from(table).select('id').gte(col, lower).order('id').range(f, t));
    checked.push(`${table}: ${rows.length}/${count ?? '?'} rows in ${WINDOW_DAYS}d`);
    if (count != null && rows.length !== count) findings.push(`${table}: paged sweep saw ${rows.length} of ${count} rows`);
  }

  // 2. Impossible daily results in the last 7 days (zero-guess wins,
  //    implausible times, runaway values).
  {
    const rows = await sweepAll<{ id: string; user_id: string; game_mode: string; day: string; completed: boolean; guess_count: number; time_seconds: number; total_boards: number }>((f, t) =>
      admin.from('daily_results').select('id, user_id, game_mode, day, completed, guess_count, time_seconds, total_boards').eq('play_type', 'solo').gte('day', week).order('id').range(f, t));
    const bad = rows.filter((r) => !isPlausibleDailyResult(r.completed, r.guess_count, r.time_seconds, r.total_boards));
    checked.push(`daily_results (7d): ${rows.length} rows, ${bad.length} implausible`);
    for (const r of bad.slice(0, 10)) findings.push(`implausible daily_result ${r.game_mode} ${r.day} user ${r.user_id.slice(0, 8)}: completed=${r.completed} guesses=${r.guess_count} time=${r.time_seconds}s boards=${r.total_boards}`);
    if (bad.length > 10) findings.push(`…and ${bad.length - 10} more implausible daily_results`);
  }

  // 3. Records that no human could set.
  {
    const { data } = await admin.from('all_time_records').select('record_type, game_mode, record_value, holder_id');
    const bad = (data ?? []).filter((r: any) =>
      (r.record_type === 'fastest_win' && (r.record_value < 1 || r.record_value >= MAX_TIME_SECONDS)) ||
      (r.record_type === 'fewest_guesses' && r.record_value < 1));
    checked.push(`all_time_records: ${(data ?? []).length} rows, ${bad.length} implausible`);
    for (const r of bad) findings.push(`implausible record ${r.record_type} ${r.game_mode ?? 'global'} = ${r.record_value} (holder ${String(r.holder_id).slice(0, 8)})`);
  }

  // 4. The next seven Words of the Day lead with a real definition.
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const e = await wordOfDay(d);
    const def = e.definition ?? '';
    if (!def) findings.push(`WOTD ${dateKey(d)} ${e.word}: no definition`);
    else if (isCircular(e.word, def)) findings.push(`WOTD ${dateKey(d)} ${e.word}: circular definition "${def.slice(0, 60)}"`);
    else if (isStub(def)) findings.push(`WOTD ${dateKey(d)} ${e.word}: stub definition "${def.slice(0, 60)}"`);
  }
  checked.push('WOTD: next 7 days');

  // 5. Today's puzzles were actually recorded — a day with players and zero
  //    solo results means the write path is down, not that nobody played.
  {
    const { count: todayCount } = await admin.from('daily_results').select('id', { count: 'exact', head: true }).eq('day', todayKey);
    const { count: yesterdayCount } = await admin.from('daily_results').select('id', { count: 'exact', head: true }).eq('day', dateKey(new Date(today.getTime() - 86400000)));
    checked.push(`results today ${todayCount ?? 0}, yesterday ${yesterdayCount ?? 0}`);
    if ((yesterdayCount ?? 0) === 0) findings.push('no daily_results recorded yesterday — write path or clients may be failing');
  }

  const ok = findings.length === 0;
  const detail = ok ? `clean — ${checked.join('; ')}` : `${findings.length} finding${findings.length === 1 ? '' : 's'}: ${findings.join(' | ')}`;
  await stampHeartbeat('integrity', ok, detail.slice(0, 2000));
  return NextResponse.json({ ok, findings, checked });
}
