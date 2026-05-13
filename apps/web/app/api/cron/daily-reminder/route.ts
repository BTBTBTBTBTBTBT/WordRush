import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import webpush from 'web-push';

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

  // Get all push subscriptions
  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('user_id, endpoint, keys');

  if (!subs || subs.length === 0) {
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

  for (const sub of subs) {
    if (playedSet.has(sub.user_id)) continue;

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

  return NextResponse.json({
    sent,
    failed,
    skippedAlreadyPlayed: playedSet.size,
    staleRemoved: staleEndpoints.length,
  });
}
