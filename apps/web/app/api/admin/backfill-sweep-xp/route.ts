import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';

/**
 * POST /api/admin/backfill-sweep-xp
 *
 * Grants the +200 (Daily Sweep) / +400 (Flawless Victory) bonus XP for
 * historical sweep days that were reconstructed by /api/admin/backfill-daily-bonuses
 * but never paid out (their XP was only ever granted live, the day the 9th daily
 * finished — days completed before that logic shipped got the flag via backfill
 * but no XP).
 *
 * SAFETY: grants ONLY for `daily_bonuses` rows whose `created_at >= sinceIso`.
 * Those are exactly the rows the flag-backfill just inserted — i.e. days that
 * had NO bonus row before, so they were provably never paid live. Live-awarded
 * rows (created the day they were earned) are older than the cutoff and skipped,
 * so this never double-credits. Pass the timestamp from just BEFORE you ran the
 * flag backfill as `sinceIso`. Set `dryRun: true` to preview without writing.
 *
 * Auth: Bearer $CRON_SECRET. Body: { sinceIso: string, dryRun?: boolean, userId?: string }
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { sinceIso?: string; dryRun?: boolean; userId?: string } = {};
  try { body = await req.json(); } catch { /* require sinceIso below */ }
  if (!body.sinceIso) {
    return NextResponse.json({ error: 'sinceIso required (ISO timestamp from just before the flag backfill ran)' }, { status: 400 });
  }
  const dryRun = body.dryRun === true;
  const sb = getAdminSupabase();

  // Freshly-reconstructed bonus rows = never paid live.
  let q = sb
    .from('daily_bonuses')
    .select('user_id, day, sweep_awarded, flawless_awarded, created_at')
    .gte('created_at', body.sinceIso)
    .limit(100000);
  if (body.userId) q = q.eq('user_id', body.userId);
  const { data: rows, error } = await q as {
    data: Array<{ user_id: string; day: string; sweep_awarded: boolean; flawless_awarded: boolean; created_at: string }> | null;
    error: any;
  };
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sum the owed bonus XP per user.
  const xpByUser = new Map<string, number>();
  for (const r of rows || []) {
    const owed = (r.sweep_awarded ? 200 : 0) + (r.flawless_awarded ? 400 : 0);
    if (owed > 0) xpByUser.set(r.user_id, (xpByUser.get(r.user_id) || 0) + owed);
  }

  const perUser: Array<{ userId: string; xpAdded: number; oldXp: number; newXp: number; newLevel: number }> = [];
  let totalXp = 0;
  for (const [userId, xpAdd] of xpByUser) {
    const { data: prof } = await sb.from('profiles').select('xp, level').eq('id', userId).single() as {
      data: { xp: number | null; level: number | null } | null;
    };
    const oldXp = prof?.xp ?? 0;
    const newXp = oldXp + xpAdd;
    const newLevel = Math.floor(newXp / 1000) + 1;
    perUser.push({ userId, xpAdded: xpAdd, oldXp, newXp, newLevel });
    totalXp += xpAdd;
    if (!dryRun) {
      await sb.from('profiles').update({ xp: newXp, level: newLevel }).eq('id', userId);
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    sinceIso: body.sinceIso,
    rowsConsidered: rows?.length ?? 0,
    usersAffected: perUser.length,
    totalXpGranted: totalXp,
    perUser,
  });
}
