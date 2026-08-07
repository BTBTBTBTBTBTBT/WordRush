import { describe, it, expect } from 'vitest';
import {
  buildDailyLeaderboardShareInput,
  buildYesterdayPodiumShareInput,
  buildRankDelta,
  puzzleNumberForDay,
  formatBoardDate,
  type RankedEntry,
} from './leaderboard-share';
import type { LeaderboardEntry } from './daily-service';

// Pure card-assembly logic for the LEADERBOARD SHARE feature. Pins the
// approved-mock invariants: top-5 full stats vs compressed-plus-you-row
// layouts, the omit-rules for the you-row and the rank-delta pill, and the
// date chip's "#puzzle" / "Final" identity.

function entry(overrides: Partial<LeaderboardEntry> & { user_id: string; username: string }): LeaderboardEntry {
  return {
    avatar_url: null,
    composite_score: 1000,
    guess_count: 4,
    time_seconds: 224,
    boards_solved: 1,
    total_boards: 1,
    hints_used: 0,
    vs_wins: 0,
    vs_losses: 0,
    vs_games: 0,
    completed: true,
    ...overrides,
  };
}

function board(n: number): RankedEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    entry: entry({ user_id: `u${i + 1}`, username: `player${i + 1}`, composite_score: 2000 - i * 100 }),
  }));
}

describe('puzzleNumberForDay', () => {
  it('anchors #1 on the daily system launch day', () => {
    expect(puzzleNumberForDay('2026-04-07')).toBe(1);
  });
  it('counts calendar days since the epoch', () => {
    expect(puzzleNumberForDay('2026-08-07')).toBe(123);
  });
  it('rejects bad input and pre-epoch days', () => {
    expect(puzzleNumberForDay('garbage')).toBeNull();
    expect(puzzleNumberForDay('2026-04-06')).toBeNull();
  });
});

describe('formatBoardDate', () => {
  it('renders MMM D, YYYY', () => {
    expect(formatBoardDate('2026-08-07')).toBe('Aug 7, 2026');
  });
});

describe('buildRankDelta', () => {
  it('is omitted entirely when the sharer did not play yesterday', () => {
    expect(buildRankDelta(null, 2)).toBeUndefined();
    expect(buildRankDelta(undefined, 2)).toBeUndefined();
  });
  it('is omitted when the rank is unchanged', () => {
    expect(buildRankDelta(5, 5)).toBeUndefined();
  });
  it('marks an improvement as ▲N (green) and a drop as ▼N (red)', () => {
    expect(buildRankDelta(5, 2)).toEqual({ text: '▲3 vs yesterday', improved: true });
    expect(buildRankDelta(2, 5)).toEqual({ text: '▼3 vs yesterday', improved: false });
  });
});

describe('buildDailyLeaderboardShareInput', () => {
  it('returns null for an empty board', () => {
    expect(
      buildDailyLeaderboardShareInput({
        variant: 'solo', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-07', ranked: [],
      }),
    ).toBeNull();
  });

  it('renders the top 5 with full stats and no you-row when the sharer has not played', () => {
    const input = buildDailyLeaderboardShareInput({
      variant: 'solo', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-07',
      ranked: board(8), userId: 'stranger', userRank: null,
      now: new Date('2026-08-07T11:15:00'),
    })!;
    expect(input.rows).toHaveLength(5);
    expect(input.rows[0].subline).toBe('4 guesses · 3:44 · Win');
    expect(input.rows[0].scoreDisplay).toBe('2,000');
    expect(input.you).toBeUndefined();
    expect(input.delta).toBeUndefined();
    expect(input.modeChip).toBe('Classic');
    expect(input.dateChip).toBe('Aug 7, 2026 · #123 · as of 11:15 AM');
    expect(input.footer).toBe('Can you beat them? Play free at wordocious.com');
  });

  it('highlights the sharer inside the top 5 and attaches the delta', () => {
    const input = buildDailyLeaderboardShareInput({
      variant: 'solo', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-07',
      ranked: board(5), userId: 'u2',
      userRank: { rank: 2, totalPlayers: 87 }, yesterdayRank: 5,
    })!;
    expect(input.rows[1].isYou).toBe(true);
    expect(input.rows[1].subline).toBeDefined(); // full stats kept
    expect(input.you).toBeUndefined();           // no separate you-row
    expect(input.delta).toEqual({ text: '▲3 vs yesterday', improved: true });
    expect(input.shareRank).toBe(2);
  });

  it('compresses the top 5 and appends the full-stats you-row below the divider', () => {
    const me = entry({ user_id: 'me', username: 'brian', composite_score: 900, guess_count: 5, time_seconds: 301, completed: false });
    const input = buildDailyLeaderboardShareInput({
      variant: 'solo', mode: 'Six', modeLabel: 'Classic Six', day: '2026-08-07',
      ranked: board(8), userId: 'me',
      userRank: { rank: 12, totalPlayers: 87 }, userEntry: me, yesterdayRank: 10,
    })!;
    expect(input.rows.every((r) => r.subline === undefined)).toBe(true); // name+score only
    expect(input.you).toMatchObject({
      rank: 12, name: 'brian', isYou: true, subline: '5 guesses · 5:01 · Loss',
    });
    expect(input.youRankLine).toBe('#12 of 87');
    expect(input.delta).toEqual({ text: '▼2 vs yesterday', improved: false });
  });

  it('renders the VS identity: swords chip, W-L sublines, VS footer', () => {
    const ranked: RankedEntry[] = [
      { rank: 1, entry: entry({ user_id: 'v1', username: 'ace', composite_score: 350, vs_wins: 3, vs_losses: 1, vs_games: 4 }) },
    ];
    const input = buildDailyLeaderboardShareInput({
      variant: 'vs', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-07', ranked,
    })!;
    expect(input.variant).toBe('vs');
    expect(input.modeChip).toBe('Classic VS');
    expect(input.rows[0].subline).toBe('3-1 today');
    expect(input.footer).toBe('Think you can take them? wordocious.com');
  });

  it('renders the FRIENDS identity (§207): friends variant, dense friend ranks, invite footer', () => {
    const ranked: RankedEntry[] = [
      { rank: 1, entry: entry({ user_id: 'f1', username: 'doug', composite_score: 2100 }) },
      { rank: 2, entry: entry({ user_id: 'me', username: 'brian', composite_score: 2000 }) },
    ];
    const input = buildDailyLeaderboardShareInput({
      variant: 'solo', friends: true, mode: 'Classic', modeLabel: 'Classic', day: '2026-08-08',
      ranked, userId: 'me', userRank: { rank: 2, totalPlayers: 2 },
    })!;
    expect(input.variant).toBe('friends');
    expect(input.modeChip).toBe('Classic'); // sublines/chip still solo-flavored
    expect(input.shareRank).toBe(2);
    expect(input.sharePlayers).toBe(2); // r/tp = friend rank of friend count
    expect(input.footer).toBe('Add your friends — play free at wordocious.com');
  });
});

describe('buildYesterdayPodiumShareInput', () => {
  it('builds the settled top-3 card with full stats and the Final chip', () => {
    const input = buildYesterdayPodiumShareInput({
      playType: 'solo', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-06',
      ranked: board(3), userId: 'u3',
    })!;
    expect(input.variant).toBe('podium');
    expect(input.rows).toHaveLength(3);
    expect(input.rows.every((r) => r.subline !== undefined)).toBe(true);
    expect(input.rows[2].isYou).toBe(true);
    expect(input.dateChip).toBe('Aug 6, 2026 · Final');
    expect(input.footer).toBe('Today’s board is open — wordocious.com');
  });

  it('renders the friendsPodium variant when the toggle is on (§207)', () => {
    const input = buildYesterdayPodiumShareInput({
      playType: 'solo', friends: true, mode: 'Classic', modeLabel: 'Classic', day: '2026-08-06',
      ranked: board(3), userId: 'u3',
    })!;
    expect(input.variant).toBe('friendsPodium');
    expect(input.dateChip).toBe('Aug 6, 2026 · Final');
  });

  it('returns null when yesterday had no finishers', () => {
    expect(
      buildYesterdayPodiumShareInput({
        playType: 'solo', mode: 'Classic', modeLabel: 'Classic', day: '2026-08-06', ranked: [],
      }),
    ).toBeNull();
  });
});
