import { describe, it, expect, beforeEach } from 'vitest';
import {
  LATE_AFTER_MS,
  enqueueCelebration,
  isCalm,
  isLate,
  readCalmInputs,
  shouldDrop,
  takeNextCelebration,
} from './celebration-gate';
import { dismissCelebration, getCelebrations, nextCelebration, queueCelebrations, type BadgeCelebration } from './badges';

// Outage fix (2026-10-03): a late write popped the Daily Sweep celebration at
// an awkward moment. Late celebrations wait for calm; sweeps always do.

describe('isCalm', () => {
  it('is calm only on Home root with nothing open and no popup up', () => {
    expect(isCalm({ onHomeRoot: true, anythingOpen: false, popupUp: false })).toBe(true);
    expect(isCalm({ onHomeRoot: false, anythingOpen: false, popupUp: false })).toBe(false);
    expect(isCalm({ onHomeRoot: true, anythingOpen: true, popupUp: false })).toBe(false);
    expect(isCalm({ onHomeRoot: true, anythingOpen: false, popupUp: true })).toBe(false);
  });
  it('is never calm off the browser', () => {
    expect(isCalm(readCalmInputs())).toBe(false);
  });
});

describe('isLate', () => {
  it('replays and syncs are always late', () => {
    expect(isLate('replay', 1000, 1000)).toBe(true);
    expect(isLate('sync', 1000, 1000)).toBe(true);
  });
  it('a live finish is late only past LATE_AFTER_MS (6 s)', () => {
    expect(LATE_AFTER_MS).toBe(6000);
    expect(isLate('live', 0, 6000)).toBe(false);
    expect(isLate('live', 0, 6001)).toBe(true);
    expect(isLate('live', 0, 1200)).toBe(false);
  });
});

describe('shouldDrop', () => {
  it('drops a celebration whose day is no longer today', () => {
    expect(shouldDrop('2026-10-02', '2026-10-03')).toBe(true);
    expect(shouldDrop('2026-10-03', '2026-10-03')).toBe(false);
  });
});

describe('the queue helper', () => {
  it('keeps one slot per key, refreshing the payload in place', () => {
    let q = enqueueCelebration([], { key: 'more', day: '2026-10-03', payload: 1 });
    q = enqueueCelebration(q, { key: 'daily', day: '2026-10-03', payload: 2 });
    q = enqueueCelebration(q, { key: 'more', day: '2026-10-03', payload: 3 });
    expect(q.map((x) => [x.key, x.payload])).toEqual([['more', 3], ['daily', 2]]);
  });
  it('at the calm moment drops stale days and takes the daily sweep first', () => {
    const q = [
      { key: 'more', day: '2026-10-03', payload: 'm' },
      { key: 'daily', day: '2026-10-03', payload: 'd' },
    ];
    const { next, rest, dropped } = takeNextCelebration(q, '2026-10-03', ['daily', 'more']);
    expect(next?.payload).toBe('d');
    expect(rest.map((x) => x.key)).toEqual(['more']);
    expect(dropped).toEqual([]);
  });
  it('drops everything from yesterday (a tab alive across midnight)', () => {
    const q = [{ key: 'daily', day: '2026-10-02', payload: 'd' }];
    const { next, rest, dropped } = takeNextCelebration(q, '2026-10-03', ['daily', 'more']);
    expect(next).toBeNull();
    expect(rest).toEqual([]);
    expect(dropped).toHaveLength(1);
  });
});

describe('late achievement / tier popups in the badge queue', () => {
  const item = (key: string): BadgeCelebration => ({ kind: 'achievement', key, name: key, description: '', badge: 'star', accent: '#000' });
  beforeEach(() => { while (getCelebrations().length) dismissCelebration(); });

  it('marks late items and shows live ones first', () => {
    queueCelebrations([item('synced')], { late: true });
    queueCelebrations([item('live')]);
    expect(getCelebrations().map((c) => [c.kind === 'achievement' ? c.key : '', !!c.late])).toEqual([['synced', true], ['live', false]]);
    const first = nextCelebration(getCelebrations());
    expect(first && first.kind === 'achievement' ? first.key : null).toBe('live');
    dismissCelebration(first!);
    const second = nextCelebration(getCelebrations());
    expect(second && second.kind === 'achievement' ? second.key : null).toBe('synced');
    expect(second?.late).toBe(true);
  });

  it('a live duplicate of a queued late item does not jump the calm gate', () => {
    queueCelebrations([{ kind: 'tier', level: 26, tier: 'gold', accent: '#f5a524' }], { late: true });
    queueCelebrations([{ kind: 'tier', level: 26, tier: 'gold', accent: '#f5a524' }]);
    expect(getCelebrations()).toHaveLength(1);
    expect(getCelebrations()[0].late).toBe(true);
  });
});
