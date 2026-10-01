// Race results never get lost (VS overhaul spec docs/VS_REDESIGN_SPEC.md §14).
// When posting a friend's-run race result fails with a network error or a
// 5xx, the run waits in a local pending list (one per challenge code) and is
// retried every time the VS lobby loads. The racer's own side (+ XP) is
// recorded only once the server accepts the result (alreadyRecorded: false).
// Pure logic here — storage, the POST and the stats write are injected — so it
// unit-tests without a browser.

import type { ChallengeRun, RaceResultResponse } from './vs-challenges-client';

export const PENDING_RACES_KEY = 'wordocious-vs-pending-races';
/** Anything older than this is dropped unsent. */
export const PENDING_RACE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
/** The result screen line when the result was saved for later. */
export const PENDING_RACE_SAVED_LINE = 'Saved. We’ll send your result when you’re back online.';

export interface PendingRace {
  code: string;
  gameMode: string;
  seed: string;
  run: ChallengeRun;
  /** Epoch ms. */
  savedAt: number;
  /** Quit mid-game: the racer's side records as a loss whatever the server scores. */
  quit?: boolean;
}

type PostResult = RaceResultResponse | { error: string; status: number };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** A failed POST worth keeping for later: a network error (status 0) or a 5xx. */
export function isRetryableFailure(status: number): boolean {
  return status === 0 || status >= 500;
}

function isPendingRace(x: unknown): x is PendingRace {
  const p = x as PendingRace | null;
  return !!p && typeof p.code === 'string' && typeof p.gameMode === 'string' && typeof p.seed === 'string'
    && typeof p.savedAt === 'number' && !!p.run && typeof p.run === 'object';
}

export function readPendingRaces(storage: StorageLike | null = defaultStorage()): PendingRace[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PENDING_RACES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isPendingRace) : [];
  } catch {
    return [];
  }
}

export function writePendingRaces(list: PendingRace[], storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_RACES_KEY, JSON.stringify(list));
  } catch { /* storage full or blocked: nothing to do */ }
}

/** Save (or replace — one per code) a race result to send later. */
export function savePendingRace(item: PendingRace, storage: StorageLike | null = defaultStorage()): void {
  const rest = readPendingRaces(storage).filter((p) => p.code !== item.code);
  writePendingRaces([...rest, item], storage);
}

export type PendingDecision = 'record' | 'drop' | 'keep';

/**
 * What to do with a pending item after a retry (§14): accepted and new →
 * record the racer's side then drop; already recorded → drop; a client error
 * (400/403/404/410…) → drop; network/5xx → keep. A 401 (no session yet) is
 * kept too — the 3-day cap still clears it.
 */
export function pendingDecision(res: PostResult): PendingDecision {
  if (!('error' in res)) return res.alreadyRecorded ? 'drop' : 'record';
  if (isRetryableFailure(res.status) || res.status === 401) return 'keep';
  return 'drop';
}

let inFlight: Promise<{ recorded: number; kept: number; dropped: number }> | null = null;

/**
 * Retry every pending race once (called when the VS lobby loads). `record`
 * writes the racer's side through the normal live-VS path with XP. Once the
 * server accepts, the item drops whatever the stats write does (a retry would
 * only answer alreadyRecorded), so nothing is ever counted twice.
 */
export function retryPendingRaces(deps: {
  post: (code: string, run: ChallengeRun, quit?: boolean) => Promise<PostResult>;
  record: (item: PendingRace, outcome: 'win' | 'loss' | 'draw') => Promise<unknown>;
  now?: number;
  storage?: StorageLike | null;
}): Promise<{ recorded: number; kept: number; dropped: number }> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
    const now = deps.now ?? Date.now();
    const tally = { recorded: 0, kept: 0, dropped: 0 };
    const keep: PendingRace[] = [];
    for (const item of readPendingRaces(storage)) {
      if (now - item.savedAt > PENDING_RACE_MAX_AGE_MS) { tally.dropped++; continue; }
      let res: PostResult;
      try {
        res = await deps.post(item.code, item.run, item.quit === true);
      } catch {
        res = { error: 'Network error', status: 0 };
      }
      const decision = pendingDecision(res);
      if (decision === 'keep') { keep.push(item); tally.kept++; continue; }
      if (decision === 'record' && !('error' in res)) {
        try { await deps.record(item, item.quit ? 'loss' : res.outcome); } catch { /* stats write has its own retry */ }
        tally.recorded++;
        continue;
      }
      tally.dropped++;
    }
    // Re-read so a result saved while we were posting (savedAt after this
    // pass began) is not lost; it wins over a kept copy of the same code.
    const fresh = readPendingRaces(storage).filter((p) => p.savedAt > now);
    writePendingRaces([...keep.filter((k) => !fresh.some((f) => f.code === k.code)), ...fresh], storage);
    return tally;
  })();
  return inFlight.finally(() => { inFlight = null; });
}
