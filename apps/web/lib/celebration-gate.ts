// Late celebrations wait for a calm moment (outage fix, 2026-10-03; iOS +
// Android + web share these rules).
//
// During a Supabase outage the founder's last daily wrote late, and the Daily
// Sweep celebration popped at an awkward moment. Celebrations that come from a
// late write now queue until the player is calm: on Home at its root, nothing
// open (no game, modal, dialog or sheet) and no other popup up. When that
// moment comes, a sweep / flawless celebration whose day is no longer today is
// dropped. The existing once-per-day guards stay as they are.
//
//   • Daily Sweep / Flawless / Puzzles sweep — ALWAYS gated on calm.
//   • Achievement / tier popups — a LIVE finish keeps today's behavior; a LATE
//     one (pending-records replay, launch / visibility achievement sync, or a
//     live finish whose result came back > LATE_AFTER_MS after the record call
//     started) waits for calm.
//
// Pure + node-safe: no DOM at import time (the DOM probe is a separate helper).

/** A live result that lands later than this after its record call started is "late". */
export const LATE_AFTER_MS = 6_000;
/** While something is queued, how often calm is re-checked. */
export const CALM_POLL_MS = 500;
/** Once calm, the beat before presenting (calm must still hold after it). */
export const CALM_SETTLE_MS = 400;

export type CelebrationSource = 'live' | 'replay' | 'sync';

export interface CalmInputs {
  /** Home ("/") is on screen at its root (and the tab is visible). */
  onHomeRoot: boolean;
  /** A game, modal, dialog or sheet is open. */
  anythingOpen: boolean;
  /** Another popup is up (a celebration, achievement popup, streak / shield popup, Pro welcome…). */
  popupUp: boolean;
}

export function isCalm({ onHomeRoot, anythingOpen, popupUp }: CalmInputs): boolean {
  return onHomeRoot && !anythingOpen && !popupUp;
}

/**
 * Whether a celebration must wait for calm. Replays and syncs are always late;
 * a live finish is late once its result came back more than LATE_AFTER_MS
 * after the record call started.
 */
export function isLate(source: CelebrationSource, startedAtMs: number, nowMs: number): boolean {
  if (source !== 'live') return true;
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - startedAtMs > LATE_AFTER_MS;
}

/** A sweep / flawless celebration whose day is no longer today is dropped at present time. */
export function shouldDrop(celebrationDay: string, today: string): boolean {
  return celebrationDay !== today;
}

// ── The tiny queue ──────────────────────────────────────────────────────────

export interface QueuedCelebration<T> {
  /** One slot per key (e.g. 'sweep', 'more'): a re-queue replaces the payload in place. */
  key: string;
  /** The local day (YYYY-MM-DD) it celebrates. */
  day: string;
  payload: T;
}

/** Adds (or refreshes in place) a queued celebration; returns a new array. */
export function enqueueCelebration<T>(queue: readonly QueuedCelebration<T>[], item: QueuedCelebration<T>): QueuedCelebration<T>[] {
  const i = queue.findIndex((q) => q.key === item.key);
  if (i < 0) return [...queue, item];
  const next = queue.slice();
  next[i] = item;
  return next;
}

/**
 * The calm moment came: drops every entry whose day isn't today, then takes
 * the first one (by `priority` order of keys when given, else queue order).
 */
export function takeNextCelebration<T>(
  queue: readonly QueuedCelebration<T>[],
  today: string,
  priority: readonly string[] = [],
): { next: QueuedCelebration<T> | null; rest: QueuedCelebration<T>[]; dropped: QueuedCelebration<T>[] } {
  const dropped = queue.filter((q) => shouldDrop(q.day, today));
  const live = queue.filter((q) => !shouldDrop(q.day, today));
  if (live.length === 0) return { next: null, rest: [], dropped };
  const rank = (k: string) => { const r = priority.indexOf(k); return r < 0 ? priority.length : r; };
  let best = 0;
  for (let i = 1; i < live.length; i++) if (rank(live[i].key) < rank(live[best].key)) best = i;
  const next = live[best];
  return { next, rest: live.filter((_, i) => i !== best), dropped };
}

// ── The DOM probe (browser only; callers gate on calm with it) ─────────────

/**
 * Anything open or up that a late celebration must not interrupt: dialogs and
 * sheets (role=dialog / alertdialog, aria-modal — Radix, vaul and every popup
 * here use these), the R1 win / lose popup, and surfaces that opt in with
 * `data-celebration-block`.
 */
export const BLOCKING_SELECTOR = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], .result-pop, [data-celebration-block]';

/** Reads the calm inputs from the live page. `extraPopupUp` = a popup the caller knows about. */
export function readCalmInputs(extraPopupUp = false): CalmInputs {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { onHomeRoot: false, anythingOpen: true, popupUp: true };
  }
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return {
    onHomeRoot: path === '/' && document.visibilityState === 'visible',
    anythingOpen: !!document.querySelector(BLOCKING_SELECTOR),
    popupUp: extraPopupUp,
  };
}
