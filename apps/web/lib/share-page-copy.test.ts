import { describe, it, expect } from 'vitest';
import {
  boardDayStatus,
  buildCopy,
  parseLeaderboardShare,
  parseShareKey,
} from './share-page-copy';

// Unfurl copy for the /s/[...key] share landing page. These strings become
// og:title / og:description, so the assertions pin two invariants:
//   1. never leak puzzle letters (colors-only stats), and
//   2. never emit bogus "X/0 · 0:00" stats when the query string is missing.

const KEY = ['3f2a1b00-0000-0000-0000-000000000000', 'Six-2026-08-05'];

describe('parseShareKey', () => {
  it('recovers mode and date from the storage key', () => {
    expect(parseShareKey(KEY)).toEqual({ mode: 'Six', date: '2026-08-05' });
  });

  it('strips the -full variant suffix', () => {
    expect(parseShareKey(['u', 'OctoWord-full-2026-08-05']))
      .toEqual({ mode: 'OctoWord', date: '2026-08-05' });
  });

  it('returns nothing for unrecognized keys', () => {
    expect(parseShareKey(['just-a-key'])).toEqual({});
    expect(parseShareKey([])).toEqual({});
  });
});

describe('buildCopy', () => {
  it('builds a solved single-board card from query params', () => {
    const c = buildCopy({ m: 'Six', won: '1', g: '4', mg: '6', t: '224' }, KEY);
    expect(c.title).toBe('Wordocious Classic Six — Solved 4/6 · 3:44');
    expect(c.description).toBe(
      'I solved Classic Six on Wordocious (4/6 · 3:44). Can you beat it? Play today’s puzzles free at wordocious.com.',
    );
    expect(c.won).toBe(true);
  });

  it('lists score, time and mistakes by name for mistake-scored modes (Sudocious, Starsweep)', () => {
    const c = buildCopy({ m: 'Sudocious', won: '1', g: '2', mg: '4', t: '976', pts: '1909', n: '1' }, ['u', 'Sudocious-2026-09-22']);
    expect(c.title).toBe('Wordocious Sudocious #1 — Score 1,909 pts · Time 16:16 · 1 mistake');
    expect(c.description).toBe(
      'I solved Sudocious #1 on Wordocious — Score 1,909 pts · Time 16:16 · 1 mistake. Can you beat it? Play today’s puzzles free at wordocious.com.',
    );
    const lost = buildCopy({ m: 'Starsweep', won: '0', g: '4', mg: '4', t: '130', n: '3' }, ['u', 'Starsweep-2026-09-22']);
    expect(lost.title).toBe('Wordocious Starsweep #3 — Time 2:10 · Out of mistakes');
    const noPts = buildCopy({ m: 'Sudocious', won: '1', g: '1', mg: '4', t: '60' }, ['u', 'Sudocious-2026-09-22']);
    expect(noPts.title).toBe('Wordocious Sudocious — Time 1:00 · 0 mistakes');
    // Links shared before the 2026-09-23 rename carry the old label: they
    // still unfurl as Sudocious and route to /sudocious.
    const legacy = buildCopy({ m: 'Sudoku', won: '1', g: '1', mg: '4', t: '60' }, ['u', 'Sudoku-2026-09-22']);
    expect(legacy.mode).toBe('Sudocious');
    expect(legacy.title).toBe('Wordocious Sudocious — Time 1:00 · 0 mistakes');
  });

  it('names score, time and par for Letter Ladder', () => {
    const c = buildCopy({ m: 'Letter Ladder', won: '1', g: '2', mg: '6', t: '130', pts: '1850', n: '4', par: '5' }, ['u', 'Letter Ladder-2026-09-26']);
    expect(c.title).toBe('Wordocious Letter Ladder #4 — Score 1,850 pts · Time 2:10 · Par 5 · +1 over par');
    const par = buildCopy({ m: 'Letter Ladder', won: '1', g: '1', mg: '6', t: '90', par: '4' }, ['u', 'Letter Ladder-2026-09-26']);
    expect(par.title).toBe('Wordocious Letter Ladder — Time 1:30 · Par 4 · On par');
    const lost = buildCopy({ m: 'Letter Ladder', won: '0', g: '6', mg: '6', t: '300', n: '2', par: '5' }, ['u', 'Letter Ladder-2026-09-26']);
    expect(lost.title).toBe('Wordocious Letter Ladder #2 — Time 5:00 · Par 5 · Out of moves');
  });

  it('names score, time, words found and misses for Spyglass', () => {
    const c = buildCopy({ m: 'Spyglass', won: '1', g: '11', mg: '15', t: '165', pts: '1700', n: '2', bs: '10', tb: '10' }, ['u', 'Spyglass-2026-09-24']);
    expect(c.title).toBe('Wordocious Spyglass #2 — Score 1,700 pts · Time 2:45 · 10/10 found · 1 miss');
    const lost = buildCopy({ m: 'Spyglass', won: '0', g: '10', mg: '15', t: '300', bs: '6', tb: '10' }, ['u', 'Spyglass-2026-09-24']);
    expect(lost.title).toBe('Wordocious Spyglass — Time 5:00 · 6/10 found · 0 misses');
  });

  it('names the rank, percentage and words for Hubbub', () => {
    const c = buildCopy({ m: 'Hubbub', won: '1', g: '3', mg: '10', t: '600', pts: '1650', n: '5', pct: '72', bs: '18', tb: '25' }, ['u', 'Hubbub-2026-09-27']);
    expect(c.title).toBe('Wordocious Hubbub #5 — Rank Uproar · 72% of the maximum · 18/25 words · Score 1,650 pts');
    const lost = buildCopy({ m: 'Hubbub', won: '0', g: '7', mg: '10', t: '300', pct: '21' }, ['u', 'Hubbub-2026-09-27']);
    expect(lost.title).toBe('Wordocious Hubbub — Rank Banter · 21% of the maximum');
  });

  it('builds a multi-board card with boards solved', () => {
    const c = buildCopy(
      { m: 'OctoWord', won: '1', g: '12', mg: '13', t: '600', bs: '8', tb: '8' },
      ['u', 'OctoWord-2026-08-05'],
    );
    expect(c.title).toBe('Wordocious OctoWord — Solved 8/8 boards · 12/13 · 10:00');
  });

  it('builds the flawless Daily Sweep card', () => {
    const c = buildCopy(
      { m: 'DailySweep', sweep: 'flawless', won: '9', tot: '9', t: '1200', pts: '12345' },
      ['u', 'DailySweep-2026-08-05'],
    );
    expect(c.title).toBe('Wordocious Flawless Victory — 9/9 won · 20:00 · 12,345 pts');
    expect(c.description).toContain('Can you go flawless?');
  });

  it('falls back to path mode + date when the query string is stripped', () => {
    const c = buildCopy({}, KEY);
    expect(c.title).toBe('Wordocious — Classic Six · Aug 5, 2026');
    expect(c.description).toBe(
      'A Classic Six result on Wordocious. Can you beat it? Play today’s puzzles free at wordocious.com.',
    );
    // The old behavior invented "Played X/0 · 0:00" — pin that it is gone.
    expect(c.title).not.toContain('X/0');
    expect(c.title).not.toContain('0:00');
  });

  it('builds the profile card from the v cache-buster when present', () => {
    const c = buildCopy({ m: 'Profile', v: 'p152-9-23' }, ['u', 'Profile-2026-08-05']);
    expect(c.title).toBe('Wordocious Player Profile — 152 wins · 9-day streak');
  });

  it('builds a generic profile card when v is unparseable', () => {
    const c = buildCopy({ m: 'Profile' }, ['u', 'Profile-2026-08-05']);
    expect(c.title).toBe('Wordocious Player Profile');
    expect(c.description).toContain('wordocious.com');
  });

  it('degrades to plain branding for a fully unrecognized URL', () => {
    const c = buildCopy({}, ['garbage']);
    expect(c.title).toBe('Wordocious — Daily Word Puzzles');
    expect(c.description).toContain('wordocious.com');
  });
});

// LEADERBOARD SHARE kinds: storage keys read `<kind>-<Mode>-<date>` and the
// query carries m=<kind> & lm=<Mode> (+ r/tp = the sharer's rank/total).
describe('buildCopy — leaderboard cards', () => {
  const LB_KEY = ['u', 'Leaderboard-Classic-2026-08-07'];

  it('parses the leaderboard storage key (kind + board mode + date)', () => {
    expect(parseShareKey(LB_KEY)).toEqual({ mode: 'Leaderboard-Classic', date: '2026-08-07' });
  });

  it('builds the daily-leaderboard card with the sharer ranked', () => {
    const c = buildCopy({ m: 'Leaderboard', lm: 'Classic', r: '2', tp: '87' }, LB_KEY);
    expect(c.title).toBe('Wordocious Daily Leaderboard — Classic Aug 7');
    expect(c.description).toBe(
      'I’m #2 on today’s Classic board. Can you beat me? Play today’s puzzles free at wordocious.com.',
    );
  });

  it('invites instead of boasting when the sharer has no rank', () => {
    const c = buildCopy({ m: 'Leaderboard', lm: 'Six' }, ['u', 'Leaderboard-Six-2026-08-07']);
    expect(c.title).toBe('Wordocious Daily Leaderboard — Classic Six Aug 7');
    expect(c.description).toContain('Can you crack the top 5?');
    expect(c.description).not.toContain('#');
  });

  it('builds the VS battle leaderboard card', () => {
    const c = buildCopy(
      { m: 'VsLeaderboard', lm: 'Classic', r: '2', tp: '40' },
      ['u', 'VsLeaderboard-Classic-2026-08-07'],
    );
    expect(c.title).toBe('Wordocious VS Battle Leaderboard — Classic Aug 7');
    expect(c.description).toBe(
      'I’m #2 on today’s Classic VS board. Think you can take me? Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the settled yesterday-podium card', () => {
    const c = buildCopy({ m: 'Podium', lm: 'Classic' }, ['u', 'Podium-Classic-2026-08-06']);
    expect(c.title).toBe('Wordocious Yesterday’s Podium — Classic Aug 6');
    expect(c.description).toBe(
      'Yesterday’s Classic podium is settled. Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the FRIENDS board card (§207): #rank of friend-count brag', () => {
    const c = buildCopy(
      { m: 'FriendsBoard', lm: 'Classic', r: '2', tp: '7' },
      ['u', 'FriendsBoard-Classic-2026-08-08'],
    );
    expect(c.title).toBe('Wordocious Friends Leaderboard — Classic Aug 8');
    expect(c.description).toBe(
      'I’m #2 of 7 among my friends on today’s Classic board. Can you beat me? Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the FRIENDS podium card, recovered from the path alone', () => {
    const c = buildCopy({}, ['u', 'FriendsPodium-Classic-2026-08-07']);
    expect(c.title).toBe('Wordocious Friends Podium — Classic Aug 7');
    expect(c.description).toBe(
      'Yesterday’s Classic podium among friends is settled. Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the SWEEP board card (§231): #rank of sweeper-count brag, lm=SWEEP', () => {
    const c = buildCopy(
      { m: 'SweepBoard', lm: 'SWEEP', r: '4', tp: '31' },
      ['u', 'SweepBoard-DailySweep-2026-08-23'],
    );
    expect(c.mode).toBe('SweepBoard');
    expect(c.title).toBe('Wordocious Daily Sweep Leaderboard — Aug 23, 2026');
    expect(c.description).toBe(
      'I’m #4 of 31 on today’s Daily Sweep board. Can you sweep them all? Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the SWEEP podium card, recovered from the path alone', () => {
    const c = buildCopy({}, ['u', 'SweepPodium-DailySweep-2026-08-22']);
    expect(c.mode).toBe('SweepPodium');
    expect(c.title).toBe('Wordocious Yesterday’s Sweep Podium — Aug 22, 2026');
    expect(c.description).toBe(
      'Yesterday’s Daily Sweep podium is settled — they swept every daily. Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the WEEKLY RACE card (§234): #rank of racer-count in the sibling voice, lm=WEEKLY', () => {
    const c = buildCopy(
      { m: 'WeeklyRace', lm: 'WEEKLY', r: '2', tp: '8' },
      ['u', 'WeeklyRace-WeeklyRace-2026-08-24'],
    );
    expect(c.mode).toBe('WeeklyRace');
    expect(c.title).toBe('Wordocious Friends Weekly Race — Aug 24, 2026');
    expect(c.description).toBe(
      '#2 of 8 in their friends’ weekly race — resets Monday. Think you can catch them? Play today’s puzzles free at wordocious.com.',
    );
  });

  it('builds the WEEKLY RACE card without a standing, recovered from the path alone', () => {
    const c = buildCopy({}, ['u', 'WeeklyRace-WeeklyRace-2026-08-24']);
    expect(c.mode).toBe('WeeklyRace');
    expect(c.title).toBe('Wordocious Friends Weekly Race — Aug 24, 2026');
    expect(c.description).toContain('resets Monday');
    expect(c.description).not.toContain('#');
  });

  it('recovers kind + board mode from the path when the query is stripped', () => {
    const c = buildCopy({}, ['u', 'VsLeaderboard-Six-2026-08-07']);
    expect(c.title).toBe('Wordocious VS Battle Leaderboard — Classic Six Aug 7');
    expect(c.description).toContain('Think you can take them?');
    // Never invent a rank the query didn't carry.
    expect(c.description).not.toContain('I’m #');
  });
});

// LAYER 2 — the live section under a leaderboard share. parseLeaderboardShare
// tells the page WHICH board was shared; boardDayStatus decides (against the
// RECIPIENT'S local today) whether to fetch the current board or call it final.
describe('parseLeaderboardShare', () => {
  it('recovers kind + board mode + day from the query', () => {
    expect(parseLeaderboardShare(
      { m: 'Leaderboard', lm: 'Classic' },
      ['u', 'Leaderboard-Classic-2026-08-07'],
    )).toEqual({ kind: 'Leaderboard', lbMode: 'Classic', date: '2026-08-07' });
  });

  it('recognizes the SWEEP kinds (§231) from the query and from the path alone', () => {
    expect(parseLeaderboardShare(
      { m: 'SweepBoard', lm: 'SWEEP' },
      ['u', 'SweepBoard-DailySweep-2026-08-23'],
    )).toEqual({ kind: 'SweepBoard', lbMode: 'SWEEP', date: '2026-08-23' });
    expect(parseLeaderboardShare({}, ['u', 'SweepPodium-DailySweep-2026-08-22']))
      .toEqual({ kind: 'SweepPodium', lbMode: 'DailySweep', date: '2026-08-22' });
  });

  it('treats a SweepBoard as live only on the recipient’s today; SweepPodium is always final', () => {
    expect(boardDayStatus('SweepBoard', '2026-08-23', '2026-08-23')).toBe('live');
    expect(boardDayStatus('SweepBoard', '2026-08-22', '2026-08-23')).toBe('final');
    expect(boardDayStatus('SweepPodium', '2026-08-23', '2026-08-23')).toBe('final');
  });

  it('recognizes the WEEKLY RACE kind (§234) from the query and from the path alone', () => {
    expect(parseLeaderboardShare(
      { m: 'WeeklyRace', lm: 'WEEKLY' },
      ['u', 'WeeklyRace-WeeklyRace-2026-08-24'],
    )).toEqual({ kind: 'WeeklyRace', lbMode: 'WEEKLY', date: '2026-08-24' });
    expect(parseLeaderboardShare({}, ['u', 'WeeklyRace-WeeklyRace-2026-08-24']))
      .toEqual({ kind: 'WeeklyRace', lbMode: 'WeeklyRace', date: '2026-08-24' });
  });

  it('recovers kind + board mode from the path when the query is stripped', () => {
    expect(parseLeaderboardShare({}, ['u', 'VsLeaderboard-Six-2026-08-07']))
      .toEqual({ kind: 'VsLeaderboard', lbMode: 'Six', date: '2026-08-07' });
    expect(parseLeaderboardShare({}, ['u', 'Podium-Classic-2026-08-06']))
      .toEqual({ kind: 'Podium', lbMode: 'Classic', date: '2026-08-06' });
  });

  it('returns null for every non-leaderboard share', () => {
    expect(parseLeaderboardShare({ m: 'Six' }, KEY)).toBeNull();
    expect(parseLeaderboardShare({}, KEY)).toBeNull();
    expect(parseLeaderboardShare({}, ['garbage'])).toBeNull();
    expect(parseLeaderboardShare({ m: 'Profile' }, ['u', 'Profile-2026-08-05'])).toBeNull();
  });
});

describe('boardDayStatus', () => {
  it('is live only while the board day is the recipient’s today', () => {
    expect(boardDayStatus('Leaderboard', '2026-08-07', '2026-08-07')).toBe('live');
    expect(boardDayStatus('VsLeaderboard', '2026-08-07', '2026-08-07')).toBe('live');
  });

  it('is final once the day has passed', () => {
    expect(boardDayStatus('Leaderboard', '2026-08-06', '2026-08-07')).toBe('final');
    expect(boardDayStatus('VsLeaderboard', '2026-08-06', '2026-08-07')).toBe('final');
  });

  it('treats the Podium kind as final even on its own day', () => {
    expect(boardDayStatus('Podium', '2026-08-07', '2026-08-07')).toBe('final');
  });

  it('degrades a missing day to final (never fetches on a bad key)', () => {
    expect(boardDayStatus('Leaderboard', undefined, '2026-08-07')).toBe('final');
  });
});
