import { NextRequest, NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { requireUser } from '@/lib/friends-server';
import { MODE_BY_DBKEY, MORE_GAME_MODES } from '@/lib/modes.generated';
import { FRIENDLY_TITLES, type FriendlyKind } from '@wordle-duel/core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/friends/feed?day=YYYY-MM-DD — the activity feed for the Friends tab
 * (Stats + Friends redesign D3, founder 2026-09-26): what you and your friends
 * did over the last seven days, from tables that already exist — Daily Sweeps
 * and Flawless Victories (daily_bonuses), podium / perfect / streak medals
 * (medals), all-time records set (all_time_records) and More Games Sweeps
 * (every More Games daily played on one day, from daily_results), and —
 * Friends overhaul 2026-10-01 — finished pocket games between people in the
 * circle (friendly_games). Newest first, capped at 40. `reactions` carries
 * each shown moment's fixed-emoji counts and the caller's own picks.
 */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAYS = 7;

export interface FeedEvent {
  id: string;
  userId: string;
  username: string;
  avatar_url: string | null;
  avatar_emoji: string | null;
  me: boolean;
  day: string;            // the player's local day the event belongs to
  at: string;             // ISO timestamp for ordering
  type: 'sweep' | 'flawless' | 'medal' | 'record' | 'more_sweep' | 'more_flawless' | 'gift' | 'game';
  /** Gift rows: the other party's name. */
  otherName?: string | null;
  otherId?: string | null;
  /** medal_type for medals (gold/silver/bronze/perfect/streak_7…), record_type for records. */
  kind?: string;
  gameMode?: string | null;
  gameTitle?: string | null;
  value?: number | null;
  /** Pocket games: 'win' or 'draw', and the final score from the winner's side ("2–1"). */
  score?: string | null;
  /** Pocket games: the game kind ('rps' | 'ttt' | 'coin' | 'pass'). */
  gameKind?: string | null;
}

function shiftDay(d: string, delta: number): string {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;
  const me = auth.user.id;
  const day = req.nextUrl.searchParams.get('day') ?? '';
  if (!DAY_RE.test(day)) return NextResponse.json({ error: 'day required' }, { status: 400 });
  const cutoff = shiftDay(day, -(DAYS - 1));

  const admin = getAdminSupabase();
  const { data: rows, error } = await admin
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${me},addressee_id.eq.${me}`);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = [me, ...new Set((rows ?? []).map((r: any) => (r.requester_id === me ? r.addressee_id : r.requester_id)))];

  const [{ data: profs }, { data: bonuses }, { data: medals }, { data: records }, { data: moreRows }, { data: gifts }] = await Promise.all([
    admin.from('profiles').select('id, username, avatar_url, avatar_emoji').in('id', ids),
    admin.from('daily_bonuses').select('user_id, day, sweep_awarded, flawless_awarded, updated_at')
      .in('user_id', ids).gte('day', cutoff).lte('day', day).or('sweep_awarded.eq.true,flawless_awarded.eq.true'),
    admin.from('medals').select('id, user_id, day, game_mode, play_type, medal_type, composite_score, created_at')
      .in('user_id', ids).gte('day', cutoff).lte('day', day),
    admin.from('all_time_records').select('id, holder_id, record_type, game_mode, record_value, play_type, achieved_at')
      .in('holder_id', ids).gte('achieved_at', `${cutoff}T00:00:00Z`),
    admin.from('daily_results').select('user_id, day, game_mode, completed')
      .in('user_id', ids).eq('play_type', 'solo').gte('day', cutoff).lte('day', day)
      .in('game_mode', MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey).map((m) => m.dbKey as string)),
    admin.from('shield_gifts').select('sender_id, recipient_id, week_start, created_at')
      .or(`sender_id.in.(${ids.join(',')}),recipient_id.in.(${ids.join(',')})`)
      .gte('created_at', `${cutoff}T00:00:00Z`),
  ]);
  const { data: games } = await admin.from('friendly_games').select('id, kind, player_a, player_b, state, status, winner, updated_at')
    .in('status', ['done', 'resigned']).in('player_a', ids).in('player_b', ids)
    .gte('updated_at', `${cutoff}T00:00:00Z`).limit(60);

  const who = new Map<string, { username: string; avatar_url: string | null; avatar_emoji: string | null }>();
  for (const p of (profs ?? []) as any[]) who.set(p.id, { username: p.username, avatar_url: p.avatar_url ?? null, avatar_emoji: p.avatar_emoji ?? null });
  const person = (uid: string) => {
    const p = who.get(uid);
    return { userId: uid, username: p?.username ?? 'Player', avatar_url: p?.avatar_url ?? null, avatar_emoji: p?.avatar_emoji ?? null, me: uid === me };
  };
  const title = (gm?: string | null) => (gm ? MODE_BY_DBKEY[gm]?.title ?? gm : null);

  const events: FeedEvent[] = [];
  for (const b of (bonuses ?? []) as any[]) {
    events.push({
      id: `bonus-${b.user_id}-${b.day}`, ...person(b.user_id), day: b.day, at: b.updated_at ?? `${b.day}T23:59:00Z`,
      type: b.flawless_awarded ? 'flawless' : 'sweep',
    });
  }
  for (const m of (medals ?? []) as any[]) {
    events.push({
      id: `medal-${m.id}`, ...person(m.user_id), day: m.day, at: m.created_at ?? `${m.day}T23:59:00Z`,
      type: 'medal', kind: m.medal_type, gameMode: m.game_mode, gameTitle: title(m.game_mode), value: m.composite_score ?? null,
    });
  }
  // Only skill records make the feed: the rolling counters (most games played,
  // most dailies, highest level, most golds) re-set themselves almost daily and
  // read as noise (founder's Friends screenshot, 2026-09-26).
  const FEED_RECORD_TYPES = new Set(['fastest_win', 'fewest_guesses', 'longest_streak']);
  for (const r of (records ?? []) as any[]) {
    if (r.play_type && r.play_type !== 'solo') continue;
    if (!FEED_RECORD_TYPES.has(r.record_type)) continue;
    events.push({
      id: `record-${r.id}`, ...person(r.holder_id), day: (r.achieved_at as string).slice(0, 10), at: r.achieved_at,
      type: 'record', kind: r.record_type, gameMode: r.game_mode, gameTitle: title(r.game_mode), value: r.record_value ?? null,
    });
  }
  // More Games Sweep / Flawless: every More Games daily on one day (visual tier, never a bonus row).
  const moreTotal = MORE_GAME_MODES.filter((m) => m.dailyEligible && m.dbKey).length;
  if (moreTotal > 0) {
    const perDay = new Map<string, { played: Set<string>; won: number }>();
    for (const r of (moreRows ?? []) as any[]) {
      const k = `${r.user_id}|${r.day}`;
      let e = perDay.get(k);
      if (!e) { e = { played: new Set(), won: 0 }; perDay.set(k, e); }
      if (!e.played.has(r.game_mode)) { e.played.add(r.game_mode); if (r.completed) e.won += 1; }
    }
    for (const [k, e] of perDay) {
      if (e.played.size < moreTotal) continue;
      const [uid, d] = k.split('|');
      events.push({ id: `more-${k}`, ...person(uid), day: d, at: `${d}T23:58:00Z`, type: e.won >= moreTotal ? 'more_flawless' : 'more_sweep' });
    }
  }

  // Shield gifts (D3.4): shown from the sender's side, naming the recipient.
  for (const g of (gifts ?? []) as any[]) {
    const other = who.get(g.recipient_id);
    events.push({
      id: `gift-${g.sender_id}-${g.recipient_id}-${g.week_start}`, ...person(g.sender_id),
      day: (g.created_at as string).slice(0, 10), at: g.created_at, type: 'gift',
      otherName: g.recipient_id === me ? 'you' : other?.username ?? 'a friend', otherId: g.recipient_id,
    });
  }
  // Pocket games (Friends overhaul): shown from the winner's side, naming the other player.
  for (const g of (games ?? []) as any[]) {
    const winner: string | null = g.winner ?? null;
    const lead = winner ?? g.player_a;
    const otherId = lead === g.player_a ? g.player_b : g.player_a;
    const sc = g.state?.score as { a: number; b: number } | undefined;
    const leadSide = lead === g.player_a ? 'a' : 'b';
    const score = sc ? `${sc[leadSide]}–${sc[leadSide === 'a' ? 'b' : 'a']}` : null;
    events.push({
      id: `game-${g.id}`, ...person(lead), day: (g.updated_at as string).slice(0, 10), at: g.updated_at, type: 'game',
      kind: winner ? 'win' : 'draw', gameKind: g.kind, gameTitle: FRIENDLY_TITLES[g.kind as FriendlyKind] ?? null,
      otherName: otherId === me ? 'you' : who.get(otherId)?.username ?? 'a friend', otherId,
      score: g.status === 'resigned' ? 'by resignation' : g.kind === 'pass' ? null : score,
    });
  }
  events.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.at < b.at ? 1 : -1));
  const shown = events.slice(0, 40);

  // Reactions (fixed emoji set) on the moments shown.
  const reactions: Record<string, { counts: Record<string, number>; mine: string[] }> = {};
  if (shown.length > 0) {
    const { data: rx } = await admin.from('moment_reactions').select('moment_id, user_id, emoji').in('moment_id', shown.map((e) => e.id));
    for (const r of (rx ?? []) as Array<{ moment_id: string; user_id: string; emoji: string }>) {
      const slot = reactions[r.moment_id] ?? (reactions[r.moment_id] = { counts: {}, mine: [] });
      slot.counts[r.emoji] = (slot.counts[r.emoji] ?? 0) + 1;
      if (r.user_id === me) slot.mine.push(r.emoji);
    }
  }
  return NextResponse.json({ events: shown, reactions }, { headers: { 'Cache-Control': 'private, no-store' } });
}
