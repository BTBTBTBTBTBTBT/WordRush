// ============================================================
// Pending-record queue: storage, in-flight tracking, write timeouts
// ============================================================
//
// The localStorage half of the crash/outage protection in stats-service.ts,
// split out (dependency-light) so the DailyCompletionsProvider can read
// today's queued results without pulling the whole recording pipeline into
// the layout bundle.
//
// Each solo record call writes a compact arg payload BEFORE touching the
// network; each half is flagged done only when its writes are CONFIRMED:
//   gameResult    = the whole recordGameResult (progression + daily row)
//   progressionDone = user_stats + profile landed (a retry must not re-count)
//   dailyDone     = the daily_results row landed, or was permanently rejected
//   soloMatch     = the matches history row
// A timeout or network failure leaves the payload pending for the drain.

import { getDailySeedDate, isDailySeed } from '@wordle-duel/core';
import { calculateCompositeScore } from './composite-scoring';
import { isPlausibleDailyResult } from './plausibility';

export const PENDING_RECORD_PREFIX = 'wordocious-pending-record-';
export const PENDING_RECORD_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PendingGameResultArgs {
  won: boolean;
  guessCount: number;
  timeMs: number;
  boardsSolved?: number;
  totalBoards?: number;
  hintsUsed: number;
  stagesCompleted?: number;
  bestCorrectLetters?: number;
}

export interface PendingSoloMatchArgs {
  won: boolean;
  score: number;
  timeSeconds: number;
  solutions: string[];
  guesses: string[];
  startedAtIso: string;
  hintsUsed?: number;
}

export interface PendingRecordPayload {
  userId: string;
  gameMode: string;
  seed: string;
  savedAt: number;
  gameResult?: PendingGameResultArgs;
  gameResultDone?: boolean;
  /** user_stats + profile (XP, level, streaks) confirmed written. */
  progressionDone?: boolean;
  /** daily_results row confirmed written, or permanently rejected (plausibility / no score config). */
  dailyDone?: boolean;
  soloMatch?: PendingSoloMatchArgs;
  soloMatchDone?: boolean;
}

export function pendingRecordKey(gameMode: string, seed: string): string {
  return `${PENDING_RECORD_PREFIX}${gameMode}-${seed}`;
}

export function readPendingRecord(key: string): PendingRecordPayload | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PendingRecordPayload) : null;
  } catch {
    return null;
  }
}

/** Every pending-record key currently in localStorage. */
export function pendingRecordKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PENDING_RECORD_PREFIX)) keys.push(k);
    }
  } catch {}
  return keys;
}

/** Merge a patch into the pending payload for this game (creating it if absent). */
export function mergePendingRecord(
  userId: string,
  gameMode: string,
  seed: string,
  patch: Partial<PendingRecordPayload>,
): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingRecordKey(gameMode, seed);
    const existing = readPendingRecord(key);
    const next: PendingRecordPayload = {
      ...existing,
      userId,
      gameMode,
      seed,
      savedAt: existing?.savedAt ?? Date.now(),
      ...patch,
    };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

/** Mark one half of the pending payload complete; remove the key when all registered parts are done. */
export function markPendingRecordDone(gameMode: string, seed: string, part: 'gameResult' | 'soloMatch'): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingRecordKey(gameMode, seed);
    const p = readPendingRecord(key);
    if (!p) return;
    if (part === 'gameResult') p.gameResultDone = true;
    else p.soloMatchDone = true;
    const allDone = (!p.gameResult || p.gameResultDone) && (!p.soloMatch || p.soloMatchDone);
    if (allDone) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}

/** Flag a sub-step of the gameResult half (progression / daily row) as confirmed. */
export function markPendingSubstepDone(gameMode: string, seed: string, flag: 'progressionDone' | 'dailyDone'): void {
  if (typeof window === 'undefined') return;
  try {
    const key = pendingRecordKey(gameMode, seed);
    const p = readPendingRecord(key);
    if (!p) return;
    p[flag] = true;
    localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}

// ---- In-flight live writes ----
// A drain must never replay a game whose LIVE record call is still running
// (a hung write during an outage): it would count the game twice.
const inFlight = new Map<string, number>();

export function beginInFlight(key: string): void {
  inFlight.set(key, (inFlight.get(key) ?? 0) + 1);
}
export function endInFlight(key: string): void {
  const n = (inFlight.get(key) ?? 0) - 1;
  if (n > 0) inFlight.set(key, n);
  else inFlight.delete(key);
}
export function isInFlight(key: string): boolean {
  return (inFlight.get(key) ?? 0) > 0;
}

// ---- Write timeouts ----
// supabase-js has no request timeout: during an outage a REST call can hang
// 15–30 s or forever, which held the finish flow and the queue hostage.
export const RECORD_WRITE_TIMEOUT_MS = 15_000;

export class RecordWriteTimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`TimeoutError: ${label} timed out after ${ms} ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Run a supabase query (or any thenable) with a hard timeout. The query is
 * also handed an AbortSignal when it supports one, so the request is actually
 * canceled. An abort RESOLVES in postgrest-js as `{ error: { code: '' } }`;
 * the race REJECTS — callers treat both as "not confirmed", never as done.
 */
export function withRecordTimeout<T>(query: PromiseLike<T>, label: string, ms: number = RECORD_WRITE_TIMEOUT_MS): Promise<T> {
  let q: PromiseLike<T> = query;
  try {
    const anyQ = query as any;
    if (typeof anyQ?.abortSignal === 'function' && typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') {
      q = anyQ.abortSignal((AbortSignal as any).timeout(ms));
    }
  } catch {}
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RecordWriteTimeoutError(label, ms)), ms);
  });
  return Promise.race([Promise.resolve(q), timeout]).finally(() => { if (timer) clearTimeout(timer); });
}

/**
 * A PostgREST error the server will raise again on every retry (the
 * plausibility trigger / CHECK constraint, errcode 23514). Transport failures
 * (abort, offline, timeout) carry code '' and stay retryable, as does
 * everything else — an RLS or 5xx blip must never drop a result.
 */
export function isPermanentRejection(error: any): boolean {
  return !!error && error.code === '23514';
}

// ---- Today's queued completions (Home's completed state) ----

export interface PendingCompletion {
  won: boolean;
  guesses: number;
  timeSeconds: number;
  score: number;
}

/**
 * Today's solo daily results that are still queued (finished during an
 * outage, daily row not yet confirmed) — keyed by dbKey, so Home keeps the
 * card completed across a reload while the write is pending.
 */
export function pendingTodayCompletions(userId: string, today: string): Map<string, PendingCompletion> {
  const out = new Map<string, PendingCompletion>();
  if (typeof window === 'undefined' || !userId) return out;
  for (const key of pendingRecordKeys()) {
    const p = readPendingRecord(key);
    if (!p || p.userId !== userId || !p.gameResult || p.dailyDone) continue;
    if (!p.seed || !isDailySeed(p.seed) || getDailySeedDate(p.seed) !== today) continue;
    const g = p.gameResult;
    const timeSeconds = Math.round((g.timeMs ?? 0) / 1000);
    const total = g.totalBoards ?? 1;
    const boards = g.boardsSolved ?? (g.won ? total : 0);
    // A result the server will refuse is never shown as a completion.
    if (g.won && g.guessCount <= 0) continue;
    if (!isPlausibleDailyResult(g.won, g.guessCount, timeSeconds, total, p.gameMode)) continue;
    out.set(p.gameMode, {
      won: !!g.won,
      guesses: g.guessCount,
      timeSeconds,
      score: Math.round(calculateCompositeScore(
        p.gameMode, g.won, g.guessCount, timeSeconds, boards, total, g.hintsUsed ?? 0,
        g.stagesCompleted, g.bestCorrectLetters, today,
      )),
    });
  }
  return out;
}

/** Never downgrade: a win beats a loss, then the higher score wins (daily_results keeps the best). */
export function preferCompletion<T extends PendingCompletion>(existing: T | undefined, incoming: T): T {
  if (!existing) return incoming;
  if (existing.won && !incoming.won) return existing;
  if (existing.won === incoming.won && (existing.score ?? 0) > (incoming.score ?? 0)) return existing;
  return incoming;
}

/** Add queued completions the server map doesn't have yet; a server row always stands. */
export function mergePendingCompletions<T extends PendingCompletion>(server: Map<string, T>, pending: Map<string, T>): Map<string, T> {
  if (pending.size === 0) return server;
  const out = new Map(server);
  for (const [k, v] of pending) {
    if (!out.has(k)) out.set(k, v);
  }
  return out;
}
