// VS Gauntlet matches solo (founder 10-02): a player's race clock PAUSES while
// their own stage card is up — the same rule as solo's useActivePlayTimer,
// which stops while showTransition is true. Pure, so the times recorded for
// the race and each stage provably exclude the card time.

export interface PauseLedger {
  /** Paused time already banked (ms). */
  pausedMs: number;
  /** When the current pause began, or null while running. */
  pausedAt: number | null;
}

export const RUNNING: PauseLedger = { pausedMs: 0, pausedAt: null };

/** Start a pause at `now` (no-op if already paused). */
export function pauseAt(l: PauseLedger, now: number): PauseLedger {
  return l.pausedAt != null ? l : { ...l, pausedAt: now };
}

/** End a pause at `now`, banking its length (no-op if running). */
export function resumeAt(l: PauseLedger, now: number): PauseLedger {
  return l.pausedAt == null ? l : { pausedMs: l.pausedMs + Math.max(0, now - l.pausedAt), pausedAt: null };
}

/** Active play since `start` (ms): wall time minus every pause, including one in progress. */
export function activeMs(start: number, l: PauseLedger, now: number): number {
  const live = l.pausedAt != null ? Math.max(0, now - l.pausedAt) : 0;
  return Math.max(0, now - start - l.pausedMs - live);
}
