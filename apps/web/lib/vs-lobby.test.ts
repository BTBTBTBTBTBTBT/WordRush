import { describe, it, expect } from 'vitest';
import {
  aggregateRivals, battleFromRow, botsTileSub, challengeSentSub, friendCta, friendLine, h2hLine, hoursLeft,
  incomingLine, ladderNextKind, liveTileSub, lobbyCount, raceTarget, recentSent, rowStates, sendPanelLine,
  sentLabel, sentStatus, sumRecord, todayTileLine, todaysBattle, utcCountdown, utcDay,
} from './vs-lobby';
import { emptyCpuProgression, foldLadder, botOfDayToday } from './bot/cpu-progression';

// The VS overhaul's web glue (spec docs/VS_REDESIGN_SPEC.md). The shared words
// are tested in packages/core; these pin the lobby's own lines and folds.

describe('VS lobby lines', () => {
  it('counts down to the next UTC midnight', () => {
    expect(utcCountdown(new Date('2026-10-01T23:00:00Z'))).toBe('01:00:00');
    expect(utcCountdown(new Date('2026-10-01T00:00:01Z'))).toBe('23:59:59');
    expect(utcDay(new Date('2026-10-01T23:59:59Z'))).toBe('2026-10-01');
  });

  it('reads hours left, never below 1', () => {
    const now = Date.parse('2026-10-01T00:00:00Z');
    expect(hoursLeft('2026-10-01T17:00:00Z', now)).toBe(17);
    expect(hoursLeft('2026-10-01T00:10:00Z', now)).toBe(1);
    expect(hoursLeft('2026-09-30T00:00:00Z', now)).toBe(1);
  });

  it('builds the incoming challenge line', () => {
    const now = Date.parse('2026-10-01T00:00:00Z');
    expect(incomingLine('DUEL', { solved: true, guesses: 4, timeMs: 112_000 }, '2026-10-01T17:00:00Z', now)).toBe('Classic · solved in 4 · 1:52 · 17h left');
    expect(incomingLine('QUORDLE', { solved: false, guesses: 9, timeMs: 1 }, '2026-10-01T17:00:00Z', now)).toBe('QuadWord · not solved · 17h left');
  });

  it('builds head-to-head lines', () => {
    expect(h2hLine(4, 3, 'QUORDLE')).toEqual({ text: 'You lead 4–3 · last: QuadWord', ahead: true });
    expect(h2hLine(1, 2, 'DUEL').text).toBe('You trail 1–2 · last: Classic');
    expect(h2hLine(2, 2, 'GAUNTLET').text).toBe('Even 2–2 · last: Gauntlet');
    expect(friendLine(0, 0)).toBe('Never played · new friend');
    expect(friendLine(3, 1)).toBe('You lead 3–1');
  });

  it('builds the PLAY tile lines', () => {
    expect(liveTileSub(2, 'OCTORDLE')).toBe('2 waiting now in OctoWord.');
    expect(liveTileSub(0, 'DUEL')).toBe('0 waiting now. A bot steps in at 0:15.');
    expect(botsTileSub(0)).toBe('Ladder 0 of 4. Rook is next.');
    expect(botsTileSub(3)).toBe('Ladder 3 of 4. Adapt is next.');
    expect(botsTileSub(4)).toBe('Ladder cleared!');
  });

  it('picks the ladder bot that steps in', () => {
    expect(ladderNextKind(0)).toBe('easy');
    expect(ladderNextKind(1)).toBe('medium');
    expect(ladderNextKind(2)).toBe('hard');
    expect(ladderNextKind(3)).toBe('adaptive');
    expect(ladderNextKind(4)).toBe('adaptive');
  });

  it('shows the honest lobby count', () => {
    expect(lobbyCount(3, 40)).toEqual({ text: '3 looking', live: true });
    expect(lobbyCount(0, 41)).toEqual({ text: '41 online', live: false });
    expect(lobbyCount(0, null)).toBeNull();
  });

  it('builds the Friend page and CHALLENGE SENT lines', () => {
    expect(friendCta(2, false)).toBe('PLAY, THEN SEND TO 2 FRIENDS');
    expect(friendCta(1, true)).toBe('PLAY, THEN SEND TO 1 FRIEND');
    expect(friendCta(0, true)).toBe('PLAY, THEN SHARE A LINK');
    expect(sendPanelLine(3, false)).toBe('3 friends will race it');
    expect(sendPanelLine(0, true)).toBe('Anyone with the link');
    expect(challengeSentSub('DUEL', { solved: true, guesses: 4, timeMs: 112_000 })).toBe('CLASSIC · SOLVED IN 4 · 1:52 · 24H TO RACE');
    expect(challengeSentSub('DUEL', { solved: false, guesses: 6, timeMs: 1 })).toBe('CLASSIC · NOT SOLVED · 24H TO RACE');
    expect(raceTarget({ solved: true, guesses: 4, timeMs: 112_000 })).toBe('Solved in 4 · 1:52');
    expect(raceTarget({ solved: false, guesses: 6, timeMs: 1 })).toBe('Not solved — just solve it');
  });

  it('reads sent challenges from the sender’s side', () => {
    const base = { code: 'ABCD2345', gameMode: 'DUEL', createdAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-02T00:00:00Z', invitees: 2 };
    expect(sentLabel(base)).toBe('Classic · sent to 2');
    expect(sentLabel({ ...base, invitees: 0 })).toBe('Classic · link');
    expect(sentStatus({ results: [] })).toBe('waiting');
    const r = { username: 'doug', guesses: 3, timeMs: 1, solved: true };
    expect(sentStatus({ results: [{ ...r, outcome: 'loss' }] })).toBe('@doug beat it');
    expect(sentStatus({ results: [{ ...r, outcome: 'win' }] })).toBe('@doug lost');
    expect(sentStatus({ results: [{ ...r, outcome: 'draw' }, { ...r, outcome: 'win' }] })).toBe('@doug tied +1');
    const now = Date.parse('2026-10-01T20:00:00Z');
    expect(recentSent([{ ...base, results: [] }, { ...base, createdAt: '2026-09-29T00:00:00Z', results: [] }], now)).toHaveLength(1);
  });
});

describe('today’s battles', () => {
  it('reads the daily_results row', () => {
    expect(battleFromRow(null)).toBe('open');
    expect(battleFromRow({ vs_wins: 1, vs_losses: 0, vs_games: 1 })).toBe('won');
    expect(battleFromRow({ vs_wins: 0, vs_losses: 1, vs_games: 1 })).toBe('lost');
    expect(battleFromRow({ vs_wins: 0, vs_losses: 0, vs_games: 1 })).toBe('draw');
  });

  it('prefers the person row over the bot fallback', () => {
    expect(todaysBattle({ vs_wins: 1, vs_losses: 0, vs_games: 1 }, 'kate', { result: 'lost', opponent: 'Lexi' })).toEqual({ result: 'won', opponent: '@kate' });
    expect(todaysBattle(null, null, { result: 'lost', opponent: 'Lexi' })).toEqual({ result: 'lost', opponent: 'Lexi' });
    expect(todaysBattle(null, null, null)).toEqual({ result: 'open', opponent: null });
  });

  it('builds the TODAY tile lines', () => {
    expect(todayTileLine('open', null, 'Classic', false)).toBe('Classic · open');
    expect(todayTileLine('open', null, 'Lexi', true)).toBe('Lexi · free');
    expect(todayTileLine('won', '@kate', 'Classic', false)).toBe('Beat @kate');
    expect(todayTileLine('lost', 'Lexi', 'Lexi', false)).toBe('Lost to Lexi');
    expect(todayTileLine('draw', '@kate', 'Classic', false)).toBe('Draw with @kate');
  });

  it('sums the records exactly like the Stats page', () => {
    const rows = [
      { play_type: 'vs', wins: 3, losses: 1 },
      { play_type: 'vs', wins: 2, losses: null },
      { play_type: 'vs_cpu', wins: 7, losses: 4 },
      { play_type: 'solo', wins: 99, losses: 99 },
    ];
    expect(sumRecord(rows, 'vs')).toEqual({ wins: 5, losses: 1 });
    expect(sumRecord(rows, 'vs_cpu')).toEqual({ wins: 7, losses: 4 });
  });
});

describe('rivals', () => {
  it('folds matches into records with the last mode', () => {
    const me = 'me';
    const rows = [
      { player1_id: me, player2_id: 'doug', winner_id: me, game_mode: 'QUORDLE' },
      { player1_id: 'doug', player2_id: me, winner_id: 'doug', game_mode: 'DUEL' },
      { player1_id: me, player2_id: 'kate', winner_id: null, game_mode: 'GAUNTLET' },
      { player1_id: me, player2_id: null, winner_id: me, game_mode: 'DUEL' },
      { player1_id: me, player2_id: 'doug', winner_id: me, game_mode: 'DUEL' },
    ];
    const out = aggregateRivals(rows, me);
    expect(out[0]).toEqual({ opponentId: 'doug', wins: 2, losses: 1, draws: 0, total: 3, lastMode: 'QUORDLE' });
    expect(out[1]).toEqual({ opponentId: 'kate', wins: 0, losses: 0, draws: 1, total: 1, lastMode: 'GAUNTLET' });
  });
});

describe('result mini boards', () => {
  it('colors a guess with duplicate letters honored', () => {
    expect(rowStates('CRANE', 'CRANE')).toEqual(['correct', 'correct', 'correct', 'correct', 'correct']);
    expect(rowStates('CRANE', 'EERIE')).toEqual(['absent', 'absent', 'present', 'absent', 'correct']); // the green E uses CRANE's only E
    expect(rowStates('ABBEY', 'BABES')).toEqual(['present', 'present', 'correct', 'correct', 'absent']);
  });
});

describe('progression', () => {
  it('folds bot games into the ladder (core ladderAfterGame)', () => {
    let p = emptyCpuProgression();
    p = foldLadder(p, 'rook', true);
    p = foldLadder(p, 'lexi', true); // not the next bot: no change
    expect([p.ladderCleared, p.ladderRun]).toEqual([0, 1]);
    p = foldLadder(foldLadder(p, 'rook', true), 'rook', true);
    expect([p.ladderCleared, p.ladderRun]).toEqual([1, 0]);
    p = foldLadder(foldLadder(p, 'lexi', true), 'lexi', false);
    expect([p.ladderCleared, p.ladderRun]).toEqual([1, 0]);
    expect(foldLadder(p, 'daily', true)).toEqual(p);
  });

  it('reads today’s Bot of the Day', () => {
    const p = { ...emptyCpuProgression(), botOfDayPlayedDay: '2026-10-01', botOfDayResult: 'won' as const };
    expect(botOfDayToday(p, '2026-10-01')).toBe('won');
    expect(botOfDayToday(p, '2026-10-02')).toBe('open');
    expect(botOfDayToday(emptyCpuProgression(), '2026-10-01')).toBe('open');
  });
});
