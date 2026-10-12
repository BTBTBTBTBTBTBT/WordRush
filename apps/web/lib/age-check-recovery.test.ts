import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ageRecoveryDecision, ageCheckVerdict } from '@wordle-duel/core';
import {
  beginAgeRecovery, endAgeRecovery, failAgeRecovery, hasAgeRecoveryFailed, isAgeRecoveryPending,
  readAgeCheck, saveAgeCheck, unlockAgeCheck, AGE_CHECK_STORAGE_KEY,
} from './age-check';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('recovery from a mistaken under (web)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
    vi.stubGlobal('window', { dispatchEvent: () => true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('locked + confirmed account: the stored under becomes a passing ok', () => {
    const toddler = new Date().getFullYear() - 2;
    expect(saveAgeCheck(toddler)).toEqual({ state: 'under', year: toddler });
    // sticky: another year cannot overwrite it
    expect(saveAgeCheck(1990)?.state).toBe('under');
    beginAgeRecovery();
    expect(isAgeRecoveryPending()).toBe(true);
    const d = ageRecoveryDecision(true);
    expect(d.action).toBe('unlock');
    const stored = unlockAgeCheck();
    expect(stored.state).toBe('ok');
    expect(ageCheckVerdict(stored.year)).toBe('pass');
    expect(readAgeCheck()).toEqual(stored);
    expect(isAgeRecoveryPending()).toBe(false);
  });

  it('locked + unconfirmed account: stays under, never posts, shows its line', () => {
    const toddler = new Date().getFullYear() - 2;
    saveAgeCheck(toddler);
    beginAgeRecovery();
    expect(ageRecoveryDecision(false)).toEqual({ action: 'stay-locked', postUnder: false });
    expect(ageRecoveryDecision(null)).toEqual({ action: 'stay-locked', postUnder: false });
    failAgeRecovery();
    expect(isAgeRecoveryPending()).toBe(false);
    expect(hasAgeRecoveryFailed()).toBe(true);
    expect(readAgeCheck()).toEqual({ state: 'under', year: toddler });
    expect(JSON.parse(localStorage.getItem(AGE_CHECK_STORAGE_KEY)!).state).toBe('under');
  });

  it('a new attempt clears the old failure; ending clears pending', () => {
    failAgeRecovery();
    beginAgeRecovery();
    expect(hasAgeRecoveryFailed()).toBe(false);
    endAgeRecovery();
    expect(isAgeRecoveryPending()).toBe(false);
  });
});
