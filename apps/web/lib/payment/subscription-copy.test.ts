import { describe, expect, it } from 'vitest';
import { CHECKOUT_HANDOFF_LINE, PRO_LAPSED_BODY, SUBSCRIPTION_HANDOFF, proLapsedLine, webRenewalDisclosure } from './subscription-copy';

describe('subscription hand-offs (BJ11)', () => {
  it('names the page that opens for every store', () => {
    expect(SUBSCRIPTION_HANDOFF.apple.line).toBe('Opens your Apple subscription settings');
    expect(SUBSCRIPTION_HANDOFF.google.line).toBe('Opens your Google Play subscriptions');
    expect(SUBSCRIPTION_HANDOFF.stripe.line).toBe("Opens Stripe's secure billing page");
    expect(CHECKOUT_HANDOFF_LINE).toBe("Opens Stripe's secure checkout");
  });

  it('keeps the copy free of emoji and British spellings', () => {
    const all = [
      ...Object.values(SUBSCRIPTION_HANDOFF).flatMap((h) => [h.title, h.line, h.body, h.cta]),
      CHECKOUT_HANDOFF_LINE, PRO_LAPSED_BODY, webRenewalDisclosure(6.99, 59.99),
    ].join(' ');
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/cancell|colour|centre/i);
  });

  it('states both prices and the renewal in the web disclosure', () => {
    expect(webRenewalDisclosure(6.99, 59.99)).toBe(
      'Monthly ($6.99) and Yearly ($59.99) renew automatically until you cancel, any time in Settings › Subscription. The Day Pass is a one-time 24 hours of Pro and never renews.',
    );
  });

  it('leaves the Day Pass out where no Day Pass is offered (the Go Pro popup)', () => {
    expect(webRenewalDisclosure(6.99, 59.99, { dayPass: false })).toBe(
      'Monthly ($6.99) and Yearly ($59.99) renew automatically until you cancel, any time in Settings › Subscription.',
    );
  });
});

describe('proLapsedLine', () => {
  const now = new Date('2026-10-03T12:00:00');
  it('names the day a former member’s Pro ended', () => {
    expect(proLapsedLine('2026-09-30T12:00:00', false, now)).toBe('Your Pro ended Sep 30, 2026');
  });
  it('is null for active members, future windows, never-Pro and bad dates', () => {
    expect(proLapsedLine('2026-09-30T12:00:00', true, now)).toBeNull();
    expect(proLapsedLine('2026-10-30T12:00:00', false, now)).toBeNull();
    expect(proLapsedLine(null, false, now)).toBeNull();
    expect(proLapsedLine(undefined, false, now)).toBeNull();
    expect(proLapsedLine('not a date', false, now)).toBeNull();
  });
});
