'use client';

// Fetch-and-share glue for the daily-leaderboard Share buttons (/daily and the
// /records Daily tab). Pure card assembly lives in leaderboard-share.ts
// (tested); this file adds the two cheap lookups the card needs beyond the
// page's own state — the sharer's row when they rank below the visible list,
// and yesterday's final rank for the "▲N vs yesterday" delta pill — then fires
// the standard progressive share flow (PNG → share-images bucket → /s/ link →
// navigator.share/fallbacks) via shareResult.

import { shareResult, type ShareResultOutcome } from './share-utils';
import {
  fetchDailyLeaderboard,
  getUserDailyRank,
  type LeaderboardEntry,
} from './daily-service';
import {
  buildDailyLeaderboardShareInput,
  buildYesterdayPodiumShareInput,
  type RankedEntry,
} from './leaderboard-share';
import type { ShareMode } from './share-image';
import { MODES } from './modes.generated';

const SHARE_SURFACE = 'leaderboard';

function modeMeta(dbKey: string): { mode: ShareMode; label: string } | null {
  const m = MODES.find((x) => x.dbKey === dbKey);
  return m ? { mode: m.title as ShareMode, label: m.shareLabel } : null;
}

export interface ShareDailyLeaderboardOpts {
  /** DB mode key ('DUEL', 'DUEL_6', …). Sweep has no card — don't call for it. */
  dbMode: string;
  playType: 'solo' | 'vs';
  /** Today's local day (the board being shared). */
  day: string;
  /** Yesterday's local day — the delta pill's comparison board. */
  yesterday: string;
  /** Block-filtered rows with their display ranks, top of the board first. */
  ranked: RankedEntry[];
  userId?: string | null;
  userRank?: { rank: number; totalPlayers: number } | null;
  /** The sharer's row if the page already holds it (top-50 list / rank window). */
  userEntry?: LeaderboardEntry | null;
}

/** Share today's board (solo or VS variant per the page's toggle). Returns
 *  null when there's nothing to share (empty board / unknown mode). */
export async function shareDailyLeaderboardCard(
  opts: ShareDailyLeaderboardOpts,
): Promise<ShareResultOutcome | null> {
  const meta = modeMeta(opts.dbMode);
  if (!meta || opts.ranked.length === 0) return null;

  const inTop5 = !!opts.userId && opts.ranked.slice(0, 5).some((r) => r.entry.user_id === opts.userId);

  // Sharer ranks below the top 5 and the page doesn't hold their row → read a
  // small window around their offset in the same ranked ordering the board
  // uses (ties break by created_at, so the exact offset can land on a tied
  // neighbor — the window absorbs that). Not found → the card simply omits
  // the you-row.
  let userEntry = opts.userEntry ?? null;
  if (opts.userId && opts.userRank && !inTop5 && !userEntry) {
    try {
      const offset = Math.max(0, opts.userRank.rank - 6);
      const windowRows = await fetchDailyLeaderboard(opts.dbMode, opts.playType, opts.day, 11, offset);
      userEntry = windowRows.find((r) => r.user_id === opts.userId) ?? null;
    } catch {
      userEntry = null;
    }
  }

  // Yesterday's final rank for the delta pill — only meaningful when the
  // sharer is on today's board at all. Omitted (null) when they didn't play
  // yesterday, exactly per spec.
  let yesterdayRank: number | null = null;
  if (opts.userId && opts.userRank) {
    try {
      const y = await getUserDailyRank(opts.userId, opts.dbMode, opts.playType, opts.yesterday);
      yesterdayRank = y?.rank ?? null;
    } catch {
      yesterdayRank = null;
    }
  }

  const input = buildDailyLeaderboardShareInput({
    variant: opts.playType === 'vs' ? 'vs' : 'solo',
    mode: meta.mode,
    modeLabel: meta.label,
    day: opts.day,
    ranked: opts.ranked,
    userId: opts.userId,
    userRank: opts.userRank,
    userEntry,
    yesterdayRank,
  });
  if (!input) return null;
  return shareResult(input, SHARE_SURFACE, { linkOnly: true });
}

export interface ShareYesterdayPodiumOpts {
  dbMode: string;
  playType: 'solo' | 'vs';
  /** Yesterday's local day. */
  day: string;
  ranked: RankedEntry[];
  userId?: string | null;
}

/** Share yesterday's settled podium (top 3, "· Final" chip). */
export async function shareYesterdayPodiumCard(
  opts: ShareYesterdayPodiumOpts,
): Promise<ShareResultOutcome | null> {
  const meta = modeMeta(opts.dbMode);
  if (!meta) return null;
  const input = buildYesterdayPodiumShareInput({
    playType: opts.playType,
    mode: meta.mode,
    modeLabel: meta.label,
    day: opts.day,
    ranked: opts.ranked,
    userId: opts.userId,
  });
  if (!input) return null;
  return shareResult(input, SHARE_SURFACE, { linkOnly: true });
}
