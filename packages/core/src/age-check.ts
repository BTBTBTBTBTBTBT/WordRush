// ============================================================
// 13+ age check (FRIDAY-QUEUE item 29 — COPPA)
// ============================================================
// Wordocious is for players 13 and up. The check asks ONE neutral question, "What year
// were you born?", on a wheel with no default and no hint that 13 matters. Only the year is
// ever stored (never a full date), and only as the flag `age_confirmed_13` + the year.
//
// A year alone cannot tell a 13th birthday that has passed from one that has not, so we are
// deliberately STRICT (the founder: "I don't mind losing the under-13 players if it's safer"):
// a player passes only when `currentYear - birthYear >= AGE_CHECK_PASS_OFFSET` — i.e. they are
// guaranteed to be at least 13. Flip AGE_CHECK_PASS_OFFSET to 13 for the permissive reading.
//
// Mirrors: AgeCheck.swift (iOS), AgeCheck.kt (Android), lib/age-check.ts (web).
// The verdict is re-run on the server (POST /api/account/age) — the client is never the authority.

export const AGE_CHECK_MIN_AGE = 13;
/** Year-only strict reading: born in year Y passes when (thisYear - Y) >= this. */
export const AGE_CHECK_PASS_OFFSET = AGE_CHECK_MIN_AGE + 1;
/** Oldest year offered on the wheel. */
export const AGE_CHECK_MAX_YEARS_BACK = 100;
/** The wheel's first row — the youngest year offered (a toddler is still a valid, honest answer). */
export const AGE_CHECK_NEWEST_OFFSET = 0;

export type AgeVerdict = 'pass' | 'under' | 'invalid';

/** Years for the wheel, newest first, with NO default selection. */
export function ageCheckYears(now: Date = new Date()): number[] {
  const y = now.getFullYear();
  const out: number[] = [];
  for (let i = AGE_CHECK_NEWEST_OFFSET; i <= AGE_CHECK_MAX_YEARS_BACK; i++) out.push(y - i);
  return out;
}

/** The verdict for a picked birth year. */
export function ageCheckVerdict(year: unknown, now: Date = new Date()): AgeVerdict {
  if (typeof year !== 'number' || !Number.isInteger(year)) return 'invalid';
  const y = now.getFullYear();
  if (year > y || year < y - AGE_CHECK_MAX_YEARS_BACK) return 'invalid';
  return y - year >= AGE_CHECK_PASS_OFFSET ? 'pass' : 'under';
}

/** What a device remembers. Under-13 sticks on the device (no retry with a different year). */
export interface AgeCheckStored {
  state: 'ok' | 'under';
  year: number;
}

/** Parse + re-validate what was stored (a tampered or stale value reads as "not checked"). */
export function parseAgeCheckStored(raw: string | null | undefined, now: Date = new Date()): AgeCheckStored | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<AgeCheckStored>;
    if (!v || (v.state !== 'ok' && v.state !== 'under')) return null;
    const verdict = ageCheckVerdict(v.year, now);
    if (verdict === 'invalid') return null;
    // Re-derive the state from the year so a hand-edited "ok" next to a young year is refused.
    const state = verdict === 'pass' ? 'ok' : 'under';
    if (v.state === 'ok' && state !== 'ok') return { state: 'under', year: v.year as number };
    return { state: v.state, year: v.year as number };
  } catch {
    return null;
  }
}

/** Support address shown on the under-13 screen (parents). */
export const AGE_CHECK_SUPPORT_EMAIL = 'privacy@wordocious.com';

// ── The gate's decision (2026-10-10 fix: a returning player sat on a black screen) ─────────────────────────────
// What the age gate shows. A signed-in returning player on a fresh device may already be confirmed server-side, so the
// gate waits for that lookup, but NEVER longer than AGE_GATE_MAX_WAIT_MS and never on a plain black screen (the
// placeholder is the normal app background). The caller measures `elapsedMs` on a real, full-size container.
export type AgeGateView = 'pass' | 'under' | 'placeholder' | 'question';

/** The longest the gate shows its placeholder before it just asks. */
export const AGE_GATE_MAX_WAIT_MS = 2000;

export interface AgeGateInput {
  /** What this device remembers (null = never answered). */
  stored: 'ok' | 'under' | null;
  /** The `age_check` off-switch is live (fail open: an unknown flag = live). */
  live: boolean;
  /** A signed-in session was persisted on this device (a returning player). */
  hadSession: boolean;
  /** The server lookup (is this account already confirmed?) has finished, either way. */
  serverCheckDone: boolean;
  /** Milliseconds since the gate appeared. */
  elapsedMs: number;
}

export function ageGateView(i: AgeGateInput): AgeGateView {
  if (i.stored === 'under') return 'under';
  if (i.stored === 'ok' || !i.live) return 'pass';
  if (i.hadSession && !i.serverCheckDone && i.elapsedMs < AGE_GATE_MAX_WAIT_MS) return 'placeholder';
  return 'question';
}
