import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { sweepAll } from '@/lib/supabase-sweep';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, ONLINE_WINDOW_MS } from '@wordle-duel/core';
import { headCount, isoDaysAgo, usernames } from '@/lib/admin/admin-queries';
import { pocketSummary, type FriendlyGameRow } from '@/lib/admin/admin-aggregates';

export const dynamic = 'force-dynamic';

const REACTIONS = ['clap', 'fire', 'wow', 'grr', 'rematch'] as const;
/** Friends achievements: the server-visible proxy for friend streaks (Ride or Die = a 7-day friend streak). */
const FRIEND_MILESTONES = ['best_buds', 'squad_goals', 'race_day', 'ride_or_die', 'cheerleader', 'pocket_pro'] as const;

/**
 * admin > Social > Friends: friendships, presence ("on now"), the six pocket
 * games (friendly_games), reactions (moment_reactions), weekly races
 * (weekly_race_results), taunts and gifted shields. Friend streaks are
 * computed on the client from both players' daily days, so the page shows
 * the Ride or Die unlocks as their server-side signal. Read-only; anything
 * not applied yet comes back null.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = Date.now();
  const since7 = isoDaysAgo(7, now);

  const [
    accepted, pending, accepted7, pairs,
    onNow, seen24h,
    pocketRows, recentPocketRes,
    reactionsAll, reactions7, reactionByEmoji, reactors7,
    raceRes, taunts7, shieldGifts, shieldGifts7,
    milestones,
  ] = await Promise.all([
    headCount(admin.from('friendships').select('status', { count: 'exact', head: true }).eq('status', 'accepted')),
    headCount(admin.from('friendships').select('status', { count: 'exact', head: true }).eq('status', 'pending')),
    headCount(admin.from('friendships').select('status', { count: 'exact', head: true }).eq('status', 'accepted').gte('accepted_at', since7)),
    sweepAll<{ requester_id: string; addressee_id: string }>((f, t) =>
      admin.from('friendships').select('requester_id, addressee_id').eq('status', 'accepted').order('requester_id').order('addressee_id').range(f, t),
    ),
    headCount(admin.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', new Date(now - ONLINE_WINDOW_MS).toISOString())),
    headCount(admin.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen_at', isoDaysAgo(1, now))),
    sweepAll<FriendlyGameRow>((f, t) => admin.from('friendly_games').select('kind, status, created_at, winner').order('id').range(f, t)),
    admin.from('friendly_games').select('id, kind, player_a, player_b, status, winner, created_at, updated_at').order('updated_at', { ascending: false }).limit(15),
    headCount(admin.from('moment_reactions').select('user_id', { count: 'exact', head: true })),
    headCount(admin.from('moment_reactions').select('user_id', { count: 'exact', head: true }).gte('created_at', since7)),
    Promise.all(REACTIONS.map(async (emoji) => ({
      key: emoji,
      count: await headCount(admin.from('moment_reactions').select('user_id', { count: 'exact', head: true }).eq('emoji', emoji)),
    }))),
    sweepAll<{ user_id: string }>((f, t) =>
      admin.from('moment_reactions').select('user_id').gte('created_at', since7).order('created_at').order('user_id').order('moment_id').range(f, t),
    ),
    admin.from('weekly_race_results').select('user_id, week_start, rank, points, circle_size, winner_id, winner_points').order('week_start', { ascending: false }).limit(3000),
    headCount(admin.from('friend_taunts').select('sender_id', { count: 'exact', head: true }).gte('created_at', since7)),
    headCount(admin.from('shield_gifts').select('sender_id', { count: 'exact', head: true })),
    headCount(admin.from('shield_gifts').select('sender_id', { count: 'exact', head: true }).gte('created_at', since7)),
    Promise.all(FRIEND_MILESTONES.map(async (key) => ({
      key,
      count: await headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).eq('achievement_key', key)),
    }))),
  ]);

  // Friend graph shape.
  const degree = new Map<string, number>();
  for (const p of pairs) {
    degree.set(p.requester_id, (degree.get(p.requester_id) ?? 0) + 1);
    degree.set(p.addressee_id, (degree.get(p.addressee_id) ?? 0) + 1);
  }
  const withFriends = degree.size;
  const topIds = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Weekly races: one row per player per settled week; a circle's winner is winner_id.
  const raceRows = (raceRes.data ?? []) as Array<{ user_id: string; week_start: string; rank: number; points: number; circle_size: number; winner_id: string | null; winner_points: number | null }>;
  const weeks = new Map<string, { week: string; players: number; winners: Map<string, number> }>();
  for (const r of raceRows) {
    const w = weeks.get(r.week_start) ?? { week: r.week_start, players: 0, winners: new Map<string, number>() };
    w.players++;
    if (r.winner_id) w.winners.set(r.winner_id, Math.max(w.winners.get(r.winner_id) ?? 0, r.winner_points ?? 0));
    weeks.set(r.week_start, w);
  }
  const recentWeeks = [...weeks.values()].sort((a, b) => (a.week < b.week ? 1 : -1)).slice(0, 6);

  const recentPocket = (recentPocketRes.data ?? []) as Array<{ id: string; kind: string; player_a: string; player_b: string; status: string; winner: string | null; created_at: string; updated_at: string }>;
  const names = await usernames(admin, [
    ...topIds.map(([id]) => id),
    ...recentPocket.flatMap((g) => [g.player_a, g.player_b]),
    ...recentWeeks.flatMap((w) => [...w.winners.keys()]),
  ]);
  const nm = (id: string | null) => (id ? names.get(id) ?? id.slice(0, 8) : null);
  const kindTitle = (k: string) => (FRIENDLY_TITLES as Record<string, string>)[k] ?? k;

  return NextResponse.json({
    friendships: {
      accepted,
      pending,
      accepted7,
      playersWithFriends: withFriends,
      avgFriends: withFriends ? Math.round((10 * (2 * pairs.length)) / withFriends) / 10 : 0,
      mostConnected: topIds.map(([id, n]) => ({ userId: id, player: nm(id), friends: n })),
    },
    presence: { onNow, seen24h },
    pocket: {
      kinds: pocketSummary(pocketRows, FRIENDLY_KINDS, now).map((k) => ({ ...k, title: kindTitle(k.kind) })),
      recent: recentPocket.map((g) => ({
        id: g.id,
        game: kindTitle(g.kind),
        players: `${nm(g.player_a)} vs ${nm(g.player_b)}`,
        status: g.status,
        winner: nm(g.winner),
        updated_at: g.updated_at,
      })),
    },
    reactions: { all: reactionsAll, last7: reactions7, byEmoji: reactionByEmoji, reactors7: new Set(reactors7.map((r) => r.user_id)).size },
    races: recentWeeks.map((w) => ({
      week: w.week,
      players: w.players,
      circles: w.winners.size,
      winners: [...w.winners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, pts]) => ({ userId: id, player: nm(id), points: pts })),
    })),
    extras: { taunts7, shieldGifts, shieldGifts7 },
    milestones,
  });
}
