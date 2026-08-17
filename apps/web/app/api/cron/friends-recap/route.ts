import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { broadcastPush } from '@/lib/push/broadcast';
import { stampHeartbeat } from '@/lib/heartbeat';

// Monday-morning friends recap (§216, founder ask Aug 17): "who won last
// week's race" — one push per user with friends, sent as the new week opens.
// Weeks are the same Monday-start windows the Friends podium uses; the cron
// runs on UTC Monday which brackets every US local Monday morning.
export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getAdminSupabase();

  // Last week's window: the Monday..Sunday that just ended (UTC).
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun … 1=Mon
  const thisMonday = new Date(now);
  thisMonday.setUTCDate(now.getUTCDate() - ((dow + 6) % 7));
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
  const from = lastMonday.toISOString().slice(0, 10);
  const to = lastSunday.toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // circle = me + my accepted friends, per user.
  const circles = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    let c = circles.get(a);
    if (!c) { c = new Set([a]); circles.set(a, c); }
    c.add(b);
  };
  for (const r of rows ?? []) {
    addEdge(r.requester_id, r.addressee_id);
    addEdge(r.addressee_id, r.requester_id);
  }
  if (circles.size === 0) {
    stampHeartbeat('friends-recap', true).catch(() => {});
    return NextResponse.json({ sent: 0, reason: 'no friendships' });
  }

  const everyone = [...new Set([...circles.keys(), ...[...circles.values()].flatMap((s) => [...s])])];
  const [{ data: results }, { data: profiles }] = await Promise.all([
    sb.from('daily_results')
      .select('user_id, composite_score')
      .in('user_id', everyone)
      .eq('play_type', 'solo')
      .gte('day', from)
      .lte('day', to),
    sb.from('profiles').select('id, username').in('id', everyone),
  ]);

  const points = new Map<string, number>();
  for (const r of (results ?? []) as Array<{ user_id: string; composite_score: number }>) {
    points.set(r.user_id, (points.get(r.user_id) ?? 0) + (r.composite_score ?? 0));
  }
  const nameOf = new Map((profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  let sent = 0;
  for (const [uid, circle] of circles) {
    const standings = [...circle]
      .map((id) => ({ id, pts: points.get(id) ?? 0 }))
      .sort((a, b) => b.pts - a.pts);
    // A race needs someone on the scoreboard.
    if (standings[0].pts <= 0) continue;
    const winner = standings[0];
    const mine = standings.find((s) => s.id === uid)?.pts ?? 0;
    const msg = winner.id === uid
      ? { title: 'FRIENDS RACE 👑', body: `You won last week's race — ${fmt(winner.pts)} pts. Defend the crown.` }
      : {
          title: 'FRIENDS RACE 🏁',
          body: `Last week: ${nameOf.get(winner.id) ?? 'A friend'} took it, ${fmt(winner.pts)} to your ${fmt(mine)}. New week starts now.`,
        };
    const res = await broadcastPush({ ...msg, url: '/friends' }, new Set([uid]));
    sent += res.sent;
  }

  stampHeartbeat('friends-recap', true).catch(() => {});
  return NextResponse.json({ sent, circles: circles.size, week: { from, to } });
}
