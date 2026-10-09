import { describe, expect, it } from 'vitest';
import { newFriendlyState, type FriendlyState } from './friendly-games';
import {
  LIVE_POLL_MS, beginMove, confirmMove, displayed, emptySnapshot, isNewer, liveTopic, pollIntervalMs,
  predictMove, presenceLabel, receiveView, rejectMove, type LiveViewLike,
} from './friendly-live';

const view = (state: FriendlyState, updatedAt: string, over: Partial<LiveViewLike> = {}): LiveViewLike => ({
  id: 'g1', me: 'a', state, status: 'active', yourTurn: true, updatedAt, ...over,
});
const T1 = '2026-10-09T12:00:00.000+00:00';
const T2 = '2026-10-09T12:00:01.000+00:00';
const T3 = '2026-10-09T12:00:02.000+00:00';

describe('live poll + topic', () => {
  it('flag off keeps the 2 s poll; on = keep-alive, or a 4 s fallback when the socket drops', () => {
    expect(pollIntervalMs(false, true)).toBe(LIVE_POLL_MS.off);
    expect(pollIntervalMs(true, true)).toBe(LIVE_POLL_MS.keepAlive);
    expect(pollIntervalMs(true, false)).toBe(LIVE_POLL_MS.socketDown);
    expect(liveTopic('abc')).toBe('fg:abc');
  });
});

describe('presence', () => {
  it('here / thinking / left / away', () => {
    expect(presenceLabel({ peerPresent: true, everSeen: true, theirTurn: false })).toBe('here');
    expect(presenceLabel({ peerPresent: true, everSeen: true, theirTurn: true })).toBe('thinking');
    expect(presenceLabel({ peerPresent: false, everSeen: true, theirTurn: true })).toBe('left');
    expect(presenceLabel({ peerPresent: false, everSeen: false, theirTurn: true })).toBe('away');
  });
});

describe('staleness', () => {
  it('only a strictly newer save wins (string formats may differ, instants compare)', () => {
    expect(isNewer(null, { updatedAt: T1 })).toBe(true);
    expect(isNewer({ updatedAt: T2 }, { updatedAt: T1 })).toBe(false);
    expect(isNewer({ updatedAt: T1 }, { updatedAt: T1 })).toBe(false);
    expect(isNewer({ updatedAt: '2026-10-09T12:00:00.000Z' }, { updatedAt: '2026-10-09T12:00:00.500+00:00' })).toBe(true);
  });
});

describe('predictMove', () => {
  it('Tic-Tac-Tile always; RPS only before their pick; chain appends; others wait for the server', () => {
    const ttt = newFriendlyState('ttt');
    const t = predictMove(ttt, 'a', { kind: 'ttt', cell: 4 }) as any;
    expect(t.board[4]).toBe('a');
    expect(predictMove(ttt, 'b', { kind: 'ttt', cell: 4 })).toBeNull(); // not b's turn
    const rps = newFriendlyState('rps');
    expect((predictMove(rps, 'a', { kind: 'rps', pick: 'rock' }) as any).picks.a).toBe('rock');
    const theirs = { ...rps, picks: { b: 'hidden' } } as unknown as FriendlyState;
    expect(predictMove(theirs, 'a', { kind: 'rps', pick: 'rock' })).toBeNull();
    expect((predictMove(newFriendlyState('chain'), 'a', { kind: 'chain', word: 'plane' }) as any).words[0].word).toBe('PLANE');
    expect(predictMove(newFriendlyState('chain'), 'a', { kind: 'chain', word: 'no' })).toBeNull();
    expect(predictMove(newFriendlyState('coin'), 'a', { kind: 'coin', call: 'heads' })).toBeNull();
    expect(predictMove(newFriendlyState('pass'), 'a', { kind: 'pass', word: 'crane' })).toBeNull();
    expect(predictMove(newFriendlyState('ghost'), 'a', { kind: 'ghost', letter: 'q' })).toBeNull();
  });
});

describe('optimistic move: begin, confirm, reject', () => {
  const start = () => ({ confirmed: view(newFriendlyState('ttt'), T1), pending: null });

  it('shows my piece at once and flips the turn', () => {
    const { snap, optimistic } = beginMove(start(), { kind: 'ttt', cell: 0 });
    expect(optimistic).toBe(true);
    const d = displayed(snap)!;
    expect((d.state as any).board[0]).toBe('a');
    expect(d.yourTurn).toBe(false);
  });

  it('a second tap while one is in flight is ignored', () => {
    const first = beginMove(start(), { kind: 'ttt', cell: 0 });
    expect(beginMove(first.snap, { kind: 'ttt', cell: 1 }).optimistic).toBe(false);
  });

  it('no prediction for a server-decided game: nothing pending', () => {
    const coin = { confirmed: view(newFriendlyState('coin'), T1), pending: null };
    const r = beginMove(coin, { kind: 'coin', call: 'heads' });
    expect(r.optimistic).toBe(false);
    expect(r.snap.pending).toBeNull();
  });

  it('confirm swaps in the server view', () => {
    const { snap } = beginMove(start(), { kind: 'ttt', cell: 0 });
    const server = view({ ...(newFriendlyState('ttt') as any), board: ['a', '', '', '', '', '', '', '', ''], turn: 'b' }, T2, { yourTurn: false });
    const done = confirmMove(snap, server);
    expect(done.pending).toBeNull();
    expect(done.confirmed!.updatedAt).toBe(T2);
  });

  it('a late reply never replaces a newer broadcast', () => {
    const { snap } = beginMove(start(), { kind: 'ttt', cell: 0 });
    const newer = receiveView(snap, view(newFriendlyState('ttt'), T3)).snap;
    const done = confirmMove(newer, view(newFriendlyState('ttt'), T2));
    expect(done.confirmed!.updatedAt).toBe(T3);
  });

  it('reject rolls back to the confirmed game and says so', () => {
    const { snap } = beginMove(start(), { kind: 'ttt', cell: 0 });
    const r = rejectMove(snap);
    expect(r.rolledBack).toBe(true);
    expect((displayed(r.snap)!.state as any).board[0]).toBe('');
    expect(rejectMove(r.snap).rolledBack).toBe(false);
  });
});

describe('receiveView (broadcast / backup refetch / keep-alive)', () => {
  it('ignores stale and duplicate saves', () => {
    const snap = { confirmed: view(newFriendlyState('ttt'), T2), pending: null };
    expect(receiveView(snap, view(newFriendlyState('ttt'), T1)).applied).toBe(false);
    expect(receiveView(snap, view(newFriendlyState('ttt'), T2)).applied).toBe(false);
  });

  it('reports the friend moving and your turn starting', () => {
    const mine = view(newFriendlyState('ttt'), T1, { yourTurn: false });
    const board = { ...(newFriendlyState('ttt') as any), board: ['a', 'b', '', '', '', '', '', '', ''], turn: 'a' };
    const r = receiveView({ confirmed: mine, pending: null }, view(board, T2, { yourTurn: true }));
    expect(r.applied).toBe(true);
    expect(r.change).toEqual({ moved: true, yourTurnStarted: true, ended: false });
  });

  it('reports a game that ends', () => {
    const live = view(newFriendlyState('ttt'), T1);
    const r = receiveView({ confirmed: live, pending: null }, view(newFriendlyState('ttt'), T2, { status: 'resigned', yourTurn: false }));
    expect(r.change.ended).toBe(true);
  });

  it('their move landing while mine is in flight drops my stale prediction', () => {
    const { snap } = beginMove({ confirmed: view(newFriendlyState('rps'), T1), pending: null }, { kind: 'rps', pick: 'rock' });
    expect(snap.pending).not.toBeNull();
    const r = receiveView(snap, view(newFriendlyState('rps'), T2));
    expect(r.snap.pending).toBeNull();
  });

  it('empty snapshot takes the first view', () => {
    const r = receiveView(emptySnapshot<LiveViewLike>(), view(newFriendlyState('ttt'), T1));
    expect(r.applied).toBe(true);
    expect(r.change.moved).toBe(false);
  });
});
