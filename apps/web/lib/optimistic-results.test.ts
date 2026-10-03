import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyLocalResult,
  loadResultStore,
  localResultsFor,
  mergeCompletions,
  mergeLeaderboard,
  pruneStore,
  reconcile,
  rerankAfterInsert,
  saveResultStore,
  updateResultStore,
  type LocalResult,
  type ResultStore,
} from './optimistic-results';
import {
  __forgetPageCacheMemory,
  clearPageCacheForUser,
  persistentMap,
  readPageCache,
  sameData,
  setCacheUser,
  setPageCacheStorage,
  writePageCache,
  MAX_TOTAL_CHARS,
} from './page-cache';
import { PersistentSWRCache } from './swr-persist';

// BI19 (founder, 2026-10-03): "the W and L will populate immediately now upon
// return to the main menu as well as the leaderboard immediately populating
// the results … make sure the information on all pages is quick to load and
// stays every time."

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  get length() { return this.m.size; }
}

const DAY = '2026-10-03';
const U = 'user-1';
const finish = (mode: string, over: Partial<LocalResult> = {}): LocalResult => ({
  userId: U, day: DAY, mode, won: true, guesses: 4, timeSeconds: 90, score: 820, savedAt: 1, ...over,
});

type Row = { user_id: string; composite_score: number; time_seconds: number; username?: string };
const row = (user_id: string, composite_score: number, time_seconds: number): Row => ({ user_id, composite_score, time_seconds });

describe('a finish → Home W / L, synchronously from the local store', () => {
  it('shows the result before any server data exists', () => {
    const storage = new MemoryStorage();
    updateResultStore((st) => applyLocalResult(st, finish('DUEL')), storage);
    updateResultStore((st) => applyLocalResult(st, finish('SIX', { won: false, score: 120 })), storage);
    // Home's map = server (nothing yet) + local — no await anywhere.
    const home = mergeCompletions(new Map(), localResultsFor(loadResultStore(storage), U, DAY));
    expect(home.get('DUEL')).toEqual({ won: true, guesses: 4, timeSeconds: 90, score: 820 });
    expect(home.get('SIX')?.won).toBe(false);
  });

  it('never downgrades a better finish for the same mode', () => {
    let st: ResultStore = {};
    st = applyLocalResult(st, finish('DUEL', { score: 900 }));
    st = applyLocalResult(st, finish('DUEL', { score: 500 }));
    expect(localResultsFor(st, U, DAY).get('DUEL')?.score).toBe(900);
    st = applyLocalResult(st, finish('DUEL', { won: false, score: 2000 }));
    expect(localResultsFor(st, U, DAY).get('DUEL')?.won).toBe(true);
  });

  it('a server row always stands over the local one', () => {
    const server = new Map([['DUEL', { won: false, guesses: 6, timeSeconds: 200, score: 100 }]]);
    const merged = mergeCompletions(server, localResultsFor(applyLocalResult({}, finish('DUEL')), U, DAY));
    expect(merged.get('DUEL')?.won).toBe(false);
  });

  it('drops past days', () => {
    const st = applyLocalResult(applyLocalResult({}, finish('DUEL', { day: '2026-10-02' })), finish('SIX'));
    expect(Object.values(pruneStore(st, DAY)).map((r) => r.mode)).toEqual(['SIX']);
  });
});

describe('mergeLeaderboard', () => {
  const server = [row('a', 900, 50), row('b', 800, 60), row('c', 800, 90), row('d', 500, 40)];

  it('places the local row in rank order, flagged optimistic + mine', () => {
    const { rows, inserted, index } = mergeLeaderboard(server, row('me', 800, 70), 'me', 'daily');
    expect(inserted).toBe(true);
    expect(index).toBe(2);
    expect(rows.map((r) => r.user_id)).toEqual(['a', 'b', 'me', 'c', 'd']);
    expect(rows[2]).toMatchObject({ isOptimistic: true, isMe: true });
  });

  it('an exact tie stays behind the server rows it ties', () => {
    const { rows } = mergeLeaderboard(server, row('me', 800, 60), 'me', 'daily');
    expect(rows.map((r) => r.user_id)).toEqual(['a', 'b', 'me', 'c', 'd']);
  });

  it('goes last when it beats nobody, and not at all past the limit', () => {
    expect(mergeLeaderboard(server, row('me', 10, 999), 'me', 'daily').rows.at(-1)?.user_id).toBe('me');
    expect(mergeLeaderboard(server, row('me', 10, 999), 'me', 'daily', 4).inserted).toBe(false);
  });

  it('inserts nothing once the server has the player (that row is marked mine)', () => {
    const withMe = [...server.slice(0, 1), row('me', 850, 10), ...server.slice(1)];
    const { rows, inserted } = mergeLeaderboard(withMe, row('me', 999, 1), 'me', 'daily');
    expect(inserted).toBe(false);
    expect(rows).toHaveLength(5);
    expect(rows[1]).toMatchObject({ user_id: 'me', composite_score: 850, isMe: true });
    expect(rows[1].isOptimistic).toBeUndefined();
  });

  it('ranks the overall (Sweep) board by total score, then total time, and re-ranks below', () => {
    const sweep = [
      { user_id: 'a', total_score: 7000, total_time: 900, rank: 1 },
      { user_id: 'b', total_score: 6000, total_time: 800, rank: 2 },
      { user_id: 'c', total_score: 5000, total_time: 700, rank: 3 },
    ];
    const merged = mergeLeaderboard(sweep, { user_id: 'me', total_score: 6500, total_time: 600, rank: 0 }, 'me', 'sweep');
    const rows = rerankAfterInsert(merged.rows, merged.index);
    expect(rows.map((r) => [r.user_id, r.rank])).toEqual([['a', 1], ['me', 2], ['b', 3], ['c', 4]]);
  });
});

describe('reconcile', () => {
  it('a server reconcile replaces the local row (equal or different, the server wins)', () => {
    let st: ResultStore = applyLocalResult({}, finish('DUEL', { score: 820 }));
    st = applyLocalResult(st, finish('SIX'));
    // The server board now holds the player's DUEL row with a different score.
    const serverBoard = [row('a', 900, 50), row(U, 790, 95)];
    const merged = mergeLeaderboard(serverBoard, row(U, 820, 90), U, 'daily');
    expect(merged.inserted).toBe(false);
    expect(merged.rows.find((r) => r.user_id === U)?.composite_score).toBe(790);
    st = reconcile(st, U, DAY, ['DUEL']);
    expect(localResultsFor(st, U, DAY).has('DUEL')).toBe(false);
    expect(localResultsFor(st, U, DAY).has('SIX')).toBe(true);
  });

  it('is a no-op (same object) when the server has nothing of ours', () => {
    const st = applyLocalResult({}, finish('DUEL'));
    expect(reconcile(st, U, DAY, ['SIX'])).toBe(st);
  });
});

describe('caches survive a relaunch', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
    setPageCacheStorage(storage);
    setCacheUser(U);
  });

  it('the optimistic store re-reads from storage', () => {
    saveResultStore(applyLocalResult({}, finish('DUEL')), storage);
    // "Relaunch": nothing in memory, read straight from storage.
    expect(localResultsFor(loadResultStore(storage), U, DAY).get('DUEL')?.score).toBe(820);
  });

  it('a board cache (with Maps inside) re-reads from storage', () => {
    const boards = persistentMap<{ lb: Row[]; details: Map<string, { guesses: number }> }>('lb');
    boards.set(`DUEL:${DAY}:${U}`, { lb: [row('a', 900, 50)], details: new Map([['a', { guesses: 3 }]]) });
    __forgetPageCacheMemory();
    const again = persistentMap<{ lb: Row[]; details: Map<string, { guesses: number }> }>('lb').get(`DUEL:${DAY}:${U}`);
    expect(again?.lb[0].user_id).toBe('a');
    expect(again?.details instanceof Map && again.details.get('a')?.guesses).toBe(3);
  });

  it('is per user and cleared on sign-out', () => {
    writePageCache('home:x', 1);
    expect(readPageCache('home:x', { user: 'someone-else' })).toBeUndefined();
    clearPageCacheForUser(U);
    __forgetPageCacheMemory();
    expect(readPageCache('home:x')).toBeUndefined();
  });

  it('day-scoped entries miss on another day', () => {
    writePageCache('home:streaks', { sweep: 3 }, { day: '2026-10-02' });
    __forgetPageCacheMemory();
    expect(readPageCache('home:streaks', { day: DAY })).toBeUndefined();
  });

  it('reports an identical write as unchanged (no swap, no re-render)', () => {
    expect(writePageCache('k', { a: [1, 2] })).toBe(true);
    expect(writePageCache('k', { a: [1, 2] })).toBe(false);
    expect(sameData(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true);
    expect(sameData(new Set([1]), new Set([2]))).toBe(false);
  });

  it('stays size-bounded (oldest entries evicted)', () => {
    const big = 'x'.repeat(200_000);
    for (let i = 0; i < 12; i++) writePageCache(`big:${i}`, big);
    const total = Array.from({ length: storage.length }, (_, i) => storage.key(i)!)
      .reduce((n, k) => n + (storage.getItem(k)?.length ?? 0), 0);
    expect(total).toBeLessThan(MAX_TOTAL_CHARS + 50_000);
    __forgetPageCacheMemory();
    expect(readPageCache('big:0')).toBeUndefined();
    expect(readPageCache('big:11')).toBe(big);
  });

  it('the SWR cache (Stats) persists its data and seeds it back', () => {
    const swr = new PersistentSWRCache(0);
    const bundle = { day: DAY, userAchievements: new Set(['first_win']), todayDailies: new Map([['DUEL', { won: true }]]) };
    swr.set('@"profile-static","user-1",', { data: bundle, isValidating: true });
    swr.set('$inf$@"x"', { data: 1 });
    swr.flush();
    __forgetPageCacheMemory();
    const relaunched = new PersistentSWRCache(0);
    expect(relaunched.hydrate()).toBe(1);
    const data = relaunched.get('@"profile-static","user-1",')?.data as typeof bundle;
    expect(data.userAchievements.has('first_win')).toBe(true);
    expect(data.todayDailies.get('DUEL')).toEqual({ won: true });
    expect(relaunched.get('@"profile-static","user-1",')?.isValidating).toBeUndefined();
  });
});
