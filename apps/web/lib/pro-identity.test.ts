import { describe, expect, it } from 'vitest';
import { PRO_AVATAR, isProAvatar, memberSince, proAvatarDecor, proPlanLine } from './pro-identity';

describe('memberSince', () => {
  it('reads the month and year off created_at', () => {
    expect(memberSince('2026-10-02T12:00:00+00:00')).toBe('Member since October 2026');
    expect(memberSince('2025-01-31')).toBe('Member since January 2025');
  });
  it('is null when missing or malformed', () => {
    expect(memberSince(null)).toBeNull();
    expect(memberSince('')).toBeNull();
    expect(memberSince('2026/10/02')).toBeNull();
    expect(memberSince('2026-13-01')).toBeNull();
  });
});

describe('proPlanLine', () => {
  it('names the web billing when there is one', () => {
    expect(proPlanLine({ webBilling: true })).toContain('wordocious.com');
    expect(proPlanLine({ webBilling: false })).toContain('Wordocious Pro');
  });
});

describe('isProAvatar', () => {
  const own = { username: 'Brian', proActive: true };
  it('crowns the signed-in Pro player only (case-insensitive)', () => {
    expect(isProAvatar('brian', own)).toBe(true);
    expect(isProAvatar('someone', own)).toBe(false);
    expect(isProAvatar('Brian', { ...own, proActive: false })).toBe(false);
    expect(isProAvatar('', own)).toBe(false);
  });
  it('lets an explicit row flag win', () => {
    expect(isProAvatar('someone', own, true)).toBe(true);
    expect(isProAvatar('Brian', own, false)).toBe(false);
  });
});

describe('proAvatarDecor', () => {
  it('puts a ~35% crown on the top-right and a thin ring just outside', () => {
    const d = proAvatarDecor(40, 10);
    expect(d.crown.size).toBe(Math.round(40 * PRO_AVATAR.crownPct));
    expect(d.crown.top).toBeLessThan(0);
    expect(d.crown.right).toBeLessThan(0);
    expect(d.ring.inset).toBeCloseTo(PRO_AVATAR.gap + PRO_AVATAR.stroke);
    expect(d.ring.radius).toBeCloseTo(10 + d.ring.inset);
    expect(proAvatarDecor(40, 'circle').ring.radius).toBe('50%');
  });
  it('never draws a crown smaller than 8 px', () => {
    expect(proAvatarDecor(16, 4).crown.size).toBe(8);
  });
});
