// Pure builders for the daily-leaderboard share card (LEADERBOARD SHARE
// feature). Turns the page's already-fetched leaderboard state into the
// ShareLeaderboardInput the canvas renderer consumes. Deliberately free of
// supabase/React imports (types only) so it runs under vitest's node
// environment — see leaderboard-share.test.ts. The fetch-and-share glue that
// pairs with this lives in leaderboard-share-flow.ts.

import type { LeaderboardEntry, SweepEntry } from './daily-service';
import type { FriendProfile } from './friends-service';
import type {
  ShareLeaderboardInput,
  ShareLeaderboardRowInput,
  ShareMode,
} from './share-image';
import { formatScore, tieAwareScoreLabels } from './composite-scoring';
import { formatShortTime } from './format';

/** A leaderboard entry with its display rank. Ranks come from the page (index
 *  + 1 with holes where blocked rows were) so the card can never disagree with
 *  the list the sharer is looking at. */
export interface RankedEntry {
  rank: number;
  entry: LeaderboardEntry;
}

/** Day #1 of the daily system — the daily/medals schema shipped 2026-04-07
 *  (supabase migration 20260407000001_create_daily_and_medals_system). Drives
 *  the "#123" puzzle number on the date chip. */
export const DAILY_PUZZLE_EPOCH = '2026-04-07';

/** 1-based daily puzzle number for a YYYY-MM-DD day; null for bad input or
 *  pre-epoch days (defensive — those never had a daily board). */
export function puzzleNumberForDay(day: string): number | null {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const e = DAILY_PUZZLE_EPOCH.split('-').map(Number);
  const n = Math.round(
    (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - Date.UTC(e[0], e[1] - 1, e[2])) / 86400000,
  ) + 1;
  return n >= 1 ? n : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug 7, 2026" from a YYYY-MM-DD day string (no Date/timezone involved). */
export function formatBoardDate(day: string): string {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return day;
  const mon = MONTHS[Number(m[2]) - 1];
  return mon ? `${mon} ${Number(m[3])}, ${m[1]}` : day;
}

function fmtClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The "▲3 vs yesterday" / "▼2 vs yesterday" pill. Omitted entirely (undefined)
 *  when the sharer didn't play yesterday or their rank is unchanged. */
export function buildRankDelta(
  yesterdayRank: number | null | undefined,
  todayRank: number,
): { text: string; improved: boolean } | undefined {
  if (yesterdayRank == null) return undefined;
  const d = yesterdayRank - todayRank;
  if (d === 0) return undefined;
  return d > 0
    ? { text: `▲${d} vs yesterday`, improved: true }
    : { text: `▼${-d} vs yesterday`, improved: false };
}

function soloSubline(e: LeaderboardEntry): string {
  return `${e.guess_count} guesses · ${fmtClock(e.time_seconds)} · ${e.completed ? 'Win' : 'Loss'}`;
}

function vsSubline(e: LeaderboardEntry): string {
  // W-L today. vs_losses excludes draws; older cached rows without the column
  // fall back to games-minus-wins.
  const losses = e.vs_losses ?? Math.max(0, e.vs_games - e.vs_wins);
  return `${e.vs_wins}-${losses} today`;
}

function toRow(
  r: RankedEntry,
  userId: string | null | undefined,
  subline: ((e: LeaderboardEntry) => string) | null,
  scoreLabels?: Map<number, string>,
): ShareLeaderboardRowInput {
  return {
    rank: r.rank,
    name: r.entry.username,
    scoreDisplay: scoreLabels?.get(r.entry.composite_score) ?? formatScore(r.entry.composite_score),
    subline: subline ? subline(r.entry) : undefined,
    isYou: !!userId && r.entry.user_id === userId,
  };
}

/** "11:15 AM" — local clock time for the snapshot stamp. */
export function formatClockTime(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

export interface DailyLeaderboardShareOpts {
  variant: 'solo' | 'vs';
  /** FRIENDS (§207): render the friends-board identity (indigo "FRIENDS
   *  LEADERBOARD", dense friend ranks). Sublines still follow `variant`. */
  friends?: boolean;
  mode: ShareMode;
  /** Snapshot moment for the "as of" stamp — injectable for tests; defaults to now. */
  now?: Date;
  /** Chip label from the mode catalog's shareLabel ("Classic Six"). */
  modeLabel: string;
  /** Board day (YYYY-MM-DD, local). */
  day: string;
  /** Block-filtered rows with their display ranks, top of the board first. */
  ranked: RankedEntry[];
  userId?: string | null;
  userRank?: { rank: number; totalPlayers: number } | null;
  /** Sharer's own row — needed for the full-stats you-row when they rank
   *  below the top 5. */
  userEntry?: LeaderboardEntry | null;
  /** Sharer's final rank yesterday (same mode/playType); null = didn't play. */
  yesterdayRank?: number | null;
}

/**
 * Today's-board card. Top 5 rows with full stats; if the sharer sits below the
 * top 5, the top rows compress to name+score and their highlighted full-stats
 * row follows a "• • •" divider with "#R of TOTAL". A sharer who hasn't played
 * today gets no you-row at all. Returns null for an empty board (the page
 * hides the button then anyway).
 */
export function buildDailyLeaderboardShareInput(
  opts: DailyLeaderboardShareOpts,
): ShareLeaderboardInput | null {
  const top = opts.ranked.slice(0, 5);
  if (top.length === 0) return null;

  const subline = opts.variant === 'vs' ? vsSubline : soloSubline;
  const youInTop = !!opts.userId && top.some((r) => r.entry.user_id === opts.userId);
  const belowTop = !youInTop && !!opts.userId && !!opts.userRank && !!opts.userEntry;
  const delta = opts.userRank ? buildRankDelta(opts.yesterdayRank, opts.userRank.rank) : undefined;

  const puzzle = puzzleNumberForDay(opts.day);
  // TIE-AWARE scores (board-page parity): rows sharing a whole number on THIS
  // card render the decimals that rank them — the sharer's below-fold row is
  // part of the same card, so it joins the collision set.
  const cardLabels = tieAwareScoreLabels([
    ...top.map((r) => r.entry.composite_score),
    ...(belowTop ? [opts.userEntry!.composite_score] : []),
  ]);
  const input: ShareLeaderboardInput = {
    layout: 'leaderboard',
    mode: opts.mode,
    variant: opts.friends ? 'friends' : opts.variant,
    modeChip: opts.variant === 'vs' ? `${opts.modeLabel} VS` : opts.modeLabel,
    // "as of h:mm" marks the card as a SNAPSHOT of a live board (founder,
    // Aug 7) — today's standings keep moving, and the stamp keeps the brag
    // honest forever. The settled Podium card says "· Final" instead.
    dateChip: `${formatBoardDate(opts.day)}${puzzle ? ` · #${puzzle}` : ''} · as of ${formatClockTime(opts.now ?? new Date())}`,
    // Sharer below the top 5 → compress the top rows to name+score only.
    rows: top.map((r) => toRow(r, opts.userId, belowTop ? null : subline, cardLabels)),
    footer: opts.friends
      ? 'Add your friends — play free at wordocious.com'
      : opts.variant === 'vs'
        ? 'Think you can take them? wordocious.com'
        : 'Can you beat them? Play free at wordocious.com',
    date: new Date(opts.day + 'T00:00:00'),
    delta,
    shareRank: opts.userRank?.rank,
    sharePlayers: opts.userRank?.totalPlayers,
  };

  if (belowTop) {
    input.you = {
      rank: opts.userRank!.rank,
      name: opts.userEntry!.username,
      scoreDisplay: cardLabels.get(opts.userEntry!.composite_score) ?? formatScore(opts.userEntry!.composite_score),
      subline: subline(opts.userEntry!),
      isYou: true,
    };
    input.youRankLine = `#${opts.userRank!.rank} of ${opts.userRank!.totalPlayers}`;
  }

  return input;
}

export interface YesterdayPodiumShareOpts {
  /** Which board the podium settles — drives the row sublines + swords chip. */
  playType: 'solo' | 'vs';
  /** FRIENDS (§207): the podium among friends — "FRIENDS PODIUM" identity. */
  friends?: boolean;
  mode: ShareMode;
  modeLabel: string;
  /** Yesterday's day string — the card is keyed and dated to it. */
  day: string;
  ranked: RankedEntry[];
  userId?: string | null;
  /** Sharer's FINAL rank yesterday ("#13 of N" line) — daily-card parity. */
  userRank?: { rank: number; totalPlayers: number } | null;
  /** Sharer's own yesterday row, for the below-top-5 highlighted row. */
  userEntry?: LeaderboardEntry | null;
}

/**
 * The settled variant for the Yesterday's Winners dropdown: "YESTERDAY'S
 * PODIUM" identity, "MMM D, YYYY · Final" date chip, top-5 rows with full
 * stats (daily-card parity, founder ask 2026-08-10). A sharer who finished
 * below the top 5 gets their highlighted row after a "• • •" divider with
 * "#R of TOTAL" — exactly like the daily leaderboard card. Returns null when
 * yesterday had no finishers.
 */
export function buildYesterdayPodiumShareInput(
  opts: YesterdayPodiumShareOpts,
): ShareLeaderboardInput | null {
  const top = opts.ranked.slice(0, 5);
  if (top.length === 0) return null;
  const subline = opts.playType === 'vs' ? vsSubline : soloSubline;
  const youInTop = !!opts.userId && top.some((r) => r.entry.user_id === opts.userId);
  const belowTop = !youInTop && !!opts.userId && !!opts.userRank && !!opts.userEntry;
  const cardLabels = tieAwareScoreLabels([
    ...top.map((r) => r.entry.composite_score),
    ...(belowTop ? [opts.userEntry!.composite_score] : []),
  ]);
  const input: ShareLeaderboardInput = {
    layout: 'leaderboard',
    mode: opts.mode,
    variant: opts.friends ? 'friendsPodium' : 'podium',
    modeChip: opts.playType === 'vs' ? `${opts.modeLabel} VS` : opts.modeLabel,
    dateChip: `${formatBoardDate(opts.day)} · Final`,
    rows: top.map((r) => toRow(r, opts.userId, belowTop ? null : subline, cardLabels)),
    footer: 'Today’s board is open — wordocious.com',
    date: new Date(opts.day + 'T00:00:00'),
    shareRank: opts.userRank?.rank,
    sharePlayers: opts.userRank?.totalPlayers,
  };
  if (belowTop) {
    input.you = {
      rank: opts.userRank!.rank,
      name: opts.userEntry!.username,
      scoreDisplay: cardLabels.get(opts.userEntry!.composite_score) ?? formatScore(opts.userEntry!.composite_score),
      subline: subline(opts.userEntry!),
      isYou: true,
    };
    input.youRankLine = `#${opts.userRank!.rank} of ${opts.userRank!.totalPlayers}`;
  }
  return input;
}

// ──────────────────────────────────────────────────────────────────────────
// SWEEP SHARE (§231): the Daily Sweep board, shared like every other board.
// ──────────────────────────────────────────────────────────────────────────

/** "12:34 · 8/9 · Flawless" — the sweep row's subline (mirrors the /daily
 *  sweep row: total time, modes won, sweep vs flawless). */
function sweepSubline(e: SweepEntry): string {
  return `${formatShortTime(e.total_time)} · ${e.modes_won}/9 · ${e.is_flawless ? 'Flawless' : 'Sweep'}`;
}

function sweepRow(e: SweepEntry, userId: string | null | undefined): ShareLeaderboardRowInput {
  return {
    // The RPC's tie-aware rank — the same number the page renders, so the
    // card can never disagree with the board the sharer is looking at.
    rank: e.rank,
    name: e.username,
    scoreDisplay: formatScore(e.total_score),
    subline: sweepSubline(e),
    isYou: !!userId && e.user_id === userId,
  };
}

const SWEEP_FOOTER = 'Can you sweep all nine? Play free at wordocious.com';

export interface DailySweepShareOpts {
  /** Board day (YYYY-MM-DD, local). */
  day: string;
  /** Block-filtered sweep rows, top of the board first (the page's ≤50). */
  entries: SweepEntry[];
  userId?: string | null;
  /** Sharer's sweep rank (getUserSweepRank) — drives "#R of N". */
  userRank?: { rank: number; totalPlayers: number } | null;
  /** Snapshot moment for the "as of" stamp — injectable for tests. */
  now?: Date;
}

/**
 * Today's Sweep-board card: top 5 rows with full sweep stats. A sharer below
 * the top 5 gets their highlighted you-row (from the board entries — the board
 * holds ≤50, and a sweeper outside it simply has no you-row) with "#R of N".
 * No "vs yesterday" delta: a sweep rank has no per-mode yesterday to compare
 * against. Returns null when nobody has swept yet.
 */
export function buildDailySweepShareInput(opts: DailySweepShareOpts): ShareLeaderboardInput | null {
  const top = opts.entries.slice(0, 5);
  if (top.length === 0) return null;
  const youInTop = !!opts.userId && top.some((e) => e.user_id === opts.userId);
  const userEntry = !youInTop && opts.userId && opts.userRank
    ? opts.entries.find((e) => e.user_id === opts.userId) ?? null
    : null;
  const puzzle = puzzleNumberForDay(opts.day);
  const input: ShareLeaderboardInput = {
    layout: 'leaderboard',
    mode: 'DailySweep',
    variant: 'sweep',
    modeChip: 'Daily Sweep',
    dateChip: `${formatBoardDate(opts.day)}${puzzle ? ` · #${puzzle}` : ''} · as of ${formatClockTime(opts.now ?? new Date())}`,
    rows: top.map((e) => sweepRow(e, opts.userId)),
    footer: SWEEP_FOOTER,
    date: new Date(opts.day + 'T00:00:00'),
    shareRank: opts.userRank?.rank,
    sharePlayers: opts.userRank?.totalPlayers,
  };
  if (userEntry) {
    input.you = sweepRow(userEntry, opts.userId);
    input.youRankLine = `#${opts.userRank!.rank} of ${opts.userRank!.totalPlayers}`;
  }
  return input;
}

export interface YesterdaySweepPodiumShareOpts {
  /** Yesterday's day string — the card is keyed and dated to it. */
  day: string;
  entries: SweepEntry[];
  userId?: string | null;
}

/**
 * Yesterday's settled Sweep podium: top 3 only, "· Final" chip. Null when
 * nobody swept yesterday.
 */
export function buildYesterdaySweepPodiumShareInput(
  opts: YesterdaySweepPodiumShareOpts,
): ShareLeaderboardInput | null {
  const top = opts.entries.slice(0, 3);
  if (top.length === 0) return null;
  return {
    layout: 'leaderboard',
    mode: 'DailySweep',
    variant: 'sweepPodium',
    modeChip: 'Daily Sweep',
    dateChip: `${formatBoardDate(opts.day)} · Final`,
    rows: top.map((e) => sweepRow(e, opts.userId)),
    footer: SWEEP_FOOTER,
    date: new Date(opts.day + 'T00:00:00'),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// WEEKLY RACE SHARE (§234): the friends weekly race — the founder wants to
// brag about the THIS WEEK'S RACE podium: a timestamped card of the current
// weekly standings plus how much time is left before Monday's reset.
// ──────────────────────────────────────────────────────────────────────────

/** Compact time-to-Monday-00:00-local — the same clock math as the friends
 *  panel's weekEndsLabel, compressed for the date chip: "6d 12:33" with a
 *  day or more left, "07:23:45" (ticking seconds matter) inside the last day. */
export function formatRaceTimeLeft(now: Date): string {
  const end = new Date(now);
  const dow = now.getDay(); // 0 Sun … 6 Sat
  end.setDate(now.getDate() + (dow === 0 ? 1 : 8 - dow)); // next Monday
  end.setHours(0, 0, 0, 0);
  const secs = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
  const d = Math.floor(secs / 86400);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(Math.floor((secs % 86400) / 3600));
  const mm = pad(Math.floor((secs % 3600) / 60));
  return d >= 1 ? `${d}d ${hh}:${mm}` : `${hh}:${mm}:${pad(secs % 60)}`;
}

/** Local YYYY-MM-DD of a Date — the card's storage-key day. */
function localDayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface WeeklyRaceShareOpts {
  /** The whole friends roster — the race is everyone, not just the podium 3. */
  friends: FriendProfile[];
  /** The sharer. The card shows their REAL username (the panel's "You" row
   *  would read as a stranger on someone else's phone). Null = signed-out /
   *  no profile — the card still builds from friends alone. */
  me: { id: string; username: string; weekPoints: number; todayPoints?: number } | null;
  /** Snapshot moment for the countdown + "as of" stamp — injectable for tests. */
  now?: Date;
}

/**
 * The friends weekly-race card: me + all friends sorted by weekPoints desc,
 * dense ranks 1..N, top 5 rows; a sharer below the top 5 gets the standard
 * highlighted you-row with "#R of N". The date chip carries the race clock —
 * "Aug 24, 2026 · 6d 12:33 left · as of 11:20 AM" — so the brag stays honest
 * as a snapshot of a race that's still running. Null when nobody has points
 * yet (a Monday-morning zero board isn't a brag).
 */
export function buildWeeklyRaceShareInput(opts: WeeklyRaceShareOpts): ShareLeaderboardInput | null {
  const entries = [
    ...(opts.me ? [{
      id: opts.me.id,
      username: opts.me.username,
      weekPoints: opts.me.weekPoints,
      todayPoints: opts.me.todayPoints ?? 0,
    }] : []),
    ...opts.friends.map((f) => ({
      id: f.id,
      username: f.username,
      weekPoints: f.weekPoints ?? 0,
      todayPoints: f.todayPoints ?? 0,
    })),
  ];
  if (!entries.some((e) => e.weekPoints > 0)) return null;

  // Dense ranks 1..N — same ordering the panel's podium sorts by.
  const ranked = [...entries]
    .sort((a, b) => b.weekPoints - a.weekPoints)
    .map((e, i) => ({ ...e, rank: i + 1 }));
  const row = (e: (typeof ranked)[number]): ShareLeaderboardRowInput => ({
    rank: e.rank,
    name: e.username,
    scoreDisplay: `${e.weekPoints.toLocaleString()} pts`,
    // Today's contribution keeps the weekly total feeling live.
    subline: e.todayPoints > 0 ? `${e.todayPoints.toLocaleString()} today` : undefined,
    isYou: !!opts.me && e.id === opts.me.id,
  });

  const now = opts.now ?? new Date();
  const top = ranked.slice(0, 5);
  const myRow = opts.me ? ranked.find((e) => e.id === opts.me!.id) ?? null : null;
  const belowTop = !!myRow && myRow.rank > 5;
  const input: ShareLeaderboardInput = {
    layout: 'leaderboard',
    mode: 'WeeklyRace',
    variant: 'weeklyRace',
    modeChip: 'Weekly Race',
    dateChip: `${formatBoardDate(localDayOf(now))} · ${formatRaceTimeLeft(now)} left · as of ${formatClockTime(now)}`,
    rows: top.map(row),
    footer: 'Think you can catch them? Play free at wordocious.com',
    date: now,
    shareRank: myRow?.rank,
    sharePlayers: myRow ? ranked.length : undefined,
  };
  if (belowTop) {
    input.you = row(myRow);
    input.youRankLine = `#${myRow.rank} of ${ranked.length}`;
  }
  return input;
}

/* ═══ FLAWLESS STREAK (§244) + TROPHY CASE (§245) ═══ */

/** Local-day arithmetic for the streak card's day rows. */
function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + delta);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export interface FlawlessStreakDayStats {
  day: string;
  timeSeconds: number;
  guesses: number;
  hints: number;
  points: number;
}

export interface FlawlessStreakShareOpts {
  /** Consecutive flawless days ending on anchorDay. Must be >= 1. */
  streak: number;
  /** The most recent flawless day (today, or yesterday if today isn't done). */
  anchorDay: string;
  bestStreak?: number;
  username?: string;
  /** §248: per-day stats (chronological not required — matched by day). */
  days?: FlawlessStreakDayStats[];
  now?: Date;
}

/**
 * §244/§248 (founder: the first cut "doesn't make sense and looks ugly" — he
 * wants "all of the stats like the sweep leaderboard shows along with the
 * dates"): one row per streak day, OLDEST FIRST so the run reads as growth,
 * each carrying the sweep-row stats (time · guesses · hints) and the day's
 * points; today rides last with the gold you-treatment. Rows are numbered by
 * day-of-streak (the renderer skips crown/medals for this variant — days
 * aren't competitors). Null when there is no streak.
 */
export function buildFlawlessStreakShareInput(opts: FlawlessStreakShareOpts): ShareLeaderboardInput | null {
  if (opts.streak < 1) return null;
  const now = opts.now ?? new Date();
  const statsByDay = new Map((opts.days ?? []).map((d) => [d.day, d]));
  // Chronological, capped to the 5 most recent (day-of-streak numbering keeps
  // the run's true length visible even when early days fall off).
  const shown = Math.min(opts.streak, 5);
  const rows: ShareLeaderboardRowInput[] = Array.from({ length: shown }, (_, i) => {
    const dayNumber = opts.streak - shown + i + 1;
    const day = shiftDay(opts.anchorDay, dayNumber - opts.streak);
    const st = statsByDay.get(day);
    const subline = st
      ? `${formatShortTime(st.timeSeconds)} · ${st.guesses} guess${st.guesses === 1 ? '' : 'es'}`
        + (st.hints > 0 ? ` · ${st.hints} hint${st.hints === 1 ? '' : 's'}` : '')
      : undefined;
    return {
      rank: dayNumber,
      name: formatBoardDate(day),
      scoreDisplay: st ? `${Math.round(st.points).toLocaleString('en-US')} pts` : '9/9 won',
      subline,
      isYou: i === shown - 1,
    };
  });
  const skipped = opts.streak - shown;
  const best = opts.bestStreak ?? 0;
  return {
    layout: 'leaderboard',
    mode: 'FlawlessStreak',
    variant: 'flawlessStreak',
    modeChip: `Flawless ×${opts.streak}`,
    dateChip: `${formatBoardDate(localDayOf(now))} · as of ${formatClockTime(now)}`,
    rows,
    footer: `${opts.streak} straight day${opts.streak === 1 ? '' : 's'} winning all nine`
      + (skipped > 0 ? ` (first ${skipped} not shown)` : '')
      + (best > opts.streak ? ` · best ${best}` : '')
      + ' · wordocious.com',
    date: now,
  };
}

/** §245: value formatting per record type — mirror of the Records page map
 *  (icons stay in the UI; the card only needs label + format). */
const TROPHY_LABELS: Record<string, { label: string; format: (v: number) => string; lowerIsBetter: boolean }> = {
  fastest_win: { label: 'Fastest Win', format: (v) => v < 60 ? `${v}s` : `${Math.floor(v / 60)}m ${v % 60}s`, lowerIsBetter: true },
  fewest_guesses: { label: 'Fewest Guesses', format: (v) => `${v} guesses`, lowerIsBetter: true },
  most_games_played: { label: 'Most Games Played', format: (v) => `${v} games`, lowerIsBetter: false },
  longest_streak: { label: 'Longest Streak', format: (v) => `${v} wins`, lowerIsBetter: false },
  most_gold_medals: { label: 'Most Gold Medals', format: (v) => `${v} golds`, lowerIsBetter: false },
  highest_level: { label: 'Highest Level', format: (v) => `Level ${v}`, lowerIsBetter: false },
  most_daily_completions: { label: 'Most Dailies Completed', format: (v) => `${v} dailies`, lowerIsBetter: false },
};
const TROPHY_ORDER = ['fastest_win', 'fewest_guesses', 'longest_streak', 'most_gold_medals', 'highest_level', 'most_games_played', 'most_daily_completions'];

export interface TrophyCaseShareOpts {
  records: Array<{ record_type: string; game_mode: string | null; record_value: number }>;
  /** dbKey → display title, resolved by the caller (keeps this file catalog-free). */
  modeTitle: (dbKey: string | null) => string;
  username?: string;
  now?: Date;
}

/**
 * §245: the trophy-case brag — the player's held all-time records, most
 * impressive first (fastest times, then fewest guesses, then the rest).
 * Null when nothing is held.
 */
export function buildTrophyCaseShareInput(opts: TrophyCaseShareOpts): ShareLeaderboardInput | null {
  if (opts.records.length === 0) return null;
  const now = opts.now ?? new Date();
  const sorted = [...opts.records].sort((a, b) => {
    const oa = TROPHY_ORDER.indexOf(a.record_type); const ob = TROPHY_ORDER.indexOf(b.record_type);
    if (oa !== ob) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
    const lower = TROPHY_LABELS[a.record_type]?.lowerIsBetter ?? false;
    return lower ? a.record_value - b.record_value : b.record_value - a.record_value;
  });
  const rows: ShareLeaderboardRowInput[] = sorted.slice(0, 5).map((r, i) => {
    const cfg = TROPHY_LABELS[r.record_type];
    return {
      rank: i + 1,
      name: `${opts.modeTitle(r.game_mode)} · ${cfg?.label ?? r.record_type}`,
      scoreDisplay: cfg ? cfg.format(r.record_value) : String(r.record_value),
      isYou: false,
    };
  });
  const extra = opts.records.length - rows.length;
  return {
    layout: 'leaderboard',
    mode: 'TrophyCase',
    variant: 'trophyCase',
    modeChip: opts.username ? `${opts.username}'s Records` : 'Trophy Case',
    dateChip: `${formatBoardDate(localDayOf(now))} · as of ${formatClockTime(now)}`,
    rows,
    footer: `${opts.records.length} all-time record${opts.records.length === 1 ? '' : 's'} held`
      + (extra > 0 ? ` (+${extra} more)` : '') + ' · wordocious.com',
    date: now,
  };
}
