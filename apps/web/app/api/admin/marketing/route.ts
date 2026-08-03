import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Admin marketing overview: every channel that can bring a player in, and
 * whether it actually did.
 *
 * - marketing_links: the /go/<slug> short links (clicks counted by the
 *   redirect route). Service-role only, so this endpoint is their one reader.
 * - signups by source: profiles.signup_source — first-touch, brand-new
 *   accounts only. The one marketing number that isn't vanity.
 * - push reach / referrals / shares: counts from tables other admin pages
 *   already own, condensed to the marketing-relevant headline.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [linksQ, sourcesQ, pushQ, referralsQ, sharesQ, invitesQ] = await Promise.all([
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
    admin.from('share_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthAgo),
    admin.from('share_events')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'link_invite')
      .gte('created_at', monthAgo),
  ]);

  const signupsBySource: Record<string, number> = {};
  for (const row of sourcesQ.data ?? []) {
    const s = row.signup_source as string;
    signupsBySource[s] = (signupsBySource[s] ?? 0) + 1;
  }

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
    shares30d: sharesQ.count ?? 0,
    invites30d: invitesQ.count ?? 0,
  });
}
