import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';
import { DAILY_MODES, requiredDailyModeCount } from '@/lib/daily-modes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Award the daily Sweep / Flawless bonus — SERVER SIDE.
 *
 * Why this exists: `daily_bonuses` is client-writable (RLS `auth.uid() =
 * user_id`) and `alltime_sweep_leaderboard` ranks players by counting rows
 * there with `sweep_awarded = true`. Any signed-in user could therefore POST
 * bonus rows for a few hundred dates they never played and own the all-time
 * sweep board outright. The flag has to be granted by something the client
 * can't lie to — the same principle that already protects Pro entitlement.
 *
 * The client sends only its access token; the day and every fact behind the
 * award are recomputed here from `daily_results`.
 *
 * NOTE ON THE MODE COUNT: the required number of dailies comes from the dated
 * era table in lib/daily-modes.ts (7 before 2026-05-21, 9 on/after) — shared
 * with the backfill route so live awards and reconstructions agree. It is NOT
 * inferred from that day's recorded results: the old "what did anyone record
 * today" probe let the first player of a local day sweep after ONE game
 * (1 >= 1), and was additionally subject to PostgREST's 1000-row default cap.
 */

const DAILY_SWEEP_XP = 200;
const FLAWLESS_EXTRA_XP = 400;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // The day comes from the client because "today" is the player's LOCAL date
    // (a UTC server day would rob or gift a day at the edges). It's only used
    // to scope the lookup — it can't manufacture an award, since the results
    // for that day still have to exist and be complete.
    const { day } = await req.json().catch(() => ({ day: undefined }));
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return NextResponse.json({ error: 'Invalid day' }, { status: 400 });
    }
    // A future day can't have been played; don't let one be pre-claimed.
    const todayUtc = new Date().toISOString().slice(0, 10);
    const tomorrowUtc = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (day > tomorrowUtc) {
      return NextResponse.json({ error: 'Day is in the future' }, { status: 400 });
    }

    const userId = user.id;
    const admin = getAdminSupabase();

    const { data: existing } = await admin
      .from('daily_bonuses')
      .select('sweep_awarded, flawless_awarded')
      .eq('user_id', userId)
      .eq('day', day)
      .maybeSingle();

    const sweepAlready = existing?.sweep_awarded ?? false;
    const flawlessAlready = existing?.flawless_awarded ?? false;
    if (sweepAlready && flawlessAlready) {
      return NextResponse.json({ awarded: false, reason: 'already_awarded' });
    }

    // The authoritative facts: what did this user actually record that day?
    const { data: results } = await admin
      .from('daily_results')
      .select('game_mode, completed')
      .eq('user_id', userId)
      .eq('day', day)
      .eq('play_type', 'solo')
      .in('game_mode', DAILY_MODES);

    const played = new Set((results ?? []).map((r: any) => r.game_mode));
    const won = new Set((results ?? []).filter((r: any) => r.completed).map((r: any) => r.game_mode));

    // The full mode count for this day's era — a sweep means the player's OWN
    // distinct daily modes reach it; flawless means all of them were won.
    const required = requiredDailyModeCount(day);

    if (played.size < required) {
      return NextResponse.json({ awarded: false, reason: 'incomplete', played: played.size, required });
    }

    const sweepNew = !sweepAlready;
    const flawlessNew = won.size >= required && !flawlessAlready;
    let xpBonus = 0;
    if (sweepNew) xpBonus += DAILY_SWEEP_XP;
    if (flawlessNew) xpBonus += FLAWLESS_EXTRA_XP;
    if (xpBonus === 0) return NextResponse.json({ awarded: false, reason: 'nothing_new' });

    await admin.from('daily_bonuses').upsert(
      {
        user_id: userId,
        day,
        sweep_awarded: sweepAlready || sweepNew,
        flawless_awarded: flawlessAlready || flawlessNew,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    );

    const { data: profile } = await admin
      .from('profiles').select('xp').eq('id', userId).maybeSingle();
    if (profile) {
      const newXp = (profile.xp ?? 0) + xpBonus;
      await admin.from('profiles')
        .update({ xp: newXp, level: Math.floor(newXp / 1000) + 1 })
        .eq('id', userId);
    }

    return NextResponse.json({
      awarded: true,
      sweepAwarded: sweepNew,
      flawlessAwarded: flawlessNew,
      xpBonus,
    });
  } catch (error: any) {
    console.error('[award-bonuses]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
