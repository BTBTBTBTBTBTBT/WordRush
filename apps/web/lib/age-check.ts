// 13+ age check, web side (FRIDAY-QUEUE item 29). Pure helpers + storage; the screen is
// components/auth/age-check-screen.tsx. Rule set + strictness live in @wordle-duel/core age-check.ts.
//
// What a device remembers: { state: 'ok' | 'under', year } under STORAGE_KEY. "under" sticks (no retry
// with a different year). Nothing is stored for an under-13 visitor beyond that one local marker — no
// account, no guest flag, no push subscription, and Sentry never starts.

import { ageCheckVerdict, ageCheckConfirmedYear, parseAgeCheckStored, type AgeCheckStored } from '@wordle-duel/core';

export const AGE_CHECK_STORAGE_KEY = 'wordocious-age-check';

export function readAgeCheck(): AgeCheckStored | null {
  try {
    return parseAgeCheckStored(localStorage.getItem(AGE_CHECK_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Saves the answer on this device and returns the verdict. Never overwrites an existing answer. */
export function saveAgeCheck(year: number): AgeCheckStored | null {
  const existing = readAgeCheck();
  if (existing) return existing;
  const verdict = ageCheckVerdict(year);
  if (verdict === 'invalid') return null;
  const stored: AgeCheckStored = { state: verdict === 'pass' ? 'ok' : 'under', year };
  try {
    localStorage.setItem(AGE_CHECK_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // storage blocked: the answer only lives in memory this session (the gate will ask again next time)
  }
  return stored;
}

/** True once this device passed the check. */
export function hasPassedAgeCheck(): boolean {
  return readAgeCheck()?.state === 'ok';
}

/** Tells the server (signed-in only). Failure is non-fatal: the local answer still holds. */
export async function syncAgeCheck(accessToken: string, year: number): Promise<{ ok: boolean; under?: boolean } | null> {
  try {
    const r = await fetch('/api/account/age', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ year }),
    });
    if (!r.ok) return null;
    return (await r.json()) as { ok: boolean; under?: boolean };
  } catch {
    return null;
  }
}

// ── Recovery from a mistaken "under" (2026-10-12) ───────────────────────────────────────────────────────────────
// The lockout offers "A grown-up? Sign in". A sign-in that started there is remembered for this tab (sessionStorage, so it
// survives the Google redirect) until the account's server flag has decided; nothing about it is stored on the account.
const RECOVERY_PENDING_KEY = 'wordocious-age-recovery';
const RECOVERY_FAILED_KEY = 'wordocious-age-recovery-failed';

function sessionFlag(key: string, set?: boolean): boolean {
  try {
    if (set === true) sessionStorage.setItem(key, '1');
    else if (set === false) sessionStorage.removeItem(key);
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** The lockout's sign-in was started: the next signed-in account is checked against its server flag. */
export function beginAgeRecovery(): void {
  sessionFlag(RECOVERY_FAILED_KEY, false);
  sessionFlag(RECOVERY_PENDING_KEY, true);
}
export const isAgeRecoveryPending = (): boolean => sessionFlag(RECOVERY_PENDING_KEY);
export const endAgeRecovery = (): void => { sessionFlag(RECOVERY_PENDING_KEY, false); };
export const AGE_RECOVERY_EVENT = 'wordocious-age-recovery';
/** The account could not be confirmed: the lockout shows its one explanatory line. */
export function failAgeRecovery(): void {
  sessionFlag(RECOVERY_PENDING_KEY, false);
  sessionFlag(RECOVERY_FAILED_KEY, true);
  try { window.dispatchEvent(new Event(AGE_RECOVERY_EVENT)); } catch {}
}
export const hasAgeRecoveryFailed = (): boolean => sessionFlag(RECOVERY_FAILED_KEY);

/** Replaces the stored "under" with a passing "ok" (the shape a confirmed account gets on a fresh device). */
export function unlockAgeCheck(now: Date = new Date()): AgeCheckStored {
  const stored: AgeCheckStored = { state: 'ok', year: ageCheckConfirmedYear(now) };
  try {
    localStorage.setItem(AGE_CHECK_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // storage blocked: the unlock only lives in memory this session
  }
  endAgeRecovery();
  sessionFlag(RECOVERY_FAILED_KEY, false);
  try { window.dispatchEvent(new Event(AGE_RECOVERY_EVENT)); } catch {}
  return stored;
}
