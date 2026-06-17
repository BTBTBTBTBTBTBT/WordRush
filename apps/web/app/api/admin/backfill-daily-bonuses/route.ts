import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * POST /api/admin/backfill-daily-bonuses
 *
 * Reconstructs the `daily_bonuses` table from historical `daily_results`.
 * `daily_bonuses` rows are normally written live the moment a player finishes
 * the 9th daily of a day — so full-sweep days completed BEFORE that award logic
 * shipped (or on clients where it never ran) have no bonus row, and the profile
 * Daily-Sweeps card / points chart / sweep achievements don't count them.
 *
 * This scans every solo daily_results row, groups by (user, day), and for each
 * day where all 9 daily modes are present marks sweep_awarded; where all 9 were
 * WON marks flawless_awarded. It UPSERTS the flag rows only — it does NOT grant
 * retroactive XP (that's the live award helper's job), so re-running is safe and
 * never double-credits. Existing `true` flags are never downgraded.
 *
 * Auth: Bearer $CRON_SECRET. Optional body { userId } to scope to one user.
 */

const DAILY_MODES = ['DUEL', 'QUORDLE', 'OCTORDLE', 'SEQUENCE', 'RESCUE', 'DUEL_6', 'DUEL_7', 'GAUNTLET', 'PROPERNOUNDLE'];

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();
  let scopeUserId: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.userId === 'string') scopeUserId = body.userId;
  } catch {
    // no body → all users
  }

  // Pull solo daily results (the only play_type that counts toward a sweep).
  let q = sb
    .from('daily_results')
    .select('user_id, day, game_mode, completed')
    .eq('play_type', 'solo')
    .limit(200000);
  if (scopeUserId) q = q.eq('user_id', scopeUserId);
  const { data: rows, error } = await q as {
    data: Array<{ user_id: string; day: string; game_mode: string; completed: boolean }> | null;
    error: any;
  };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ success: true, swept: 0, flawless: 0, rows: 0 });

  // Group by user|day → which daily modes are present, and whether each was won.
  const byUserDay = new Map<string, { modes: Set<string>; wonModes: Set<string> }>();
  for (const r of rows) {
    if (!DAILY_MODES.includes(r.game_mode)) continue;
    const key = `${r.user_id}|${r.day}`;
    let entry = byUserDay.get(key);
    if (!entry) { entry = { modes: new Set(), wonModes: new Set() }; byUserDay.set(key, entry); }
    entry.modes.add(r.game_mode);
    if (r.completed) entry.wonModes.add(r.game_mode);
  }

  // A day with all 9 modes present = sweep; all 9 won = flawless.
  const upserts: Array<{ user_id: string; day: string; sweep_awarded: boolean; flawless_awarded: boolean }> = [];
  let sweepCount = 0, flawlessCount = 0;
  for (const [key, { modes, wonModes }] of byUserDay) {
    const swept = DAILY_MODES.every((m) => modes.has(m));
    if (!swept) continue;
    const flawless = DAILY_MODES.every((m) => wonModes.has(m));
    const [user_id, day] = key.split('|');
    upserts.push({ user_id, day, sweep_awarded: true, flawless_awarded: flawless });
    sweepCount += 1;
    if (flawless) flawlessCount += 1;
  }

  // Upsert in chunks on (user_id, day). ignoreDuplicates:false so an existing
  // sweep-only row gets flawless_awarded flipped true when it now qualifies;
  // sweep_awarded is always true here so it never downgrades.
  let written = 0;
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500).map((u) => ({ ...u, updated_at: new Date().toISOString() }));
    const { error: upErr } = await sb
      .from('daily_bonuses')
      .upsert(chunk, { onConflict: 'user_id,day', ignoreDuplicates: false });
    if (upErr) return NextResponse.json({ error: upErr.message, writtenSoFar: written }, { status: 500 });
    written += chunk.length;
  }

  return NextResponse.json({
    success: true,
    scope: scopeUserId ?? 'all-users',
    daysScanned: byUserDay.size,
    sweptDays: sweepCount,
    flawlessDays: flawlessCount,
    rowsUpserted: written,
  });
}
