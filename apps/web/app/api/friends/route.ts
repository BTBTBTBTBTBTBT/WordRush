import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends — the caller's whole friends world in one round trip:
 * accepted friends (with profile chrome), incoming pending requests, and
 * outgoing pending ids. friends-service caches this per session on all
 * three platforms (the moderation-service pattern).
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;

  // Engagement digest params (Aug 11): the CLIENT owns the day boundary
  // (local midnight, matching every daily surface), so it passes its local
  // day and week start. Absent params (older clients) skip the digest.
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  const day = req.nextUrl.searchParams.get('day') ?? '';
  const weekStart = req.nextUrl.searchParams.get('weekStart') ?? '';
  const wantDigest = DAY_RE.test(day) && DAY_RE.test(weekStart);

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from('friendships')
    .select(
      `requester_id, addressee_id, status, created_at, accepted_at, reminded_at,
       requester:profiles!friendships_requester_id_fkey(id, username, avatar_url, avatar_emoji, level, daily_login_streak),
       addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_url, avatar_emoji, level, daily_login_streak)`,
    )
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // avatar_emoji / streak are ADDITIVE (Aug 11): shipped decoders ignore
  // them; new clients render the chosen emoji and the row status line.
  type Prof = {
    id: string; username: string; avatar_url: string | null; avatar_emoji: string | null;
    level: number; daily_login_streak?: number | null;
  };
  const friends: Array<Prof & {
    since: string | null; streak: number;
    playedToday?: number; weekPoints?: number; todayPoints?: number; h2hW?: number; h2hL?: number;
    lastWeekPoints?: number; pastWeekPoints?: number[];
  }> = [];
  const incoming: Array<Prof & { requestedAt: string }> = [];
  const outgoing: string[] = [];
  // Tier 1 (Aug 11): outgoing WITH profile chrome so the client can render a
  // "Sent — waiting" section. `outgoing` stays a string[] because the 1.9 /
  // Android-71 clients decode it as one — additive field, never a reshape.
  const outgoingProfiles: Array<Prof & { requestedAt: string; remindedAt: string | null }> = [];

  for (const row of (data ?? []) as any[]) {
    const other: Prof = row.requester_id === me ? row.addressee : row.requester;
    if (!other) continue; // profile vanished mid-join; FK cascade will clean up
    const { daily_login_streak, ...prof } = other;
    const streak = daily_login_streak ?? 0;
    if (row.status === 'accepted') {
      friends.push({ ...prof, streak, since: row.accepted_at });
    } else if (row.addressee_id === me) {
      incoming.push({ ...prof, requestedAt: row.created_at });
    } else {
      outgoing.push(row.addressee_id);
      outgoingProfiles.push({ ...prof, requestedAt: row.created_at, remindedAt: row.reminded_at ?? null });
    }
  }

  friends.sort((a, b) => a.username.localeCompare(b.username));
  incoming.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  outgoingProfiles.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

  // Engagement digest (Aug 11): one daily_results sweep answers "who played
  // today", "who's winning the week", and the 90-day head-to-head record —
  // per-day TOTAL points across all modes, me vs each friend.
  let meDigest: { playedToday: number; weekPoints: number; todayPoints?: number; lastWeekPoints?: number; pastWeekPoints?: number[] } | null = null;
  if (wantDigest && friends.length >= 0) {
    const ids = [me, ...friends.map((f) => f.id)];
    const cutoff = new Date(`${day}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    const { data: results } = await admin
      .from('daily_results')
      .select('user_id, day, composite_score')
      .in('user_id', ids)
      .eq('play_type', 'solo')
      .gte('day', cutoffDay)
      .lte('day', day);
    // per-user per-day totals
    const totals = new Map<string, Map<string, number>>();
    const playedCount = new Map<string, number>();
    for (const r of (results ?? []) as Array<{ user_id: string; day: string; composite_score: number }>) {
      let byDay = totals.get(r.user_id);
      if (!byDay) { byDay = new Map(); totals.set(r.user_id, byDay); }
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + (r.composite_score ?? 0));
      if (r.day === day) playedCount.set(r.user_id, (playedCount.get(r.user_id) ?? 0) + 1);
    }
    const weekPointsOf = (id: string): number => {
      let sum = 0;
      for (const [d, pts] of totals.get(id) ?? []) if (d >= weekStart) sum += pts;
      return Math.round(sum);
    };
    // §232/§238: the settled weeks before weekStart. pastWeekPoints[k] is
    // the week starting (k+1) Mondays back — [0] = last week (the Monday
    // "Last week: 👑 …" line), the rest the history disclosure. 12 weeks
    // fits the 90-day sweep exactly (day ≤ weekStart+6d, 84+6 = 90). Pure
    // date-string math on the client's own week boundary; additive fields,
    // shipped decoders ignore them (lastWeekPoints stays = [0] for §232
    // clients).
    const PAST_WEEKS = 12;
    const pastWeekStarts: string[] = [];
    for (let k = 1; k <= PAST_WEEKS; k++) {
      const d = new Date(`${weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 7 * k);
      pastWeekStarts.push(d.toISOString().slice(0, 10));
    }
    const pastWeekPointsOf = (id: string): number[] => {
      const sums = new Array<number>(PAST_WEEKS).fill(0);
      for (const [d, pts] of totals.get(id) ?? []) {
        if (d >= weekStart) continue;
        for (let k = 0; k < PAST_WEEKS; k++) {
          if (d >= pastWeekStarts[k]) { sums[k] += pts; break; }
        }
      }
      return sums.map((v) => Math.round(v));
    };
    const myDays = totals.get(me) ?? new Map<string, number>();
    for (const f of friends as any[]) {
      const theirDays = totals.get(f.id) ?? new Map<string, number>();
      let w = 0; let l = 0;
      for (const [d, mine] of myDays) {
        const theirs = theirDays.get(d);
        if (theirs === undefined || mine === theirs) continue;
        if (mine > theirs) w += 1; else l += 1;
      }
      f.playedToday = playedCount.get(f.id) ?? 0;
      f.weekPoints = weekPointsOf(f.id);
      // ADDITIVE (Aug 17): today's total points, for the "topped N of M
      // friends today" strip. Shipped decoders ignore it.
      f.todayPoints = Math.round(theirDays.get(day) ?? 0);
      const past = pastWeekPointsOf(f.id);
      f.lastWeekPoints = past[0];
      f.pastWeekPoints = past;
      f.h2hW = w;
      f.h2hL = l;
    }
    const myPast = pastWeekPointsOf(me);
    meDigest = {
      playedToday: playedCount.get(me) ?? 0,
      weekPoints: weekPointsOf(me),
      todayPoints: Math.round(myDays.get(day) ?? 0),
      lastWeekPoints: myPast[0],
      pastWeekPoints: myPast,
    };
  }

  return NextResponse.json(
    { friends, incoming, outgoing, outgoingProfiles, me: meDigest },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
