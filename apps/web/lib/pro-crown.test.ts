import { describe, expect, it } from 'vitest';
import { PRO_CROWN, crownTarget, proRenewalLabel } from './pro-crown';

// FINISH_SPEC AA1: the crowned W (tilted ~-8°, a sparkle every ~8 s) and its sheet.

describe('pro crown', () => {
  it('uses the approved tilt and sparkle rhythm', () => {
    expect(PRO_CROWN.tilt).toBe(-8);
    expect(PRO_CROWN.sparkleEveryMs).toBe(8000);
    expect(PRO_CROWN.sparkleMs).toBeLessThan(PRO_CROWN.sparkleEveryMs);
  });

  it('formats the renewal date, omitting a missing or bad one', () => {
    expect(proRenewalLabel('2027-10-02T12:00:00Z')).toMatch(/^Oct [12], 2027$/);
    expect(proRenewalLabel(null)).toBeNull();
    expect(proRenewalLabel(undefined)).toBeNull();
    expect(proRenewalLabel('')).toBeNull();
    expect(proRenewalLabel('not a date')).toBeNull();
  });

  it('grows the tap target around the crown to a minimum size', () => {
    expect(crownTarget({ left: 10, top: -4, width: 20, height: 20 })).toEqual({ left: 4, top: -10, width: 32, height: 32 });
    expect(crownTarget({ left: 0, top: 0, width: 40, height: 36 })).toEqual({ left: 0, top: 0, width: 40, height: 36 });
  });
});
