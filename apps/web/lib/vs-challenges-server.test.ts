import { describe, expect, it, vi } from 'vitest';

vi.mock('./pro', () => ({ isProActive: () => true }));
import { challengeCode, parseRun, toView } from './vs-challenges-server';

describe('vs challenge server helpers', () => {
  it('codes are 8 easy-to-type characters', () => {
    for (let i = 0; i < 50; i++) expect(challengeCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
  it('accepts a real run and rejects bad ones', () => {
    expect(parseRun({ solved: true, boardsSolved: 1, totalBoards: 1, guesses: 4, timeMs: 112000, guessLog: ['CRANE', 'SLATE'], solutions: ['SLATE'] }))
      .toEqual({ solved: true, boardsSolved: 1, totalBoards: 1, guesses: 4, timeMs: 112000, guessLog: ['CRANE', 'SLATE'], solutions: ['SLATE'] });
    expect(parseRun({ solved: false, boardsSolved: 0, guesses: 6, timeMs: 1 })?.totalBoards).toBe(1);
    expect(parseRun({ solved: true, boardsSolved: 1, guesses: 0, timeMs: 5 })).toBeNull(); // a solve needs guesses
    expect(parseRun({ solved: 'yes', boardsSolved: 1, guesses: 3, timeMs: 5 } as any)).toBeNull();
    expect(parseRun({ solved: true, boardsSolved: 1, guesses: 3, timeMs: -1 })).toBeNull();
    expect(parseRun({ solved: true, boardsSolved: 1, guesses: 3.5, timeMs: 1 })).toBeNull();
    expect(parseRun(undefined)).toBeNull();
  });
  it('maps a row to the public view', () => {
    const v = toView({ code: 'ABCDEFGH', game_mode: 'DUEL', seed: 's', challenger_id: 'u', solved: true, boards_solved: 1, total_boards: 1, guesses: 4, time_ms: 1000, guess_log: null, solutions: ['X'], created_at: 'c', expires_at: 'e', is_link: false }, { username: 'doug' });
    // isProActive is mocked to true in this file (the real rule is covered by avatar-fields-server.test.ts).
    expect(v.challenger).toEqual({ id: 'u', username: 'doug', avatarUrl: null, avatar_cast_id: null, avatar_frame: null, avatar_config: null, is_pro: true });
    // FINISH_SPEC AH/AN3: the challenger's avatar choice rides along when selected.
    const w = toView({ challenger_id: 'u' }, { username: 'doug', is_pro: true, pro_expires_at: null, avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1 } });
    expect(w.challenger).toMatchObject({ avatar_cast_id: 'w', avatar_frame: 'gold', avatar_config: { v: 1 }, is_pro: true });
    expect(v.run.guessLog).toEqual([]);
  });
});
