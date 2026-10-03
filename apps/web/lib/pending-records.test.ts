import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateDailySeed } from '@wordle-duel/core';

// Outage protection for the pending-record queue (Muddle 10-02: a daily
// finished while Supabase REST hung never reached Home or the leaderboard).
// A timed-out or aborted write must leave its payload queued, Home's card must
// flip at finish anyway, and a retry must never count the game twice.

type Op = { table: string; action: 'select' | 'insert' | 'update'; payload: unknown };
type Handler = (op: Op) => unknown;

const h = vi.hoisted(() => ({ handler: null as unknown as (op: any) => unknown, ops: [] as any[] }));

function makeClient() {
  return {
    from(table: string) {
      const st: Op = { table, action: 'select', payload: null };
      const b: any = {};
      for (const m of ['select', 'eq', 'gt', 'limit', 'order', 'maybeSingle', 'single']) b[m] = () => b;
      b.insert = (p: unknown) => { st.action = 'insert'; st.payload = p; return b; };
      b.update = (p: unknown) => { st.action = 'update'; st.payload = p; return b; };
      b.then = (res: any, rej: any) => {
        h.ops.push({ ...st });
        const fn = h.handler; // the server state when the request was SENT
        return Promise.resolve().then(() => fn(st)).then(res, rej);
      };
      return b;
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
  };
}

vi.mock('./supabase-client', () => ({ supabase: makeClient() }));
vi.mock('@/hooks/use-toast', () => ({ toast: () => {} }));
vi.mock('@sentry/nextjs', () => ({ captureMessage: () => {}, captureException: () => {} }));
vi.mock('./achievement-service', () => ({ checkAchievements: async () => {}, announceNewAchievements: () => {} }));
vi.mock('./shield-service', () => ({ grantFreeShield: async () => {} }));
vi.mock('./friends-service', () => ({ beatCheck: async () => {} }));

// ---- a minimal browser: localStorage + window events ----
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const storage = new MemStorage();
const win = new EventTarget();
(globalThis as any).window = win;
(globalThis as any).localStorage = storage;
(globalThis as any).document = Object.assign(new EventTarget(), { visibilityState: 'visible' });

const { recordGameResult, drainPendingRecords } = await import('./stats-service');
const { getTodayLocal } = await import('./daily-service');
const { pendingRecordKey, readPendingRecord, pendingTodayCompletions, RECORD_WRITE_TIMEOUT_MS } = await import('./pending-records');

const USER = 'u1';
const MODE = 'SCRAMBLE';
const today = getTodayLocal();
const seed = generateDailySeed(today, MODE);
const key = pendingRecordKey(MODE, seed);
// A plausible Muddle win: 7 checks in 95 s over 5 boards.
const finish = () => recordGameResult(USER, MODE, 'solo', true, 7, 95_000, seed, 5, 5, 0);

const ABORTED = { data: null, error: { message: 'AbortError: signal is aborted without reason', details: '', hint: '', code: '' }, status: 0 };
/** A healthy server: one existing user_stats row + profile, writes succeed. */
const healthy: Handler = (op) => {
  if (op.action !== 'select') return { data: null, error: null };
  if (op.table === 'user_stats') return { data: { id: 's1', wins: 3, losses: 1, total_games: 4, best_score: 6, average_time: 100, fastest_time: 80 }, error: null };
  if (op.table === 'profiles') return { data: { total_wins: 3, total_losses: 1, current_streak: 1, best_streak: 2, xp: 500, level: 1, last_played_at: null, daily_login_streak: 0, best_daily_login_streak: 0, gold_medals: 0 }, error: null };
  return { data: null, error: null, count: 0 };
};

let events: any[] = [];
const onEvent = (e: Event) => events.push((e as CustomEvent).detail);

beforeEach(() => {
  storage.clear();
  h.ops = [];
  events = [];
  win.addEventListener('daily-completion', onEvent);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  win.removeEventListener('daily-completion', onEvent);
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('pending-record queue under an outage', () => {
  it('an aborted request (postgrest resolves { error, status 0 }) leaves the payload queued, part not done', async () => {
    h.handler = () => ABORTED;
    const xp = await finish();
    expect(xp).toBeNull();
    const p = readPendingRecord(key)!;
    expect(p).toBeTruthy();
    expect(p.gameResult?.guessCount).toBe(7);
    expect(p.gameResultDone).toBe(false);
    expect(p.progressionDone).toBe(false);
    expect(p.dailyDone).toBe(false);
  });

  it('a request that rejects with an AbortError leaves the payload queued', async () => {
    h.handler = () => { throw new DOMException('The operation was aborted.', 'AbortError'); };
    await finish();
    expect(readPendingRecord(key)?.gameResultDone).toBe(false);
  });

  it('a request that never resolves times out into the queue instead of hanging the finish', async () => {
    vi.useFakeTimers();
    h.handler = () => new Promise(() => {});
    const done = finish();
    await vi.advanceTimersByTimeAsync(RECORD_WRITE_TIMEOUT_MS + 10);
    expect(await done).toBeNull();
    const p = readPendingRecord(key)!;
    expect(p.gameResultDone).toBe(false);
    expect(p.dailyDone).toBe(false);
  });

  it("flips Home's card at finish, before any write lands", async () => {
    vi.useFakeTimers();
    h.handler = () => new Promise(() => {}); // hung
    const live = finish();
    await Promise.resolve();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ gameMode: MODE, won: true, guesses: 7, timeSeconds: 95 });
    expect(events[0].score).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(RECORD_WRITE_TIMEOUT_MS + 10);
    await live;
  });

  it("keeps today's queued result visible to Home across a reload", async () => {
    h.handler = () => ABORTED;
    await finish();
    const pending = pendingTodayCompletions(USER, today);
    expect(pending.get(MODE)).toMatchObject({ won: true, guesses: 7, timeSeconds: 95 });
    expect(pendingTodayCompletions('someone-else', today).size).toBe(0);
  });

  it('a retry after progression landed writes only the daily row (no double count), then refreshes Home', async () => {
    // Live finish: progression succeeds, daily_results times out.
    h.handler = (op) => (op.table === 'daily_results' ? ABORTED : healthy(op));
    await finish();
    let p = readPendingRecord(key)!;
    expect(p.progressionDone).toBe(true);
    expect(p.dailyDone).toBe(false);
    expect(p.gameResultDone).toBe(false);

    // Back online: the drain re-runs ONLY the daily row.
    h.ops = [];
    events = [];
    h.handler = healthy;
    await drainPendingRecords(USER);
    const statsWrites = h.ops.filter((o) => (o.table === 'user_stats' || o.table === 'profiles') && o.action !== 'select');
    expect(statsWrites).toHaveLength(0);
    expect(h.ops.some((o) => o.table === 'daily_results' && o.action === 'insert')).toBe(true);
    p = readPendingRecord(key)!;
    expect(p === null || p.gameResultDone).toBe(true);
    // (d) the confirmed retry re-fires the event Home listens to.
    expect(events.some((e) => e.gameMode === MODE)).toBe(true);
  });

  it('a result the plausibility floor rejects marks the daily part done instead of queuing forever', async () => {
    h.handler = healthy;
    // 7 checks in 2 s: below Muddle's 12 s floor.
    await recordGameResult(USER, MODE, 'solo', true, 7, 2_000, seed, 5, 5, 0);
    const p = readPendingRecord(key);
    expect(p === null || (p.dailyDone && p.gameResultDone)).toBe(true);
    expect(h.ops.some((o) => o.table === 'daily_results' && o.action !== 'select')).toBe(false);
  });

  it('a server CHECK rejection (23514) is terminal; any other server error stays queued', async () => {
    h.handler = (op) => (op.table === 'daily_results' && op.action === 'insert'
      ? { data: null, error: { code: '23514', message: 'not play' } } : healthy(op));
    await finish();
    expect(readPendingRecord(key)).toBeNull();

    storage.clear();
    h.handler = (op) => (op.table === 'daily_results' && op.action === 'insert'
      ? { data: null, error: { code: '42501', message: 'rls' } } : healthy(op));
    await finish();
    expect(readPendingRecord(key)?.dailyDone).toBe(false);
  });

  it('never replays a game whose live record call is still in flight', async () => {
    vi.useFakeTimers();
    h.handler = () => new Promise(() => {}); // the live call hangs
    const live = finish();
    // Let the live call reach its (hanging) first request.
    while (h.ops.length === 0) await Promise.resolve();
    h.ops = [];
    h.handler = healthy;
    await drainPendingRecords(USER);
    // Nothing for this game was touched while the live call was pending.
    expect(h.ops).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(RECORD_WRITE_TIMEOUT_MS + 10);
    await live;
    expect(readPendingRecord(key)?.gameResultDone).toBe(false);
  });

  it('overlapping drains share one run', async () => {
    h.handler = () => ABORTED;
    await finish();
    h.handler = healthy;
    const a = drainPendingRecords(USER);
    const b = drainPendingRecords(USER);
    expect(a).toBe(b);
    await a;
  });
});
