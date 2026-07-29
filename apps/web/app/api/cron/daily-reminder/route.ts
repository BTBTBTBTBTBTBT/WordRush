import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sendApns, isApnsConfigured, type ApnsMessage } from '@/lib/push/apns';
import webpush from 'web-push';

// Vercel Pro raises the serverless function limit above Hobby's 10s cap. This
// route batches over rows, so give it headroom to finish instead of timing out.
export const maxDuration = 60;
// node:http2 (the APNs transport) is unavailable on the edge runtime.
export const runtime = 'nodejs';

const MESSAGES = [
  { title: '🔥 Keep your streak alive!', body: "Today's daily puzzles are waiting for you." },
  { title: '🧩 New puzzles are here!', body: "Can you beat yesterday's score?" },
  { title: '⚔️ Daily challenge is live!', body: 'Your word skills are needed.' },
  { title: '🏆 Climb the leaderboard!', body: "Play today's puzzles before time runs out." },
  { title: "💪 Don't break your streak!", body: 'A quick game keeps the streak going.' },
];

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  webpush.setVapidDetails(
    'mailto:bterchin@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const sb = getAdminSupabase();
  const today = new Date().toISOString().slice(0, 10);

  // Web push subscriptions and native (APNs) device tokens are separate
  // channels for the same nudge — a user with the iOS app and the PWA is
  // deduped below so they don't get told twice.
  const [{ data: subs }, { data: devices }] = await Promise.all([
    sb.from('push_subscriptions').select('user_id, endpoint, keys'),
    sb.from('device_tokens').select('user_id, token').eq('platform', 'ios'),
  ]);

  if ((!subs || subs.length === 0) && (!devices || devices.length === 0)) {
    return NextResponse.json({ sent: 0, failed: 0 });
  }

  // Get users who already played today so we don't nag them
  const { data: playedToday } = await sb
    .from('daily_results')
    .select('user_id')
    .eq('day', today);

  const playedSet = new Set((playedToday ?? []).map((r: any) => r.user_id));

  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: '/daily' });

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];
  /** Users reached by web push — skipped in the APNs pass to avoid a double ping. */
  const notifiedUsers = new Set<string>();

  for (const sub of subs ?? []) {
    if (playedSet.has(sub.user_id)) continue;
    notifiedUsers.add(sub.user_id);

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as any },
        payload,
      );
      sent++;
    } catch (err: any) {
      failed++;
      // 404 or 410 means the subscription is no longer valid
      if (err.statusCode === 404 || err.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await sb
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints);
  }

  // Native pass: same message to iOS devices whose owner hasn't played today
  // and wasn't already reached over web push.
  const apnsTargets: ApnsMessage[] = (devices ?? [])
    .filter((d: any) => !playedSet.has(d.user_id) && !notifiedUsers.has(d.user_id))
    .map((d: any) => ({ token: d.token, title: msg.title, body: msg.body, url: '/daily' }));

  const apns = await sendApns(apnsTargets);

  // Apple only reports a token as dead at send time, so this is the one place
  // device_tokens gets pruned.
  if (apns.staleTokens.length > 0) {
    await sb.from('device_tokens').delete().in('token', apns.staleTokens);
  }

  return NextResponse.json({
    sent,
    failed,
    skippedAlreadyPlayed: playedSet.size,
    staleRemoved: staleEndpoints.length,
    apns: {
      configured: isApnsConfigured(),
      targeted: apnsTargets.length,
      sent: apns.sent,
      failed: apns.failed,
      staleRemoved: apns.staleTokens.length,
      errors: apns.errors,
    },
  });
}
