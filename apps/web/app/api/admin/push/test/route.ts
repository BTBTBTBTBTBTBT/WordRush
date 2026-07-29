import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';
import { sendApns, isApnsConfigured } from '@/lib/push/apns';

export const dynamic = 'force-dynamic';
// node:http2 (the APNs transport) is unavailable on the edge runtime.
export const runtime = 'nodejs';

/**
 * Send a test push to the CALLING admin's own devices.
 *
 * Deliberately self-targeted: verifying the APNs pipeline shouldn't be able to
 * spam real users, so there is no way to aim this at another account. The daily
 * cron is the only path that notifies anyone else.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  if (!isApnsConfigured()) {
    return NextResponse.json(
      { error: 'APNs not configured — set APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY' },
      { status: 503 },
    );
  }

  const admin = getAdminSupabase();
  const { data: devices } = await admin
    .from('device_tokens')
    .select('token')
    .eq('user_id', auth.admin.id)
    .eq('platform', 'ios');

  if (!devices || devices.length === 0) {
    return NextResponse.json(
      { error: 'No iOS devices registered for this account. Open the app once on a device running build 136+ and allow notifications.' },
      { status: 404 },
    );
  }

  const result = await sendApns(devices.map((d) => ({
    token: d.token,
    title: '🧩 Wordocious test push',
    body: 'If you can read this, APNs is wired up correctly.',
    url: '/daily',
  })));

  if (result.staleTokens.length > 0) {
    await admin.from('device_tokens').delete().in('token', result.staleTokens);
  }

  return NextResponse.json({
    devices: devices.length,
    sent: result.sent,
    failed: result.failed,
    staleRemoved: result.staleTokens.length,
    errors: result.errors,
  });
}
