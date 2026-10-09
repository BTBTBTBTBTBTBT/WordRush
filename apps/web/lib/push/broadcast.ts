import { getAdminSupabase } from '@/lib/supabase-admin';
import { sendApns, type ApnsMessage } from '@/lib/push/apns';
import { sendFcm, type FcmMessage } from '@/lib/push/fcm';
import webpush from 'web-push';
import { avatarUrl, buildRichFields, richPushSwitches, type RichInput } from '@/lib/push/rich';

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
export type PushCategory = 'race' | 'challenge' | 'nudge' | 'feed';

export async function broadcastPush(
  { title, body, url = '/daily' }: { title: string; body: string; url?: string },
  userIds: Set<string> | null,
  /** Friends pushes name a category; a recipient whose
   *  profiles.notification_prefs[category] === false is skipped (D3.5). */
  category?: PushCategory,
  /** Item 34: the friend + game behind this push. With the `rich_push` switch on, every channel carries the
   *  card fields (sender mascot, game art, thread, collapse); off = the plain legacy payload. */
  richInput?: RichInput,
): Promise<BroadcastResult> {
  const sb = getAdminSupabase();
  const sw = richInput ? await richPushSwitches(sb) : null;
  const built = richInput && sw?.rich ? buildRichFields(richInput, sw.halloween) : null;

  if (category && userIds && userIds.size > 0) {
    const { data: prefRows } = await sb.from('profiles').select('id, notification_prefs').in('id', [...userIds]);
    const allowed = new Set<string>();
    for (const r of (prefRows ?? []) as Array<{ id: string; notification_prefs: Record<string, boolean> | null }>) {
      if (r.notification_prefs?.[category] !== false) allowed.add(r.id);
    }
    userIds = allowed;
    if (userIds.size === 0) return { targeted: 0, sent: 0, failed: 0, web: 0, ios: 0, android: 0 };
  }

  const webPushConfigured =
    !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
  if (webPushConfigured) {
    webpush.setVapidDetails(
      'mailto:bterchin@gmail.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
  }

  // rich_push (device_tokens.rich_push) = a build that draws its own Android notification; the column may not
  // exist yet (manual migration), so fall back to the plain select.
  const [{ data: subs }, devicesRes] = await Promise.all([
    sb.from('push_subscriptions').select('user_id, endpoint, keys'),
    sb.from('device_tokens').select('user_id, token, platform, rich_push').in('platform', ['ios', 'android']),
  ]);
  let devices: any[] | null = devicesRes.data as any[] | null;
  if (devicesRes.error) {
    const plain = await sb.from('device_tokens').select('user_id, token, platform').in('platform', ['ios', 'android']);
    devices = plain.data as any[] | null;
  }

  const inSegment = (uid: string) => userIds === null || userIds.has(uid);
  // Web push: the service worker draws icon (sender mascot) + image (game art) + tag (thread) when present.
  const payload = JSON.stringify({
    title, body, url,
    ...(built ? { icon: built.fields.senderAvatar, image: built.fields.gameImage, tag: built.fields.thread, accent: built.fields.accent } : {}),
  });

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
    // The card's "you" is the RECIPIENT's own mascot, so the fields are per device on iOS.
    .map((d: any) => ({ token: d.token, title, body, url, ...(built ? { rich: { ...built.fields, youAvatar: avatarUrl(d.user_id) }, collapseId: built.collapseId } : {}) }));
  const fcmTargets: FcmMessage[] = nativeTargets
    .filter((d: any) => d.platform === 'android')
    .map((d: any) => ({
      token: d.token, title, body, url,
      ...(built ? { rich: built.fields, richCapable: d.rich_push === true, collapseKey: built.collapseId } : {}),
    }));

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
