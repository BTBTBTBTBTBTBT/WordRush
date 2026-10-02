import { describe, expect, it } from 'vitest';
import {
  applyFriendlyMove, friendStreak, friendlyCardLine, friendlyHeadline, friendlyStateFor, friendlyWinner,
  friendsBannerClockLine, friendsBannerHeadline, isOnline, newFriendlyState, presenceLine, tttLine, whoseTurn,
  type FriendlyState,
} from './friendly-games';

const play = (s: FriendlyState, moves: Array<[any, any]>, ctx = {}) => {
  for (const [by, mv] of moves) {
    const r = applyFriendlyMove(s, by, mv, ctx);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
};

describe('rock paper scissors', () => {
  it('best of 3, picks hidden until both are in, ties replay', () => {
    let s = newFriendlyState('rps');
    s = play(s, [['a', { kind: 'rps', pick: 'paper' }]]);
    expect(whoseTurn(s)).toBe('b');
    expect((friendlyStateFor(s, 'b') as any).picks.a).toBe('hidden');
    expect(applyFriendlyMove(s, 'a', { kind: 'rps', pick: 'rock' }).ok).toBe(false);
    s = play(s, [['b', { kind: 'rps', pick: 'rock' }], ['a', { kind: 'rps', pick: 'rock' }], ['b', { kind: 'rps', pick: 'rock' }]]);
    expect((s as any).score).toEqual({ a: 1, b: 0 });
    s = play(s, [['b', { kind: 'rps', pick: 'scissors' }], ['a', { kind: 'rps', pick: 'rock' }]]);
    expect(friendlyWinner(s)).toBe('a');
    expect(friendlyHeadline(s, 'a')).toBe('YOU WIN!');
    expect(friendlyCardLine({ kind: 'rps', state: s, me: 'b', them: 'BT', minutesAgo: 1 })).toBe('BT won 2–0');
  });
});

describe('tic-tac-tile', () => {
  it('turns, a win line, the starter alternates', () => {
    let s = newFriendlyState('ttt');
    expect(applyFriendlyMove(s, 'b', { kind: 'ttt', cell: 0 }).ok).toBe(false);
    s = play(s, [['a', { kind: 'ttt', cell: 0 }], ['b', { kind: 'ttt', cell: 3 }], ['a', { kind: 'ttt', cell: 1 }], ['b', { kind: 'ttt', cell: 4 }]]);
    expect(tttLine([...(s as any).board.slice(0, 2), 'a', ...(s as any).board.slice(3)])?.cells).toEqual([0, 1, 2]);
    s = play(s, [['a', { kind: 'ttt', cell: 2 }]]);
    expect((s as any).score).toEqual({ a: 1, b: 0 });
    expect(whoseTurn(s)).toBe('b');
    expect(friendlyCardLine({ kind: 'ttt', state: s, me: 'b', them: 'BT', minutesAgo: 4 })).toBe('Your move · BT moved 4 min ago');
  });
});

describe('call it', () => {
  it('server flip, caller alternates, first to 3', () => {
    let s = newFriendlyState('coin', "Loser picks tonight's VS mode");
    const heads = { random: () => 0.1 };
    s = play(s, [['a', { kind: 'coin', call: 'heads' }], ['b', { kind: 'coin', call: 'heads' }], ['a', { kind: 'coin', call: 'heads' }], ['b', { kind: 'coin', call: 'tails' }]], heads);
    expect((s as any).score).toEqual({ a: 3, b: 1 });
    expect(friendlyWinner(s)).toBe('a');
    expect((s as any).stake).toBe("Loser picks tonight's VS mode");
    expect((newFriendlyState('coin', 'anything') as any).stake).toBe('Bragging rights');
  });
});

describe('pass the puzzle', () => {
  it('alternating guesses on one board; the solver wins', () => {
    const ctx = { solution: 'RISKS', isValidWord: (w: string) => w !== 'ZZZZZ' };
    let s = newFriendlyState('pass');
    expect(applyFriendlyMove(s, 'a', { kind: 'pass', word: 'ZZZZZ' }, ctx).ok).toBe(false);
    s = play(s, [['a', { kind: 'pass', word: 'crane' }], ['b', { kind: 'pass', word: 'routs' }]], ctx);
    expect((s as any).guesses[0].tiles).toEqual(['ABSENT', 'PRESENT', 'ABSENT', 'ABSENT', 'ABSENT']);
    expect(friendlyHeadline(s, 'a')).toBe('YOUR GUESS · 3 OF 6');
    s = play(s, [['a', { kind: 'pass', word: 'risks' }]], ctx);
    expect(friendlyWinner(s)).toBe('a');
    expect(friendlyCardLine({ kind: 'pass', state: s, me: 'b', them: 'BT', minutesAgo: 0 })).toBe('BT solved it');
  });
});

describe('presence, streaks, banner', () => {
  const now = Date.parse('2026-10-01T20:00:00Z');
  it('on now within two minutes', () => {
    expect(isOnline(now - 60_000, now)).toBe(true);
    expect(isOnline(now - 3 * 60_000, now)).toBe(false);
    expect(presenceLine(now - 30_000, 'Muddle', now)).toBe('On now · in Muddle');
    expect(presenceLine(now - 12 * 60_000, null, now)).toBe('Here 12 min ago');
    expect(presenceLine(now - 3 * 3600_000, null, now)).toBe('Here 3 h ago');
    expect(presenceLine(now - 30 * 3600_000, null, now)).toBeNull();
  });
  it('friend streak counts days you BOTH played', () => {
    const me = ['2026-10-01', '2026-09-30', '2026-09-29', '2026-09-27'];
    const them = ['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-27'];
    expect(friendStreak(me, them, '2026-10-01')).toBe(2);
    expect(friendStreak(me, them, '2026-10-03')).toBe(0);
  });
  it('banner words', () => {
    const b = { friendCount: 4, online: ['Doug', 'Kate', 'Mike'], myRank: 2, myPoints: 1180, leaderName: 'Kate', leaderPoints: 1240, nextPoints: 960 };
    expect(friendsBannerHeadline(b)).toBe('3 FRIENDS ON NOW');
    expect(friendsBannerHeadline({ ...b, online: ['Doug'] })).toBe('DOUG IS ON NOW');
    expect(friendsBannerHeadline({ ...b, online: [], myRank: 1, myPoints: 1380 })).toBe('YOU LEAD TODAY’S RACE!');
    expect(friendsBannerHeadline({ ...b, online: [] })).toBe('KATE LEADS TODAY’S RACE');
    expect(friendsBannerHeadline({ ...b, online: [], leaderPoints: 0, myPoints: 0 })).toBe('QUIET IN HERE · START A GAME');
    expect(friendsBannerHeadline({ ...b, friendCount: 0 })).toBe('BRING YOUR FRIENDS');
    expect(friendsBannerClockLine(b, '04:12:08')).toBe('TODAY’S RACE ENDS IN 04:12:08 · YOU’RE 2ND, 60 BEHIND');
    expect(friendsBannerClockLine({ ...b, myRank: 1, myPoints: 1380, nextPoints: 1240 }, '09:40:51')).toBe('YOU LEAD BY 140 · ENDS IN 09:40:51');
    expect(friendsBannerClockLine({ ...b, myRank: 11, myPoints: 0, leaderPoints: 2500 }, 'x')).toBe('TODAY’S RACE ENDS IN x · YOU’RE 11TH, 2,500 BEHIND');
  });
});
