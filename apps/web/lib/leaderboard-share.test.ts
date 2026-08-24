import { describe, it, expect } from 'vitest';
import {
  buildDailyLeaderboardShareInput,
  buildDailySweepShareInput,
  buildWeeklyRaceShareInput,
  buildYesterdayPodiumShareInput,
  buildYesterdaySweepPodiumShareInput,
  buildRankDelta,
  formatRaceTimeLeft,
  puzzleNumberForDay,
  formatBoardDate,
  type RankedEntry,
} from './leaderboard-share';
import type { LeaderboardEntry, SweepEntry } from './daily-service';
import type { FriendProfile } from './friends-service';

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

// SWEEP SHARE (§231): the Sweep board shares like every other board. Rows
// carry the RPC's tie-aware rank and the sweep subline; the you-row comes
// from the board itself (no fetch), and there's no vs-yesterday delta.
function sweepBoard(n: number, overrides: Partial<SweepEntry>[] = []): SweepEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    user_id: `u${i + 1}`,
    username: `sweeper${i + 1}`,
    avatar_url: null,
    total_score: 9000 - i * 100,
    total_time: 754 + i,
    modes_won: 9 - (i % 2),
    is_flawless: i % 2 === 0,
    rank: i + 1,
    ...overrides[i],
  }));
}

describe('buildDailySweepShareInput (§231)', () => {
  it('renders the sweep variant with DailySweep identity and sweep-stat sublines', () => {
    const input = buildDailySweepShareInput({
      day: '2026-08-23', entries: sweepBoard(7), userId: 'u2',
      userRank: { rank: 2, totalPlayers: 7 }, now: new Date(2026, 7, 23, 11, 15),
    })!;
    expect(input.variant).toBe('sweep');
    expect(input.mode).toBe('DailySweep');
    expect(input.modeChip).toBe('Daily Sweep');
    expect(input.dateChip).toBe('Aug 23, 2026 · #139 · as of 11:15 AM');
    expect(input.rows).toHaveLength(5);
    expect(input.rows[0]).toEqual({
      rank: 1, name: 'sweeper1', scoreDisplay: '9,000', subline: '12m 34s · 9/9 · Flawless', isYou: false,
    });
    expect(input.rows[1].subline).toBe('12m 35s · 8/9 · Sweep');
    expect(input.rows[1].isYou).toBe(true);
    expect(input.you).toBeUndefined();
    expect(input.delta).toBeUndefined();
    expect(input.shareRank).toBe(2);
    expect(input.sharePlayers).toBe(7);
    expect(input.footer).toBe('Can you sweep all nine? Play free at wordocious.com');
  });

  it('uses the RPC tie-aware rank on rows, not the list index', () => {
    const input = buildDailySweepShareInput({
      day: '2026-08-23',
      entries: sweepBoard(3, [{}, { total_score: 9000, rank: 1 }, { rank: 3 }]),
    })!;
    expect(input.rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it('adds the you-row + "#R of N" for a sharer below the top 5 who is on the board', () => {
    const input = buildDailySweepShareInput({
      day: '2026-08-23', entries: sweepBoard(9), userId: 'u8', userRank: { rank: 8, totalPlayers: 40 },
    })!;
    expect(input.rows).toHaveLength(5);
    expect(input.you?.name).toBe('sweeper8');
    expect(input.you?.isYou).toBe(true);
    expect(input.youRankLine).toBe('#8 of 40');
  });

  it('omits the you-row when the sharer is not among the board entries', () => {
    const input = buildDailySweepShareInput({
      day: '2026-08-23', entries: sweepBoard(6), userId: 'u99', userRank: { rank: 70, totalPlayers: 80 },
    })!;
    expect(input.you).toBeUndefined();
    expect(input.youRankLine).toBeUndefined();
    expect(input.shareRank).toBe(70);
  });

  it('returns null when nobody has swept', () => {
    expect(buildDailySweepShareInput({ day: '2026-08-23', entries: [] })).toBeNull();
  });
});

describe('buildYesterdaySweepPodiumShareInput (§231)', () => {
  it('renders the top 3 only with the Final chip', () => {
    const input = buildYesterdaySweepPodiumShareInput({
      day: '2026-08-22', entries: sweepBoard(6), userId: 'u3',
    })!;
    expect(input.variant).toBe('sweepPodium');
    expect(input.mode).toBe('DailySweep');
    expect(input.rows).toHaveLength(3);
    expect(input.rows[2].isYou).toBe(true);
    expect(input.rows[2].subline).toBe('12m 36s · 9/9 · Flawless');
    expect(input.dateChip).toBe('Aug 22, 2026 · Final');
    expect(input.you).toBeUndefined();
    expect(input.footer).toBe('Can you sweep all nine? Play free at wordocious.com');
  });

  it('returns null when nobody swept yesterday', () => {
    expect(buildYesterdaySweepPodiumShareInput({ day: '2026-08-22', entries: [] })).toBeNull();
  });
});

// WEEKLY RACE SHARE (§234): the friends weekly race — me + all friends by
// weekPoints, dense ranks, a countdown-bearing date chip.
function friend(overrides: Partial<FriendProfile> & { id: string; username: string }): FriendProfile {
  return { avatar_url: null, level: 5, ...overrides };
}

describe('formatRaceTimeLeft (§234)', () => {
  it('compresses to "Nd HH:MM" with a day or more until Monday 00:00', () => {
    // Mon Aug 24 2026, 11:20 AM local → next Monday Aug 31 00:00 = 6d 12:40.
    expect(formatRaceTimeLeft(new Date(2026, 7, 24, 11, 20, 0))).toBe('6d 12:40');
  });
  it('ticks HH:MM:SS inside the last day', () => {
    // Sun Aug 30 2026, 16:36:15 → Monday 00:00 = 07:23:45.
    expect(formatRaceTimeLeft(new Date(2026, 7, 30, 16, 36, 15))).toBe('07:23:45');
  });
});

describe('buildWeeklyRaceShareInput (§234)', () => {
  const me = { id: 'me', username: 'brian', weekPoints: 4200, todayPoints: 350 };

  it('renders the weeklyRace identity: me + friends by weekPoints, dense ranks, countdown chip', () => {
    const input = buildWeeklyRaceShareInput({
      friends: [
        friend({ id: 'f1', username: 'doug', weekPoints: 5100, todayPoints: 0 }),
        friend({ id: 'f2', username: 'carlie', weekPoints: 3900, todayPoints: 120 }),
      ],
      me,
      now: new Date(2026, 7, 24, 11, 20, 0),
    })!;
    expect(input.variant).toBe('weeklyRace');
    expect(input.mode).toBe('WeeklyRace');
    expect(input.modeChip).toBe('Weekly Race');
    expect(input.dateChip).toBe('Aug 24, 2026 · 6d 12:40 left · as of 11:20 AM');
    expect(input.rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(input.rows[0]).toEqual({
      rank: 1, name: 'doug', scoreDisplay: '5,100 pts', subline: undefined, isYou: false,
    });
    // The sharer's row wears their REAL username, not the panel's 'You'.
    expect(input.rows[1]).toEqual({
      rank: 2, name: 'brian', scoreDisplay: '4,200 pts', subline: '350 today', isYou: true,
    });
    expect(input.rows[2].subline).toBe('120 today');
    expect(input.you).toBeUndefined();
    expect(input.shareRank).toBe(2);
    expect(input.sharePlayers).toBe(3);
    expect(input.footer).toBe('Think you can catch them? Play free at wordocious.com');
  });

  it('caps the card at 5 rows and appends the you-row + "#R of N" for a sharer below the top 5', () => {
    const input = buildWeeklyRaceShareInput({
      friends: Array.from({ length: 7 }, (_, i) =>
        friend({ id: `f${i + 1}`, username: `racer${i + 1}`, weekPoints: 9000 - i * 500 })),
      me: { id: 'me', username: 'brian', weekPoints: 100 },
      now: new Date(2026, 7, 24, 11, 20, 0),
    })!;
    expect(input.rows).toHaveLength(5);
    expect(input.rows.every((r) => !r.isYou)).toBe(true);
    expect(input.you).toMatchObject({ rank: 8, name: 'brian', scoreDisplay: '100 pts', isYou: true });
    // A zero-today sharer gets no subline — the weekly total is the row.
    expect(input.you?.subline).toBeUndefined();
    expect(input.youRankLine).toBe('#8 of 8');
    expect(input.shareRank).toBe(8);
    expect(input.sharePlayers).toBe(8);
  });

  it('builds from friends alone when the sharer has no profile (no isYou, no rank chrome)', () => {
    const input = buildWeeklyRaceShareInput({
      friends: [friend({ id: 'f1', username: 'doug', weekPoints: 500 })],
      me: null,
      now: new Date(2026, 7, 24, 11, 20, 0),
    })!;
    expect(input.rows).toHaveLength(1);
    expect(input.rows[0].isYou).toBe(false);
    expect(input.shareRank).toBeUndefined();
    expect(input.sharePlayers).toBeUndefined();
    expect(input.you).toBeUndefined();
  });

  it('returns null when nobody has points yet (a Monday-morning zero board is no brag)', () => {
    expect(buildWeeklyRaceShareInput({
      friends: [friend({ id: 'f1', username: 'doug', weekPoints: 0 })],
      me: { id: 'me', username: 'brian', weekPoints: 0 },
    })).toBeNull();
    expect(buildWeeklyRaceShareInput({ friends: [], me: null })).toBeNull();
  });
});
