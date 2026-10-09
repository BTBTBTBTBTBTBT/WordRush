import { describe, expect, it } from 'vitest';
import { ADS_SERVING } from '@wordle-duel/core';
import {
  BENEFIT_STAGGER_MS,
  PRO_WELCOME_BENEFITS,
  decideProWelcome,
  letsPlayHref,
  proWelcomeHeadline,
  proWelcomeLine,
  proWelcomedKey,
  purchaseSignalFromSearch,
  shieldsCredited,
} from './pro-welcome';

const purchase = { kind: 'purchase' as const, proBefore: null, plan: 'pro_yearly' };
const gift = { kind: 'gift' as const, proBefore: false };

describe('decideProWelcome', () => {
  it('shows on the not-Pro → Pro transition with a purchase signal', () => {
    expect(decideProWelcome({ welcomed: false, proNow: false, signal: purchase })).toBe('wait');
    expect(decideProWelcome({ welcomed: false, proNow: true, signal: purchase })).toBe('show');
  });

  it('shows on the Stripe return even when the webhook landed before the page loaded', () => {
    expect(decideProWelcome({ welcomed: false, proNow: true, signal: { kind: 'purchase', proBefore: null } })).toBe('show');
  });

  it('shows for a gifted week first activation', () => {
    expect(decideProWelcome({ welcomed: false, proNow: false, signal: gift })).toBe('wait');
    expect(decideProWelcome({ welcomed: false, proNow: true, signal: gift })).toBe('show');
  });

  it('never shows twice', () => {
    expect(decideProWelcome({ welcomed: true, proNow: true, signal: purchase })).toBe('none');
    expect(decideProWelcome({ welcomed: true, proNow: true, signal: gift })).toBe('none');
  });

  it('marks players who were already Pro silently (no signal, restores, other devices)', () => {
    expect(decideProWelcome({ welcomed: false, proNow: true, signal: null })).toBe('mark');
    expect(decideProWelcome({ welcomed: false, proNow: true, signal: { kind: 'gift', proBefore: true } })).toBe('mark');
  });

  it('does nothing for free players without a signal', () => {
    expect(decideProWelcome({ welcomed: false, proNow: false, signal: null })).toBe('none');
  });
});

describe('purchaseSignalFromSearch', () => {
  it('reads the Stripe success return and its plan', () => {
    expect(purchaseSignalFromSearch('?purchase=success&plan=pro_monthly')).toEqual({ kind: 'purchase', proBefore: null, plan: 'pro_monthly' });
    expect(purchaseSignalFromSearch('?daily=false&purchase=success')).toEqual({ kind: 'purchase', proBefore: null, plan: null });
  });
  it('ignores everything else', () => {
    expect(purchaseSignalFromSearch('')).toBeNull();
    expect(purchaseSignalFromSearch('?purchase=cancel')).toBeNull();
    expect(purchaseSignalFromSearch('?daily=true')).toBeNull();
  });
});

describe('shieldsCredited', () => {
  it('sees a rise in the shield count', () => {
    expect(shieldsCredited({ kind: 'purchase', plan: null, shieldsBefore: 1, shieldsNow: 5 })).toBe(true);
  });
  it('trusts monthly / yearly checkouts when the webhook beat the page load', () => {
    expect(shieldsCredited({ kind: 'purchase', plan: 'pro_yearly', shieldsBefore: 5, shieldsNow: 5 })).toBe(true);
    expect(shieldsCredited({ kind: 'purchase', plan: 'pro_monthly', shieldsBefore: null, shieldsNow: null })).toBe(true);
  });
  it('never for the day pass or a gifted week without a rise', () => {
    expect(shieldsCredited({ kind: 'purchase', plan: 'pro_day', shieldsBefore: 2, shieldsNow: 2 })).toBe(false);
    expect(shieldsCredited({ kind: 'gift', plan: null, shieldsBefore: 0, shieldsNow: 0 })).toBe(false);
  });
});

describe('copy + routing', () => {
  it('headline per kind', () => {
    expect(proWelcomeHeadline('purchase')).toBe('WELCOME TO PRO!');
    expect(proWelcomeHeadline('gift')).toBe('YOUR FREE WEEK OF PRO!');
  });
  it('welcome line with and without a name', () => {
    expect(proWelcomeLine('brian')).toBe("Thanks for joining, brian! Here's everything you just unlocked.");
    expect(proWelcomeLine(null)).toBe("Thanks for joining! Here's everything you just unlocked.");
    expect(proWelcomeLine('  ')).toBe("Thanks for joining! Here's everything you just unlocked.");
  });
  it("LET'S PLAY leaves the Pro page for Home, otherwise stays put", () => {
    expect(letsPlayHref('/pro')).toBe('/');
    expect(letsPlayHref('/quadword')).toBeNull();
    expect(letsPlayHref('/')).toBeNull();
    expect(letsPlayHref('/profile')).toBeNull();
  });
  it('per-user flag key', () => {
    expect(proWelcomedKey('abc')).toBe('pro-welcomed:abc');
  });
  it('eight benefit cards, 70 ms apart, no em dashes', () => {
    expect(PRO_WELCOME_BENEFITS).toHaveLength(8);
    expect(BENEFIT_STAGGER_MS).toBe(70);
    for (const b of PRO_WELCOME_BENEFITS) expect(`${b.title} ${b.line}`).not.toMatch(/—/);
  });
  it('no ad promise while ads are not serving (core ADS_SERVING), and the grid stays even', () => {
    expect(ADS_SERVING).toBe(false);
    for (const b of PRO_WELCOME_BENEFITS) expect(`${b.title} ${b.line}`).not.toMatch(/\bads?\b|ad-free|interrupt/i);
    expect(PRO_WELCOME_BENEFITS.length % 2).toBe(0);
  });
});

describe('giftWelcomeDue (the gifted week server marker, GET /api/pro/gift)', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  it('welcomes a gift redeemed during the gift week', async () => {
    const { giftWelcomeDue } = await import('./pro-welcome');
    expect(giftWelcomeDue('2026-10-03T11:00:00Z', now)).toBe(true);
    expect(giftWelcomeDue('2026-09-27T12:00:00Z', now)).toBe(true); // 6 days ago
  });
  it('never for an old gift, a missing marker or garbage', async () => {
    const { giftWelcomeDue } = await import('./pro-welcome');
    expect(giftWelcomeDue('2026-09-20T12:00:00Z', now)).toBe(false);
    expect(giftWelcomeDue(null, now)).toBe(false);
    expect(giftWelcomeDue('not a date', now)).toBe(false);
  });
});
