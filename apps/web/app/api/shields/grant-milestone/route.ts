import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A shield every 7 consecutive days played. */
const MILESTONE_EVERY = 7;
/** Sanity cap on one call, so a long backfill can't mint a pile at once. */
const MAX_GRANT_PER_CALL = 4;

/**
 * Grant the 7-day-streak shield — SERVER SIDE.
 *
 * streak_shields is a paid benefit (+4 on every Pro renewal) and a referral
 * reward, but nothing stopped a client from PATCHing profiles and setting it to
 * whatever it liked: protect_pro_columns pins medals, is_admin, is_banned,
 * is_pro and pro_expires_at — shields were never on the list.
 *
 * Two things make this trustworthy:
 *  1. The streak is recomputed from daily_results (actual days played), NOT
 *     from profiles.daily_login_streak — that column is itself client-written,
 *     so trusting it would just move the forgery one step back.
 *  2. profiles.last_shield_milestone records the highest milestone already
 *     paid, so replaying this endpoint grants nothing.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;
    const admin = getAdminSupabase();

    const { data: profile } = await admin
      .from('profiles')
      .select('streak_shields, last_shield_milestone')
      .eq('id', userId)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 404 });

    // Distinct days this player actually recorded a daily result, newest first.
    const { data: rows } = await admin
      .from('daily_results')
      .select('day')
      .eq('user_id', userId)
      .eq('play_type', 'solo')
      .order('day', { ascending: false })
      .limit(400);

    const days = Array.from(new Set((rows ?? []).map((r: any) => r.day as string))).sort().reverse();

    // Walk back from the most recent day, counting consecutive calendar days.
    // Starting at the newest PLAYED day (rather than today) means the streak is
    // still intact earlier in the day before they've played.
    let streak = 0;
    if (days.length > 0) {
      streak = 1;
      for (let i = 1; i < days.length; i++) {
        const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
        const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
        if (prev - cur === 86_400_000) streak++;
        else break;
      }
    }

    const earned = Math.floor(streak / MILESTONE_EVERY);
    const alreadyPaid = profile.last_shield_milestone ?? 0;
    if (earned <= alreadyPaid) {
      return NextResponse.json({ granted: 0, streak, milestone: alreadyPaid });
    }

    const grant = Math.min(earned - alreadyPaid, MAX_GRANT_PER_CALL);
    await admin
      .from('profiles')
      .update({
        streak_shields: (profile.streak_shields ?? 0) + grant,
        last_shield_milestone: alreadyPaid + grant,
      })
      .eq('id', userId);

    return NextResponse.json({ granted: grant, streak, milestone: alreadyPaid + grant });
  } catch (error: any) {
    console.error('[shields/grant-milestone]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
