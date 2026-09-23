import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';
import {
  SHARE_SOURCE,
  summarizeShares,
  summarizeShareOutcomes,
  type LandingVisitRow,
  type ReferralRow,
  type ShareEventRow,
} from '@/lib/admin/share-analytics';

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

/**
 * Admin marketing overview: every channel that can bring a player in, and
 * whether it actually did.
 *
 * - marketing_links: the /go/<slug> short links (clicks counted by the
 *   redirect route). Service-role only, so this endpoint is their one reader.
 * - signups by source: profiles.signup_source — first-touch, brand-new
 *   accounts only. The one marketing number that isn't vanity. Sources are
 *   the /go channel slugs plus 'share' (a visit to a shared /s/ card).
 * - push reach / referrals / shares: counts from tables other admin pages
 *   already own, condensed to the marketing-relevant headline.
 * - shares (JP, 2026-09-23): where the 30-day shares came from (platform ×
 *   kind, game, surface) and what came of them (invite opens → redemptions →
 *   conversions; share-page visits → share-attributed signups). Aggregation
 *   lives in lib/admin/share-analytics.ts (pure, tested); this route only
 *   fetches rows. landing_visits is a manual migration — a missing table
 *   reads as null, and the page says "tracking from deploy" rather than 0.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);
  const monthAgo = since.toISOString();

  const [linksQ, sourcesQ, pushQ, referralsQ, sharesQ, referralWindowQ, visitsQ, shareSignupsQ] = await Promise.all([
    admin.from('marketing_links')
      .select('slug, channel, target, clicks, created_at')
      .order('clicks', { ascending: false }),
    // signup_source is stamped once, at account creation; a plain fetch of the
    // non-null column stays cheap for a long time at this scale.
    admin.from('profiles').select('signup_source').not('signup_source', 'is', null),
    admin.from('device_tokens').select('id', { count: 'exact', head: true }),
    admin.from('referrals')
      .select('status', { count: 'exact' })
      .in('status', ['redeemed', 'converted']),
    // The 30-day share rows themselves (not just a count) — a few hundred at
    // most today; the aggregation helper does the rest. Capped well above
    // PostgREST's default page so the total can't silently truncate.
    admin.from('share_events')
      .select('platform, kind, game_mode, surface')
      .gte('created_at', monthAgo)
      .limit(5000),
    // Every referral that did anything in the window, by whichever timestamp
    // moved — an invite created months ago can redeem or convert this month.
    admin.from('referrals')
      .select('code, status, created_at, redeemed_at, converted_at')
      .or(`created_at.gte.${monthAgo},redeemed_at.gte.${monthAgo},converted_at.gte.${monthAgo}`)
      .limit(5000),
    admin.from('landing_visits')
      .select('page, ref, created_at')
      .gte('created_at', monthAgo)
      .limit(20000),
    admin.from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('signup_source', SHARE_SOURCE)
      .gte('created_at', monthAgo),
  ]);

  const signupsBySource: Record<string, number> = {};
  for (const row of sourcesQ.data ?? []) {
    const s = row.signup_source as string;
    signupsBySource[s] = (signupsBySource[s] ?? 0) + 1;
  }

  const shareRows = (sharesQ.data ?? []) as ShareEventRow[];
  // A missing landing_visits table (migration not yet applied) is the one
  // expected error here; it must read as "not tracked", never as zero.
  const visits = visitsQ.error ? null : ((visitsQ.data ?? []) as LandingVisitRow[]);
  const shares = {
    windowDays: WINDOW_DAYS,
    since: monthAgo,
    breakdown: summarizeShares(shareRows),
    outcomes: summarizeShareOutcomes({
      shares: shareRows,
      referrals: (referralWindowQ.data ?? []) as ReferralRow[],
      visits,
      shareSignups: shareSignupsQ.error ? null : (shareSignupsQ.count ?? 0),
      since,
    }),
    landingVisitsTracked: visits !== null,
    // Truncation flags so a capped fetch is visible instead of silently wrong.
    truncated: shareRows.length >= 5000 || (visits?.length ?? 0) >= 20000,
  };

  return NextResponse.json({
    links: (linksQ.data ?? []).map((l) => ({
      slug: l.slug,
      channel: l.channel,
      target: l.target,
      clicks: l.clicks ?? 0,
      signups: signupsBySource[l.channel] ?? 0,
    })),
    signupsBySource,
    attributedSignups: Object.values(signupsBySource).reduce((a, b) => a + b, 0),
    pushDevices: pushQ.count ?? 0,
    referralsRedeemed: referralsQ.count ?? 0,
    shares30d: shares.breakdown.total,
    invites30d: shares.outcomes.invites.shared,
    shares,
  });
}
