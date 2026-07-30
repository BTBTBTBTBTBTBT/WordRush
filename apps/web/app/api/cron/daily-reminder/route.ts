import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sendApns, isApnsConfigured, type ApnsMessage } from '@/lib/push/apns';
import { sendFcm, isFcmConfigured, type FcmMessage } from '@/lib/push/fcm';
import webpush from 'web-push';

// Vercel Pro raises the serverless function limit above Hobby's 10s cap. This
// route batches over rows, so give it headroom to finish instead of timing out.
export const maxDuration = 60;
// node:http2 (the APNs transport) is unavailable on the edge runtime.
export const runtime = 'nodejs';

// Notification copy uses the game's all-caps headline voice (FLAWLESS VICTORY!,
// DAILY SWEEP!) so the nudge reads as Wordocious even though iOS/Android own
// the banner chrome and won't let us style type or color.
const MESSAGES = [
  { title: 'DAILY CHALLENGE 🔥', body: "Today's nine puzzles are live. Keep the streak alive." },
  { title: 'NEW PUZZLES! 🧩', body: "A fresh set just dropped. Can you beat yesterday's score?" },
  { title: 'THE SWEEP AWAITS 🧹', body: 'All nine dailies, one run. Think you can clear them?' },
  { title: 'CLIMB THE BOARD 🏆', body: "Play today's puzzles before the day rolls over." },
  { title: 'STREAK AT RISK! 💪', body: 'One quick game keeps it going.' },
];

/** Lapsed = no daily result today OR yesterday. */
const LAPSED_AFTER_DAYS = 2;

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
    // Both natives: platform decides which sender each token goes to. This
    // used to filter to 'ios', so Android tokens were stored and never used.
    sb.from('device_tokens').select('user_id, token, platform').in('platform', ['ios', 'android']),
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

  // The iOS app schedules its OWN 18:00 local reminder for anyone with
  // unfinished dailies, so pushing "you haven't played today" to the same
  // devices would nag twice a day. Instead the native channel targets LAPSED
  // players — no daily result today or yesterday — which is precisely the group
  // the local reminder stops reaching, since it only re-arms when the app is
  // foregrounded or a daily is completed.
  const lapsedCutoff = new Date(Date.now() - (LAPSED_AFTER_DAYS - 1) * 86_400_000)
    .toISOString().slice(0, 10);
  const { data: playedRecently } = await sb
    .from('daily_results')
    .select('user_id')
    .gte('day', lapsedCutoff);

  const recentSet = new Set((playedRecently ?? []).map((r: any) => r.user_id));

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

  // Native pass: win-back for lapsed players only (see recentSet above), minus
  // anyone already reached over web push this run.
  const nativeTargets = (devices ?? []).filter(
    (d: any) => !recentSet.has(d.user_id) && !notifiedUsers.has(d.user_id),
  );
  const nativeNote = {
    title: 'WE MISS YOU! 🧩',
    body: "Your streak is waiting. Today's nine puzzles are live.",
    url: '/daily',
  };

  const apnsTargets: ApnsMessage[] = nativeTargets
    .filter((d: any) => d.platform === 'ios')
    .map((d: any) => ({ token: d.token, ...nativeNote }));
  const fcmTargets: FcmMessage[] = nativeTargets
    .filter((d: any) => d.platform === 'android')
    .map((d: any) => ({ token: d.token, ...nativeNote }));

  // Independent so one provider being down or unconfigured can't stop the other.
  const [apns, fcm] = await Promise.all([sendApns(apnsTargets), sendFcm(fcmTargets)]);

  // Both providers only report a token as dead at send time, so this is the one
  // place device_tokens gets pruned.
  const deadTokens = [...apns.staleTokens, ...fcm.staleTokens];
  if (deadTokens.length > 0) {
    await sb.from('device_tokens').delete().in('token', deadTokens);
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
    fcm: {
      configured: isFcmConfigured(),
      targeted: fcmTargets.length,
      sent: fcm.sent,
      failed: fcm.failed,
      staleRemoved: fcm.staleTokens.length,
      errors: fcm.errors,
    },
  });
}
