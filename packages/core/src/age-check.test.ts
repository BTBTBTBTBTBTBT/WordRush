import { describe, it, expect } from 'vitest';
import {
  ageGateView,
  AGE_GATE_MAX_WAIT_MS,
  ageCheckVerdict,
  ageCheckYears,
  parseAgeCheckStored,
  AGE_CHECK_PASS_OFFSET,
  AGE_CHECK_MAX_YEARS_BACK,
} from './age-check';

const NOW = new Date('2026-10-09T12:00:00Z');

describe('age check', () => {
  it('has no default: the wheel lists newest-first with 101 rows', () => {
    const y = ageCheckYears(NOW);
    expect(y[0]).toBe(2026);
    expect(y.length).toBe(AGE_CHECK_MAX_YEARS_BACK + 1);
    expect(y[y.length - 1]).toBe(1926);
  });
  it('passes only when the player is guaranteed 13+ (strict year reading)', () => {
    expect(ageCheckVerdict(2026 - AGE_CHECK_PASS_OFFSET, NOW)).toBe('pass');
    expect(ageCheckVerdict(2012, NOW)).toBe('pass');
    expect(ageCheckVerdict(2013, NOW)).toBe('under'); // turns 13 sometime in 2026: ambiguous, so under
    expect(ageCheckVerdict(2015, NOW)).toBe('under');
    expect(ageCheckVerdict(1990, NOW)).toBe('pass');
  });
  it('rejects nonsense', () => {
    expect(ageCheckVerdict(2027, NOW)).toBe('invalid');
    expect(ageCheckVerdict(1900, NOW)).toBe('invalid');
    expect(ageCheckVerdict('1990', NOW)).toBe('invalid');
    expect(ageCheckVerdict(1990.5, NOW)).toBe('invalid');
    expect(ageCheckVerdict(null, NOW)).toBe('invalid');
  });
  it('parses stored values and refuses a forged ok', () => {
    expect(parseAgeCheckStored(JSON.stringify({ state: 'ok', year: 1990 }), NOW)).toEqual({ state: 'ok', year: 1990 });
    expect(parseAgeCheckStored(JSON.stringify({ state: 'under', year: 2018 }), NOW)).toEqual({ state: 'under', year: 2018 });
    expect(parseAgeCheckStored(JSON.stringify({ state: 'ok', year: 2018 }), NOW)).toEqual({ state: 'under', year: 2018 });
    expect(parseAgeCheckStored('garbage', NOW)).toBeNull();
    expect(parseAgeCheckStored(null, NOW)).toBeNull();
    expect(parseAgeCheckStored(JSON.stringify({ state: 'ok', year: 3000 }), NOW)).toBeNull();
  });
});

describe('the age gate decision', () => {
  const base = { stored: null, live: true, hadSession: true, serverCheckDone: false, elapsedMs: 0 } as const;
  it('shows the placeholder only for a returning player, only until the server answers, and never past the cap', () => {
    expect(ageGateView({ ...base })).toBe('placeholder');
    expect(ageGateView({ ...base, elapsedMs: AGE_GATE_MAX_WAIT_MS - 1 })).toBe('placeholder');
    expect(ageGateView({ ...base, elapsedMs: AGE_GATE_MAX_WAIT_MS })).toBe('question');
    expect(ageGateView({ ...base, elapsedMs: 60000 })).toBe('question');
    expect(ageGateView({ ...base, serverCheckDone: true })).toBe('question');
    expect(ageGateView({ ...base, hadSession: false })).toBe('question');
  });
  it('passes a device that answered ok (or with the switch off) and keeps an under answer on the under screen', () => {
    expect(ageGateView({ ...base, stored: 'ok' })).toBe('pass');
    expect(ageGateView({ ...base, live: false })).toBe('pass');
    expect(ageGateView({ ...base, stored: 'under' })).toBe('under');
    expect(ageGateView({ ...base, stored: 'under', live: false })).toBe('under');
  });
  it('the wait is at most about two seconds', () => {
    expect(AGE_GATE_MAX_WAIT_MS).toBeLessThanOrEqual(2000);
  });
});

