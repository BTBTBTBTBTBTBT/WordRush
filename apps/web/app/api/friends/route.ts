import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';
import { sweepAll } from '@/lib/supabase-sweep';
import { sweepModesFor } from '@/lib/modes.generated';
import { settleWeek } from '@/lib/weekly-race';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { friendAchievements, friendStreak, shiftDay, wonFriendsRace } from '@wordle-duel/core';
import { grantAchievements } from '@/lib/achievements-server';
import type { NewAchievement } from '@/lib/achievement-service';
import { selectWithAvatarColumns, withOwnAvatarFields, type AvatarFields } from '@/lib/avatar-fields-server';

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
  // FINISH_SPEC AH/AN3 (additive): every person also carries avatar_cast_id,
  // avatar_frame, avatar_config and is_pro (active Pro). The avatar columns may
  // not exist yet; selectWithAvatarColumns retries without them (null fields).
  const { data, error } = await selectWithAvatarColumns((extra) => admin
    .from('friendships')
    .select(
      `requester_id, addressee_id, status, created_at, accepted_at, reminded_at,
       requester:profiles!friendships_requester_id_fkey(id, username, avatar_url, avatar_emoji, level, daily_login_streak, last_seen_at, last_activity${extra}),
       addressee:profiles!friendships_addressee_id_fkey(id, username, avatar_url, avatar_emoji, level, daily_login_streak, last_seen_at, last_activity${extra})`,
    )
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // avatar_emoji / streak are ADDITIVE (Aug 11): shipped decoders ignore
  // them; new clients render the chosen emoji and the row status line.
  type Prof = {
    id: string; username: string; avatar_url: string | null; avatar_emoji: string | null;
    level: number; daily_login_streak?: number | null;
    last_seen_at?: string | null; last_activity?: string | null;
  } & Partial<AvatarFields>;
  const friends: Array<Prof & {
    since: string | null; streak: number;
    playedToday?: number; weekPoints?: number; todayPoints?: number; h2hW?: number; h2hL?: number;
    lastWeekPoints?: number; pastWeekPoints?: number[]; flawlessStreak?: number;
    lastSeenAt?: string | null; activity?: string | null; friendStreak?: number;
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
    const { daily_login_streak, last_seen_at, last_activity, ...raw } = other;
    const prof: Prof = withOwnAvatarFields(raw);
    const streak = daily_login_streak ?? 0;
    if (row.status === 'accepted') {
      // Friends overhaul (additive): the heartbeat for "On now" and the db key
      // of the game on their screen, mapped to its title (a key, never free text).
      const activity = last_activity ? MODE_BY_DBKEY[last_activity]?.title ?? null : null;
      friends.push({ ...prof, streak, since: row.accepted_at, lastSeenAt: last_seen_at ?? null, activity });
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
  let meDigest: { playedToday: number; weekPoints: number; todayPoints?: number; lastWeekPoints?: number; pastWeekPoints?: number[]; flawlessStreak?: number } | null = null;
  let lastWeek: { weekStart: string; rank: number; points: number; circleSize: number; winnerId: string | null; winnerName: string | null; winnerPoints: number } | null = null;
  let raceWonYesterday = false;
  let bestFriendStreak = 0;
  if (wantDigest && friends.length >= 0) {
    const ids = [me, ...friends.map((f) => f.id)];
    const cutoff = new Date(`${day}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - 90);
    const cutoffDay = cutoff.toISOString().slice(0, 10);
    // §257 (founder: "why isn't my mom showing any points for the weekly?
    // she has played this week"): PostgREST caps any un-ranged select at
    // 1,000 rows and says nothing. Seven people over 90 days was 1,410 rows,
    // so whole users fell off the end — Oliver and Michael had ZERO rows in
    // the answer (0 pts, "hasn't played today"), and the founder's own week
    // was undercounted. Page through the sweep until a short page comes back.
    const results = await sweepAll<{ user_id: string; day: string; composite_score: number; game_mode: string }>((from, to) =>
      admin
        .from('daily_results')
        .select('user_id, day, composite_score, game_mode')
        .in('user_id', ids)
        .eq('play_type', 'solo')
        .gte('day', cutoffDay)
        .lte('day', day)
        .order('id', { ascending: true })
        .range(from, to),
    );
    // per-user per-day totals
    const totals = new Map<string, Map<string, number>>();
    const playedCount = new Map<string, number>();
    const sweepSet = new Set<string>(sweepModesFor(day));
    for (const r of results) {
      let byDay = totals.get(r.user_id);
      if (!byDay) { byDay = new Map(); totals.set(r.user_id, byDay); }
      byDay.set(r.day, (byDay.get(r.day) ?? 0) + (r.composite_score ?? 0));
      // "N of 8 today" counts sweep modes only — a More Games finish must never pad the ring.
      if (r.day === day && sweepSet.has(r.game_mode)) playedCount.set(r.user_id, (playedCount.get(r.user_id) ?? 0) + 1);
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
    // §244 (additive): current flawless streak per person — consecutive
    // daily_bonuses.flawless_awarded days ending on the client's day or the
    // day before. One indexed read; shipped decoders ignore the field.
    const flawlessByUser = new Map<string, Set<string>>();
    {
      const fRows = await sweepAll<{ user_id: string; day: string }>((from, to) =>
        admin
          .from('daily_bonuses')
          .select('user_id, day')
          .in('user_id', ids)
          .eq('flawless_awarded', true)
          .gte('day', cutoffDay)
          .order('id', { ascending: true })
          .range(from, to),
      );
      for (const r of fRows) {
        let set = flawlessByUser.get(r.user_id);
        if (!set) { set = new Set(); flawlessByUser.set(r.user_id, set); }
        set.add(r.day);
      }
    }
    const shiftDay = (d: string, delta: number): string => {
      const dt = new Date(`${d}T00:00:00Z`);
      dt.setUTCDate(dt.getUTCDate() + delta);
      return dt.toISOString().slice(0, 10);
    };
    const flawlessStreakOf = (id: string): number => {
      const set = flawlessByUser.get(id);
      if (!set) return 0;
      let cursor: string | null = set.has(day) ? day : (set.has(shiftDay(day, -1)) ? shiftDay(day, -1) : null);
      let n = 0;
      while (cursor && set.has(cursor)) { n += 1; cursor = shiftDay(cursor, -1); }
      return n;
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
      f.flawlessStreak = flawlessStreakOf(f.id);
      // Friends overhaul (additive): days in a row you BOTH finished a daily.
      f.friendStreak = friendStreak(myDays.keys(), theirDays.keys(), day);
    }
    const myPast = pastWeekPointsOf(me);
    // D3.3 — the Sunday finish. The first visit after the client's Monday 00:00
    // settles LAST week for the viewer into weekly_race_results (one row per
    // user per week; friends settle their own rows on their own first visit).
    // Read back when it already exists, so the banner is stable all week.
    try {
      const prevWeekStart = pastWeekStarts[0];
      const { data: existing } = await admin
        .from('weekly_race_results')
        .select('week_start, rank, points, circle_size, winner_id, winner_points')
        .eq('user_id', me).eq('week_start', prevWeekStart).maybeSingle();
      let row = existing as { week_start: string; rank: number; points: number; circle_size: number; winner_id: string | null; winner_points: number | null } | null;
      if (!row) {
        const settled = settleWeek(
          [{ id: me, points: myPast[0] }, ...(friends as any[]).map((f) => ({ id: f.id as string, points: (f.pastWeekPoints?.[0] ?? 0) as number }))],
          me,
        );
        if (settled) {
          const insert = {
            user_id: me, week_start: prevWeekStart, rank: settled.rank, points: settled.points,
            circle_size: settled.circleSize, winner_id: settled.winnerId, winner_points: settled.winnerPoints,
          };
          const { error: insErr } = await admin.from('weekly_race_results').insert(insert);
          if (!insErr || (insErr as { code?: string }).code === '23505') row = insert;
        }
      }
      if (row) {
        const winnerName = row.winner_id === me ? 'You' : ((friends as any[]).find((f) => f.id === row!.winner_id)?.username ?? null);
        lastWeek = { weekStart: row.week_start, rank: row.rank, points: row.points, circleSize: row.circle_size, winnerId: row.winner_id, winnerName, winnerPoints: row.winner_points ?? 0 };
      }
    } catch {
      // Settlement is a bonus — never fail the friends list over it.
    }
    // FINISH_SPEC BE: yesterday's friends race (settled once the day is over).
    const yday = shiftDay(day, -1);
    raceWonYesterday = wonFriendsRace(myDays.get(yday) ?? 0, (friends as any[]).map((f) => (totals.get(f.id)?.get(yday) ?? 0) as number));
    bestFriendStreak = Math.max(0, ...(friends as any[]).map((f) => (f.friendStreak ?? 0) as number));
    meDigest = {
      playedToday: playedCount.get(me) ?? 0,
      weekPoints: weekPointsOf(me),
      todayPoints: Math.round(myDays.get(day) ?? 0),
      lastWeekPoints: myPast[0],
      pastWeekPoints: myPast,
      flawlessStreak: flawlessStreakOf(me),
    };
  }

  // FINISH_SPEC BE + BF1: the friends achievements (Best Buds, Squad Goals,
  // Race Day, Ride or Die, Cheerleader), granted here and returned as
  // `newAchievements` (additive; old clients ignore it). Best effort.
  let newAchievements: NewAchievement[] = [];
  try {
    const { count: reactionsSent } = await admin.from('moment_reactions').select('*', { count: 'exact', head: true }).eq('user_id', me);
    newAchievements = await grantAchievements(admin, me, friendAchievements({
      friendCount: friends.length,
      reactionsSent: reactionsSent ?? 0,
      bestFriendStreak,
      wonRace: raceWonYesterday,
    }));
  } catch { /* never fail the friends list over achievements */ }

  return NextResponse.json(
    { friends, incoming, outgoing, outgoingProfiles, me: meDigest, lastWeek, newAchievements },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
