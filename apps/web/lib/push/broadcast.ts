import { getAdminSupabase } from '@/lib/supabase-admin';
import { sendApns, type ApnsMessage } from '@/lib/push/apns';
import { sendFcm, type FcmMessage } from '@/lib/push/fcm';
import webpush from 'web-push';

// One notification, every channel: web push + APNs + FCM, deduped per user —
// extracted from the daily-reminder cron so admin campaigns and crons share a
// single send path (and a single stale-token pruner).

export interface BroadcastResult {
  targeted: number;
  sent: number;
  failed: number;
  web: number;
  ios: number;
  android: number;
}

/**
 * Send {title, body, url} to every channel of every user in `userIds`
 * (null = everyone with any token/subscription). A user with both a PWA
 * subscription and a native token gets ONE ping — web wins, matching the
 * daily-reminder cron's dedupe order.
 */
export async function broadcastPush(
  { title, body, url = '/daily' }: { title: string; body: string; url?: string },
  userIds: Set<string> | null,
): Promise<BroadcastResult> {
  const sb = getAdminSupabase();

  const webPushConfigured =
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  if (webPushConfigured) {
    webpush.setVapidDetails(
      'mailto:bterchin@gmail.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  const [{ data: subs }, { data: devices }] = await Promise.all([
    sb.from('push_subscriptions').select('user_id, endpoint, keys'),
    sb.from('device_tokens').select('user_id, token, platform').in('platform', ['ios', 'android']),
  ]);

  const inSegment = (uid: string) => userIds === null || userIds.has(uid);
  const payload = JSON.stringify({ title, body, url });

  let sent = 0;
  let failed = 0;
  let web = 0;
  const staleEndpoints: string[] = [];
  const notifiedUsers = new Set<string>();

  if (webPushConfigured) {
    for (const sub of subs ?? []) {
      if (!inSegment(sub.user_id)) continue;
      notifiedUsers.add(sub.user_id);
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys as any }, payload);
        sent++; web++;
      } catch (err: any) {
        failed++;
        if (err.statusCode === 404 || err.statusCode === 410) staleEndpoints.push(sub.endpoint);
      }
    }
    if (staleEndpoints.length > 0) {
      await sb.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
    }
  }

  const nativeTargets = (devices ?? []).filter(
    (d: any) => inSegment(d.user_id) && !notifiedUsers.has(d.user_id),
  );
  const apnsTargets: ApnsMessage[] = nativeTargets
    .filter((d: any) => d.platform === 'ios')
    .map((d: any) => ({ token: d.token, title, body, url }));
  const fcmTargets: FcmMessage[] = nativeTargets
    .filter((d: any) => d.platform === 'android')
    .map((d: any) => ({ token: d.token, title, body, url }));

  const [apns, fcm] = await Promise.all([sendApns(apnsTargets), sendFcm(fcmTargets)]);
  sent += apns.sent + fcm.sent;
  failed += apns.failed + fcm.failed;

  const deadTokens = [...apns.staleTokens, ...fcm.staleTokens];
  if (deadTokens.length > 0) {
    await sb.from('device_tokens').delete().in('token', deadTokens);
  }

  const targeted = new Set([
    ...((subs ?? []).filter((s: any) => inSegment(s.user_id)).map((s: any) => s.user_id)),
    ...nativeTargets.map((d: any) => d.user_id),
  ]).size;

  return { targeted, sent, failed, web, ios: apns.sent, android: fcm.sent };
}

export type PushSegment = 'everyone' | 'lapsed7d' | 'pro' | 'streak';

/**
 * Resolve a campaign segment to user ids (null = no filter). Segments are
 * defined over PEOPLE, not tokens — broadcastPush intersects with whoever is
 * actually reachable.
 */
export async function resolveSegment(segment: PushSegment): Promise<Set<string> | null> {
  const sb = getAdminSupabase();
  switch (segment) {
    case 'everyone':
      return null;
    case 'lapsed7d': {
      // Played nothing in the last 7 days = reachable users minus recent players.
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      const [{ data: recent }, { data: subs }, { data: devices }] = await Promise.all([
        sb.from('daily_results').select('user_id').gte('day', weekAgo),
        sb.from('push_subscriptions').select('user_id'),
        sb.from('device_tokens').select('user_id'),
      ]);
      const recentSet = new Set((recent ?? []).map((r: any) => r.user_id));
      const all = new Set<string>([
        ...(subs ?? []).map((s: any) => s.user_id),
        ...(devices ?? []).map((d: any) => d.user_id),
      ]);
      return new Set([...all].filter((id) => !recentSet.has(id)));
    }
    case 'pro': {
      const { data } = await sb.from('profiles')
        .select('id')
        .or(`is_pro.eq.true,pro_expires_at.gt.${new Date().toISOString()}`);
      return new Set((data ?? []).map((p: any) => p.id));
    }
    case 'streak': {
      const { data } = await sb.from('profiles')
        .select('id')
        .gte('daily_login_streak', 3);
      return new Set((data ?? []).map((p: any) => p.id));
    }
  }
}
