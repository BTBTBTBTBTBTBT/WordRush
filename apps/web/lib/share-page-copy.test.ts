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
