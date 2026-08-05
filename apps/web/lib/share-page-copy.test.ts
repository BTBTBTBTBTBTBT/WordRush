import { describe, it, expect } from 'vitest';
import { buildCopy, parseShareKey } from './share-page-copy';

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
