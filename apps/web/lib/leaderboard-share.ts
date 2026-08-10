// Pure builders for the daily-leaderboard share card (LEADERBOARD SHARE
// feature). Turns the page's already-fetched leaderboard state into the
// ShareLeaderboardInput the canvas renderer consumes. Deliberately free of
// supabase/React imports (types only) so it runs under vitest's node
// environment — see leaderboard-share.test.ts. The fetch-and-share glue that
// pairs with this lives in leaderboard-share-flow.ts.

import type { LeaderboardEntry } from './daily-service';
import type {
  ShareLeaderboardInput,
  ShareLeaderboardRowInput,
  ShareMode,
} from './share-image';
import { formatScore, tieAwareScoreLabels } from './composite-scoring';

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
