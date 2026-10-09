// 13+ age check, web side (FRIDAY-QUEUE item 29). Pure helpers + storage; the screen is
// components/auth/age-check-screen.tsx. Rule set + strictness live in @wordle-duel/core age-check.ts.
//
// What a device remembers: { state: 'ok' | 'under', year } under STORAGE_KEY. "under" sticks (no retry
// with a different year). Nothing is stored for an under-13 visitor beyond that one local marker — no
// account, no guest flag, no push subscription, and Sentry never starts.

import { ageCheckVerdict, parseAgeCheckStored, type AgeCheckStored } from '@wordle-duel/core';

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
