import { describe, it, expect, vi } from 'vitest';
import {
  PENDING_RACES_KEY, PENDING_RACE_MAX_AGE_MS, isRetryableFailure, pendingDecision, readPendingRaces,
  retryPendingRaces, savePendingRace, writePendingRaces, type PendingRace, type StorageLike,
} from './vs-pending-races';
import { keepWaitingPingLine, lookingRowLabel, vsLookingOn } from './vs-lobby';
import type { ChallengeRun } from './vs-challenges-client';

// VS overhaul spec §13 (ping lines) and §14 (race results never get lost).

function memoryStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PENDING_RACES_KEY, initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); } };
}

const RUN: ChallengeRun = { solved: true, boardsSolved: 1, totalBoards: 1, guesses: 4, timeMs: 90_000, guessLog: ['CRANE'], solutions: ['CRANE'] };
const NOW = Date.parse('2026-10-01T12:00:00Z');
const item = (code: string, over: Partial<PendingRace> = {}): PendingRace => ({ code, gameMode: 'DUEL', seed: `seed-${code}`, run: RUN, savedAt: NOW - 60_000, ...over });
const ok = (alreadyRecorded: boolean, outcome: 'win' | 'loss' | 'draw' = 'win') => ({ outcome, margin: 'by 1 guess', challengerRun: RUN, alreadyRecorded });
const fail = (status: number) => ({ error: 'x', status });

describe('pending race store', () => {
  it('reads empty on missing, corrupt or throwing storage', () => {
    expect(readPendingRaces(memoryStorage())).toEqual([]);
    expect(readPendingRaces(memoryStorage('{nope'))).toEqual([]);
    expect(readPendingRaces(memoryStorage('{"a":1}'))).toEqual([]);
    expect(readPendingRaces({ getItem: () => { throw new Error('blocked'); }, setItem: () => {} })).toEqual([]);
    expect(readPendingRaces(null)).toEqual([]);
  });

  it('keeps one item per code (the newest wins)', () => {
    const s = memoryStorage();
    savePendingRace(item('AAA'), s);
    savePendingRace(item('BBB'), s);
    savePendingRace(item('AAA', { savedAt: NOW }), s);
    const list = readPendingRaces(s);
    expect(list.map((p) => p.code).sort()).toEqual(['AAA', 'BBB']);
    expect(list.find((p) => p.code === 'AAA')!.savedAt).toBe(NOW);
  });

  it('never throws when the write fails', () => {
    expect(() => writePendingRaces([item('A')], { getItem: () => null, setItem: () => { throw new Error('full'); } })).not.toThrow();
  });

  it('saves only network errors and 5xx', () => {
    expect(isRetryableFailure(0)).toBe(true);
    expect(isRetryableFailure(500)).toBe(true);
    expect(isRetryableFailure(503)).toBe(true);
    expect(isRetryableFailure(404)).toBe(false);
    expect(isRetryableFailure(410)).toBe(false);
  });
});

describe('pending race decisions (§14)', () => {
  it('records new results, drops repeats and client errors, keeps network/5xx', () => {
    expect(pendingDecision(ok(false))).toBe('record');
    expect(pendingDecision(ok(true))).toBe('drop');
    for (const st of [400, 403, 404, 410]) expect(pendingDecision(fail(st))).toBe('drop');
    expect(pendingDecision(fail(0))).toBe('keep');
    expect(pendingDecision(fail(502))).toBe('keep');
    expect(pendingDecision(fail(401))).toBe('keep');
  });
});

describe('retryPendingRaces', () => {
  it('follows §14 for each item and rewrites the list', async () => {
    const s = memoryStorage();
    writePendingRaces([
      item('NEW'), item('DUP'), item('GONE'), item('DOWN'), item('OFF'), item('OLD', { savedAt: NOW - PENDING_RACE_MAX_AGE_MS - 1 }),
    ], s);
    const answers: Record<string, ReturnType<typeof ok> | ReturnType<typeof fail>> = {
      NEW: ok(false, 'draw'), DUP: ok(true), GONE: fail(410), DOWN: fail(503),
    };
    const post = vi.fn(async (code: string) => {
      if (code === 'OFF') throw new TypeError('fetch failed');
      return answers[code];
    });
    const record = vi.fn(async () => {});
    const tally = await retryPendingRaces({ post, record, now: NOW, storage: s });

    expect(post).not.toHaveBeenCalledWith('OLD', expect.anything());
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ code: 'NEW', seed: 'seed-NEW' }), 'draw');
    expect(readPendingRaces(s).map((p) => p.code)).toEqual(['DOWN', 'OFF']);
    expect(tally).toEqual({ recorded: 1, kept: 2, dropped: 3 });
  });

  it('records a quit as a loss whatever the server scores', async () => {
    const s = memoryStorage();
    writePendingRaces([item('Q', { quit: true, run: { ...RUN, solved: false } })], s);
    const record = vi.fn(async () => {});
    await retryPendingRaces({ post: async () => ok(false, 'draw'), record, now: NOW, storage: s });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ code: 'Q' }), 'loss');
    expect(readPendingRaces(s)).toEqual([]);
  });

  it('drops an accepted item even if the stats write throws (never counted twice)', async () => {
    const s = memoryStorage();
    writePendingRaces([item('A')], s);
    await retryPendingRaces({ post: async () => ok(false), record: async () => { throw new Error('db'); }, now: NOW, storage: s });
    expect(readPendingRaces(s)).toEqual([]);
  });

  it('keeps a result saved while the retry was posting', async () => {
    const s = memoryStorage();
    writePendingRaces([item('A')], s);
    await retryPendingRaces({
      post: async () => { savePendingRace(item('LATE', { savedAt: NOW + 5 }), s); return ok(true); },
      record: async () => {},
      now: NOW,
      storage: s,
    });
    expect(readPendingRaces(s).map((p) => p.code)).toEqual(['LATE']);
  });

  it('shares one pass between overlapping calls', async () => {
    const s = memoryStorage();
    writePendingRaces([item('A')], s);
    const post = vi.fn(async () => ok(false));
    const record = vi.fn(async () => {});
    await Promise.all([
      retryPendingRaces({ post, record, now: NOW, storage: s }),
      retryPendingRaces({ post, record, now: NOW, storage: s }),
    ]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(1);
  });
});

describe('ping me when someone is looking (§13)', () => {
  it('reads the opt-in as OFF unless exactly true', () => {
    expect(vsLookingOn(undefined)).toBe(false);
    expect(vsLookingOn({})).toBe(false);
    expect(vsLookingOn({ race: true })).toBe(false);
    expect(vsLookingOn({ vsLooking: false })).toBe(false);
    expect(vsLookingOn({ vsLooking: true })).toBe(true);
  });

  it('labels the row with the mode', () => {
    expect(lookingRowLabel('DUEL')).toBe('Ping me when someone’s looking for Classic');
    expect(lookingRowLabel('QUORDLE')).toBe('Ping me when someone’s looking for QuadWord');
  });

  it('builds the KEEP WAITING line', () => {
    expect(keepWaitingPingLine({ pinged: 3, throttled: false })).toBe('We pinged 3 players who play live.');
    expect(keepWaitingPingLine({ pinged: 1, throttled: false })).toBe('We pinged 1 player who plays live.');
    expect(keepWaitingPingLine({ pinged: 0, throttled: false })).toBe('Nobody has pings on yet. We’ll keep looking.');
    expect(keepWaitingPingLine({ pinged: 0, throttled: true })).toBeNull();
    expect(keepWaitingPingLine(null)).toBeNull();
  });
});
