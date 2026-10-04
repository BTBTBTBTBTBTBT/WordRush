// FINISH_SPEC BJ11 (founder 10-03: "When I clicked check subscription somewhere the Apple
// menu popped up" — the jump to a store's own billing page felt abrupt). Every hand-off
// to a billing page we don't draw (Apple's / Google Play's subscription settings,
// Stripe's checkout and customer portal) is announced first, in our look, with one line
// saying what opens. Plus the lapsed-Pro line ("Your Pro ended Sep 30, 2026") the Pro
// page and the Settings card show a former member. Pure copy, unit-tested; iOS parity
// Sources/Core/SubscriptionCopy.swift, Android data/SubscriptionCopy.kt.

export type BillingStore = 'apple' | 'google' | 'stripe';

export interface SubscriptionHandoff {
  /** The row / sheet title. */
  title: string;
  /** The one line under a row: what opens. */
  line: string;
  /** The interstitial's sentence (why it opens a page that isn't ours). */
  body: string;
  /** The button that continues to the store's page. */
  cta: string;
}

export const SUBSCRIPTION_HANDOFF: Record<BillingStore, SubscriptionHandoff> = {
  apple: {
    title: 'Manage on the App Store',
    line: 'Opens your Apple subscription settings',
    body: 'Apple handles Pro billing for iPhone and iPad, so changing plans or canceling happens in your Apple subscription settings. Your Pro stays tied to your Wordocious account.',
    cta: 'Open Apple subscriptions',
  },
  google: {
    title: 'Manage on Google Play',
    line: 'Opens your Google Play subscriptions',
    body: 'Google Play handles Pro billing on Android, so changing plans or canceling happens in your Play subscriptions. Your Pro stays tied to your Wordocious account.',
    cta: 'Open Play subscriptions',
  },
  stripe: {
    title: 'Manage web billing',
    line: "Opens Stripe's secure billing page",
    body: "Pro bought on wordocious.com is billed by Stripe. Update your card, switch plans or cancel on Stripe's secure page, then come right back.",
    cta: 'Open billing',
  },
};

/** The line under a web Subscribe button: where the purchase happens. */
export const CHECKOUT_HANDOFF_LINE = "Opens Stripe's secure checkout";

/**
 * The web auto-renew disclosure under the plans (price + renewal + where to cancel). The Day
 * Pass sentence only where a Day Pass is offered (the /pro page; the Go Pro popup sells
 * monthly / yearly only, so it must not describe a plan it doesn't show).
 */
export function webRenewalDisclosure(monthly: number, yearly: number, { dayPass = true }: { dayPass?: boolean } = {}): string {
  const renew = `Monthly ($${monthly.toFixed(2)}) and Yearly ($${yearly.toFixed(2)}) renew automatically until you cancel, any time in Settings › Subscription.`;
  return dayPass ? `${renew} The Day Pass is a one-time 24 hours of Pro and never renews.` : renew;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * "Your Pro ended Sep 30, 2026" for a former member: `pro_expires_at` is in the past
 * and Pro isn't active. Null for players who never had Pro, active members, or a
 * missing / unreadable expiry. The date is the player's local day.
 */
export function proLapsedLine(expiresAt: string | null | undefined, proActive: boolean, now: Date = new Date()): string | null {
  if (proActive || !expiresAt) return null;
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime()) || d.getTime() >= now.getTime()) return null;
  return `Your Pro ended ${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** The lapsed card's second line. */
export const PRO_LAPSED_BODY = 'Everything you earned is still here. Pick a plan to switch Pro back on.';
