import { simpleHash } from './seed';

/**
 * Epoch-indexed puzzle banks (More Games §11).
 *
 * ProperNoundle picks its daily with `dayIndex % bank.length`, which changes
 * for EVERY future day the moment the bank grows — so a web deploy carrying a
 * longer bank and an older app would serve different puzzles on the same
 * date. Every new bank instead indexes from a fixed per-mode epoch and never
 * wraps while the bank still has unplayed entries: day k after the epoch is
 * always entry k, whatever the bank's length. Appending entries changes
 * nothing already dated. A runway check in CI fails when fewer than 60 days
 * of unplayed entries remain, so the modulo fallback below is a safety net,
 * not a plan.
 *
 * Banks carry `{ daily, extra }`: dailies are drawn from `daily`, Unlimited
 * from `extra`, so an Unlimited game can never spoil a future daily.
 *
 * Parity-critical: Bank.swift / Bank.kt reproduce this exactly and
 * bank-fixtures.json pins all three.
 */

/** Whole UTC days from `epoch` to `day` (both YYYY-MM-DD); null if unparseable. */
export function bankDayIndex(day: string, epoch: string): number | null {
  const from = Date.parse(`${epoch}T00:00:00Z`);
  const to = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86400000);
}

/**
 * Index into a bank of `n` entries for the daily on `day`. Days before the
 * epoch and days past the end of the bank fall back to a stable modulo so
 * the client never crashes; both are conditions the runway check exists to
 * prevent. Returns 0 for an empty bank.
 */
export function bankIndexForDay(day: string, n: number, epoch: string): number {
  if (n <= 0) return 0;
  const idx = bankDayIndex(day, epoch);
  if (idx === null) return 0;
  if (idx >= 0 && idx < n) return idx;
  return ((idx % n) + n) % n;
}

/**
 * Index into a bank of `n` entries for an Unlimited seed. Deterministic per
 * seed (same seed → same puzzle on every platform). If `avoid` is given and
 * the hash lands on it, step to the next entry so Unlimited never repeats the
 * entry the caller wants kept aside.
 */
export function bankIndexForSeed(seed: string, n: number, avoid?: number): number {
  if (n <= 0) return 0;
  const idx = simpleHash(seed) % n;
  if (avoid !== undefined && n > 1 && idx === avoid) return (idx + 1) % n;
  return idx;
}
