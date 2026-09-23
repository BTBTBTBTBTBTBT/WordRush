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
 * Content runway for a bank of `n` dailies on `day`: how many unplayed
 * dailies remain after today, and the date the bank starts RECYCLING.
 *
 * Recycling is the modulo fallback in `bankIndexForDay`: once every entry has
 * run, day n replays entry 0, day n+1 entry 1, and so on — the oldest puzzle
 * first, a full lap later, deterministic on every platform. Appending new
 * entries before that date pushes the lap out without moving any dated day.
 * The founder is told BEFORE recycling begins (2026-09-23): a CI test fails
 * under 60 days, the nightly integrity cron flags under 90 days, and the
 * admin Ops page shows every bank's runway.
 */
export function bankRunway(day: string, n: number, epoch: string): { daysLeft: number; recyclesOn: string; recycling: boolean } {
  const idx = bankDayIndex(day, epoch) ?? 0;
  const daysLeft = n - idx - 1;
  const recycles = new Date(Date.parse(`${epoch}T00:00:00Z`) + n * 86400000);
  return { daysLeft, recyclesOn: recycles.toISOString().slice(0, 10), recycling: idx >= n };
}

// ── Holidays (More Games §20) ──────────────────────────────────────────────

/**
 * The shared holiday calendar, emitted as DATA by
 * apps/web/scripts/holidays/gen-holiday-days.mjs (apps/web/data/holiday-days.json,
 * bundled on every platform and sha-guarded): `days` maps YYYY-MM-DD to a
 * holiday key ("christmas", "mlkday", …). No platform ports the date rules.
 */
export interface HolidayTable { version: number; from: string; to: string; days: Record<string, string> }

/** The holiday key that owns `day`, or null on an ordinary day (or outside the table). */
export function holidayKeyForDay(day: string, table: HolidayTable | null | undefined): string | null {
  return table?.days?.[day] ?? null;
}

/**
 * How many days owned by `key` fall strictly BEFORE `day` in the table — the
 * k-th outing of a holiday (Christmas Eve 0, Christmas Day 1, Boxing Day 2 in
 * the first year; 3, 4, 5 the next). Banks pick holiday entry k mod n, so a
 * holiday with several entries walks through them in calendar order and a
 * holiday with one entry repeats it. Deterministic on every platform.
 */
export function holidayOccurrence(day: string, key: string, table: HolidayTable | null | undefined): number {
  if (!table?.days) return 0;
  let n = 0;
  for (const d of Object.keys(table.days)) if (d < day && table.days[d] === key) n++;
  return n;
}

/**
 * The holiday entry a bank should serve on `day`: `entries[k mod n]` where k is
 * the occurrence, or null when the day is ordinary or the bank has nothing for
 * that holiday (then the ordinary epoch index applies — the everyday entry that
 * a holiday displaces is simply never dated, so `bankIndexForDay` and the
 * runway maths are untouched).
 */
export function bankHolidayPick<T>(day: string, table: HolidayTable | null | undefined, holiday: Record<string, T[]> | null | undefined): { key: string; index: number; entry: T } | null {
  const key = holidayKeyForDay(day, table);
  if (!key) return null;
  const entries = holiday?.[key];
  if (!entries || !entries.length) return null;
  const index = holidayOccurrence(day, key, table) % entries.length;
  return { key, index, entry: entries[index] };
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
