import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';
import { isApnsConfigured } from '@/lib/push/apns';
import { isFcmConfigured } from '@/lib/push/fcm';

export const dynamic = 'force-dynamic';
// apns.ts pulls in node:http2 — unavailable on the edge runtime.
export const runtime = 'nodejs';

/**
 * The messaging monitor: announcements with their live/scheduled/expired state,
 * and the push-notification picture — registered device counts per platform,
 * distinct reachable users, transport configuration, and the delivery schedule.
 * Authoring stays where it lives (announcements on the Content page; pushes go
 * out via the daily-reminder cron and the self-targeted test endpoint).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();

  const [annRes, tokensRes] = await Promise.all([
    admin
      .from('announcements')
      .select('id, title, body, type, active, starts_at, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    admin.from('device_tokens').select('user_id, platform, created_at'),
  ]);

  const now = Date.now();
  const announcements = (annRes.data || []).map((a) => {
    const started = !a.starts_at || new Date(a.starts_at).getTime() <= now;
    const expired = !!a.expires_at && new Date(a.expires_at).getTime() < now;
    return {
      ...a,
      state: !a.active ? 'disabled' : expired ? 'expired' : started ? 'live' : 'scheduled',
    };
  });

  const tokens = tokensRes.data || [];
  const byPlatform: Record<string, number> = {};
  const usersByPlatform: Record<string, Set<string>> = {};
  let latest: string | null = null;
  for (const t of tokens) {
    byPlatform[t.platform] = (byPlatform[t.platform] || 0) + 1;
    (usersByPlatform[t.platform] ||= new Set()).add(t.user_id);
    if (!latest || t.created_at > latest) latest = t.created_at;
  }

  return NextResponse.json({
    announcements,
    push: {
      totalTokens: tokens.length,
      totalUsers: new Set(tokens.map((t) => t.user_id)).size,
      byPlatform: Object.fromEntries(
        Object.entries(byPlatform).map(([p, n]) => [p, { tokens: n, users: usersByPlatform[p].size }]),
      ),
      latestRegistration: latest,
      apnsConfigured: isApnsConfigured(),
      fcmConfigured: isFcmConfigured(),
    },
  });
}
