import { supabase } from './supabase-client';
import { getTodayLocal, toLocalDayString } from './daily-service';

/**
 * Data layer for the "profile social" redesign — the public-profile identity
 * chips, You-vs-Them card, Trophy Case, Highlights reel and Lately feed.
 *
 * Two kinds of sources:
 *   (A) server endpoints (/api/profile/[id]/persona, /board) for aggregates
 *       that live behind the matches participants-only RLS policy;
 *   (B) direct client Supabase reads of daily_results / medals / profiles,
 *       which any signed-in user can read (the leaderboards already do).
 *
 * Every helper returns a safe empty value on error — the profile page renders
 * its existing content immediately and these cards fill in as data arrives.
 */

// ── Auth header for the /api/profile/[id]/* endpoints ───────────────────────
//
// PRIVATE PROFILES: those routes now gate on the target's is_private and
// identify the caller by Bearer token. The header is optional — anonymous
// viewers of public profiles still get data — but without it the OWNER (and
// admins) of a private profile would be gated out of their own deep stats.

export async function profileApiHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// ── Persona (server endpoint) ───────────────────────────────────────────────

export type Archetype = 'GRINDER' | 'SPEEDRUNNER' | 'SNIPER' | 'NIGHT_OWL' | 'CHALLENGER';

export interface Persona {
  archetype: Archetype;
  opener: { word: string; count: number; winRate: number } | null;
  longestWinStreak: number;
  bestPercentile: { mode: string; topPct: number } | null;
  nemesis: { userId: string; username: string; sharedBoards: number } | null;
  flawless: { count: number; pctOfPlayers: number };
}

export async function fetchPersona(id: string): Promise<Persona | null> {
  try {
    const r = await fetch(`/api/profile/${id}/persona`, { headers: await profileApiHeaders() });
    if (!r.ok) return null;
    return (await r.json()) as Persona;
  } catch {
    return null;
  }
}

// ── Guarded board (server endpoint, bearer-authed) ──────────────────────────

export interface GuardedBoard {
  seed: string;
  gameMode: string;
  guesses: string[];
  solutions: string[];
  timeSeconds: number;
  won: boolean;
  hintsUsed: number;
}

export type BoardFetchResult =
  | { status: 'ok'; board: GuardedBoard }
  | { status: 'locked' }
  | { status: 'error' };

export async function fetchGuardedBoard(targetId: string, seed: string): Promise<BoardFetchResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { status: 'error' };
    const r = await fetch(`/api/profile/${targetId}/board?seed=${encodeURIComponent(seed)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.status === 403) return { status: 'locked' };
    if (!r.ok) return { status: 'error' };
    return { status: 'ok', board: (await r.json()) as GuardedBoard };
  } catch {
    return { status: 'error' };
  }
}

// ── Head-to-head on shared dailies (client reads) ───────────────────────────

interface DailyRow {
  day: string;
  game_mode: string;
  guess_count: number;
  time_seconds: number;
  total_boards: number;
  composite_score: number;
}

async function fetchSoloDailies(userId: string, sinceDay: string): Promise<DailyRow[]> {
  const { data } = await (supabase as any)
    .from('daily_results')
    .select('day, game_mode, guess_count, time_seconds, total_boards, composite_score')
    .eq('user_id', userId)
    .eq('play_type', 'solo')
    .eq('completed', true)
    .gte('day', sinceDay)
    .order('day', { ascending: false })
    .limit(800) as { data: DailyRow[] | null };
  return data ?? [];
}

export interface H2HSharedBoard {
  day: string;
  mode: string;
  yourScore: number;
  theirScore: number;
  yourGuesses: number;
  theirGuesses: number;
  yourTime: number;
  theirTime: number;
}

export interface H2HSummary {
  youWin: number;
  theyWin: number;
  draws: number;
  monthYou: number;
  monthThey: number;
  shared: H2HSharedBoard[];
  avgGuessYou: number | null;
  avgGuessThem: number | null;
  avgTimeYou: number | null;
  avgTimeThem: number | null;
  sweepsYou: number;
  sweepsThem: number;
}

export const EMPTY_H2H: H2HSummary = {
  youWin: 0, theyWin: 0, draws: 0, monthYou: 0, monthThey: 0, shared: [],
  avgGuessYou: null, avgGuessThem: null, avgTimeYou: null, avgTimeThem: null,
  sweepsYou: 0, sweepsThem: 0,
};

const sweepDayCount = (rows: DailyRow[]): number => {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + 1);
  let n = 0;
  for (const c of byDay.values()) if (c >= 9) n++;
  return n;
};

/** Both players' completed solo dailies (last ~120 days), joined on (day, mode). */
export async function fetchH2H(viewerId: string, targetId: string): Promise<H2HSummary> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 120);
    const sinceDay = toLocalDayString(since);
    const [mine, theirs] = await Promise.all([
      fetchSoloDailies(viewerId, sinceDay),
      fetchSoloDailies(targetId, sinceDay),
    ]);

    const theirsByKey = new Map<string, DailyRow>();
    for (const r of theirs) theirsByKey.set(`${r.day}|${r.game_mode}`, r);

    const monthPrefix = getTodayLocal().slice(0, 7);
    const shared: H2HSharedBoard[] = [];
    let youWin = 0, theyWin = 0, draws = 0, monthYou = 0, monthThey = 0;
    let gYou = 0, gThem = 0, gN = 0, tYou = 0, tThem = 0, tN = 0;

    for (const m of mine) {
      const t = theirsByKey.get(`${m.day}|${m.game_mode}`);
      if (!t) continue;
      shared.push({
        day: m.day, mode: m.game_mode,
        yourScore: m.composite_score, theirScore: t.composite_score,
        yourGuesses: m.guess_count, theirGuesses: t.guess_count,
        yourTime: m.time_seconds, theirTime: t.time_seconds,
      });
      if (m.composite_score > t.composite_score) {
        youWin++;
        if (m.day.startsWith(monthPrefix)) monthYou++;
      } else if (t.composite_score > m.composite_score) {
        theyWin++;
        if (m.day.startsWith(monthPrefix)) monthThey++;
      } else {
        draws++;
      }
      if (m.total_boards === 1 && m.guess_count > 0 && t.guess_count > 0) {
        gYou += m.guess_count; gThem += t.guess_count; gN++;
      }
      if (m.time_seconds > 0 && t.time_seconds > 0) {
        tYou += m.time_seconds; tThem += t.time_seconds; tN++;
      }
    }
    shared.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));

    return {
      youWin, theyWin, draws, monthYou, monthThey, shared,
      avgGuessYou: gN ? Math.round((gYou / gN) * 10) / 10 : null,
      avgGuessThem: gN ? Math.round((gThem / gN) * 10) / 10 : null,
      avgTimeYou: tN ? Math.round(tYou / tN) : null,
      avgTimeThem: tN ? Math.round(tThem / tN) : null,
      sweepsYou: sweepDayCount(mine),
      sweepsThem: sweepDayCount(theirs),
    };
  } catch {
    return EMPTY_H2H;
  }
}

// ── Today's shared mode (client reads) ──────────────────────────────────────

export interface TodayCompare {
  mode: string;
  yourGuesses: number;
  theirGuesses: number;
}

/** First daily mode BOTH players have played today (local date), else null. */
export async function fetchTodayCompare(viewerId: string, targetId: string): Promise<TodayCompare | null> {
  try {
    const day = getTodayLocal();
    const { data } = await (supabase as any)
      .from('daily_results')
      .select('user_id, game_mode, guess_count, created_at')
      .in('user_id', [viewerId, targetId])
      .eq('day', day)
      .eq('play_type', 'solo')
      .order('created_at', { ascending: true }) as {
      data: Array<{ user_id: string; game_mode: string; guess_count: number }> | null;
    };
    const rows = data ?? [];
    const mineByMode = new Map<string, number>();
    for (const r of rows) if (r.user_id === viewerId && !mineByMode.has(r.game_mode)) mineByMode.set(r.game_mode, r.guess_count);
    for (const r of rows) {
      if (r.user_id !== targetId) continue;
      const mine = mineByMode.get(r.game_mode);
      if (mine !== undefined) return { mode: r.game_mode, yourGuesses: mine, theirGuesses: r.guess_count };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Today ring (client reads) ───────────────────────────────────────────────

export interface TodayRing { done: number; total: number }

/** Target's completed dailies today. Null when unreadable (e.g. signed out). */
export async function fetchTodayRing(targetId: string): Promise<TodayRing | null> {
  try {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) return null; // RLS would return 0 rows and lie
    const { count, error } = await (supabase as any)
      .from('daily_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .eq('day', getTodayLocal())
      .eq('play_type', 'solo')
      .eq('completed', true) as { count: number | null; error: unknown };
    if (error) return null;
    return { done: Math.min(count ?? 0, 9), total: 9 };
  } catch {
    return null;
  }
}

// ── Medals (client reads) ───────────────────────────────────────────────────

export interface MedalRow {
  day: string;
  game_mode: string;
  medal_type: string;
  composite_score: number;
}

export async function fetchMedalHistory(targetId: string): Promise<MedalRow[]> {
  try {
    const { data } = await (supabase as any)
      .from('medals')
      .select('day, game_mode, medal_type, composite_score')
      .eq('user_id', targetId)
      .eq('play_type', 'solo')
      .order('day', { ascending: false })
      .limit(100) as { data: MedalRow[] | null };
    return data ?? [];
  } catch {
    return [];
  }
}

export interface PodiumRow {
  userId: string;
  username: string;
  medal: string; // gold | silver | bronze
  score: number;
}

const MEDAL_ORDER: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

/** The gold/silver/bronze trio for one day+mode, usernames resolved. */
export async function fetchPodium(day: string, mode: string): Promise<PodiumRow[]> {
  try {
    const { data } = await (supabase as any)
      .from('medals')
      .select('user_id, medal_type, composite_score')
      .eq('day', day)
      .eq('game_mode', mode)
      .eq('play_type', 'solo') as {
      data: Array<{ user_id: string; medal_type: string; composite_score: number }> | null;
    };
    const rows = (data ?? []).sort(
      (a, b) => (MEDAL_ORDER[a.medal_type] ?? 9) - (MEDAL_ORDER[b.medal_type] ?? 9),
    );
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const { data: profs } = await (supabase as any)
      .from('profiles')
      .select('id, username')
      .in('id', ids) as { data: Array<{ id: string; username: string }> | null };
    const names = new Map((profs ?? []).map((p) => [p.id, p.username]));
    return rows.map((r) => ({
      userId: r.user_id,
      username: names.get(r.user_id) ?? 'Player',
      medal: r.medal_type,
      score: r.composite_score,
    }));
  } catch {
    return [];
  }
}

// ── Streak calendar (client reads) ──────────────────────────────────────────

export interface CalendarDay { day: string; played: boolean; completedCount: number }

/** Last 60 days (oldest → newest), one entry per day, empty days included. */
export async function fetchStreakCalendar(targetId: string): Promise<CalendarDay[]> {
  const days: CalendarDay[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ day: toLocalDayString(d), played: false, completedCount: 0 });
  }
  try {
    const sinceDay = days[0].day;
    const { data } = await (supabase as any)
      .from('daily_results')
      .select('day, completed')
      .eq('user_id', targetId)
      .eq('play_type', 'solo')
      .gte('day', sinceDay)
      .limit(800) as { data: Array<{ day: string; completed: boolean }> | null };
    const byDay = new Map(days.map((d) => [d.day, d]));
    for (const r of data ?? []) {
      const entry = byDay.get(r.day);
      if (!entry) continue;
      entry.played = true;
      if (r.completed) entry.completedCount++;
    }
    return days;
  } catch {
    return days;
  }
}

// ── Perfect OctoWord (client reads) ─────────────────────────────────────────

export async function fetchPerfectOcto(targetId: string): Promise<boolean> {
  try {
    const { count, error } = await (supabase as any)
      .from('daily_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', targetId)
      .eq('game_mode', 'OCTORDLE')
      .eq('boards_solved', 8) as { count: number | null; error: unknown };
    if (error) return false;
    return (count ?? 0) > 0;
  } catch {
    return false;
  }
}

// ── Lately feed (client reads) ──────────────────────────────────────────────

export interface LatelyEvent {
  id: string;
  emoji: string;
  text: string;
  when: string;
  /** Set for medal events — lets a row open that day's podium. */
  podium?: { day: string; mode: string };
}

const MEDAL_EMOJI: Record<string, string> = { gold: '\u{1F947}', silver: '\u{1F948}', bronze: '\u{1F949}' };

function relativeDayLabel(day: string): string {
  const today = getTodayLocal();
  if (day === today) return 'Today';
  const d = new Date();
  d.setDate(d.getDate() - 1);
  if (day === toLocalDayString(d)) return 'Yesterday';
  const parsed = new Date(`${day}T12:00:00`);
  const diffDays = Math.round((Date.now() - parsed.getTime()) / 86400000);
  if (diffDays < 7) return parsed.toLocaleDateString([], { weekday: 'long' });
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Up to 5 recent events: medals grouped per day + the current login streak. */
export async function fetchLately(targetId: string): Promise<LatelyEvent[]> {
  const events: LatelyEvent[] = [];
  try {
    const [{ data: medals }, { data: prof }] = await Promise.all([
      (supabase as any)
        .from('medals')
        .select('day, game_mode, medal_type')
        .eq('user_id', targetId)
        .eq('play_type', 'solo')
        .order('day', { ascending: false })
        .limit(60) as Promise<{ data: Array<{ day: string; game_mode: string; medal_type: string }> | null }>,
      (supabase as any)
        .from('profiles')
        .select('daily_login_streak')
        .eq('id', targetId)
        .maybeSingle() as Promise<{ data: { daily_login_streak: number | null } | null }>,
    ]);

    const streak = prof?.daily_login_streak ?? 0;
    if (streak > 0) {
      events.push({
        id: 'streak',
        emoji: '\u{1F525}',
        text: `On a ${streak}-day daily streak`,
        when: 'Now',
      });
    }

    // Group medals by (day, medal_type): "Won gold in N modes".
    const grouped = new Map<string, { day: string; medal: string; modes: string[] }>();
    for (const m of medals ?? []) {
      const k = `${m.day}|${m.medal_type}`;
      const e = grouped.get(k) ?? { day: m.day, medal: m.medal_type, modes: [] };
      e.modes.push(m.game_mode);
      grouped.set(k, e);
    }
    const dayGroups = [...grouped.values()].sort(
      (a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : (MEDAL_ORDER[a.medal] ?? 9) - (MEDAL_ORDER[b.medal] ?? 9)),
    );
    for (const g of dayGroups) {
      if (events.length >= 5) break;
      events.push({
        id: `${g.day}-${g.medal}`,
        emoji: MEDAL_EMOJI[g.medal] ?? '\u{1F3C5}',
        text: g.modes.length === 1
          ? `Won ${g.medal}`
          : `Won ${g.medal} in ${g.modes.length} modes`,
        when: relativeDayLabel(g.day),
        podium: { day: g.day, mode: g.modes[0] },
      });
    }
    return events.slice(0, 5);
  } catch {
    return events.slice(0, 5);
  }
}

// ── Presence ────────────────────────────────────────────────────────────────

export interface Presence {
  label: string;
  /** Under 2 minutes — drives the green pulse dot. */
  live: boolean;
}

export function presenceLabel(lastSeenAt: string | null | undefined): Presence | null {
  if (!lastSeenAt) return null;
  const t = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 2) return { label: 'Playing now', live: true };
  if (mins < 60) return { label: `Played ${mins} minute${mins === 1 ? '' : 's'} ago`, live: true };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `Played ${hours} hour${hours === 1 ? '' : 's'} ago`, live: false };
  return {
    label: `Last seen ${new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
    live: false,
  };
}
