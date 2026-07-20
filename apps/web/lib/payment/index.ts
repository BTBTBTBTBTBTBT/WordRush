import { PaymentProvider } from './types';
import { StripeProvider } from './stripe-provider';
import { DemoProvider } from './demo-provider';

/**
 * Payment provider factory — the single monetization swap point.
 *
 * Order matters, and the default is SAFE:
 *   1. STRIPE_SECRET_KEY set        → real Stripe (fulfillment via webhook only).
 *   2. else PAYMENTS_DEMO === 'true' → DemoProvider (LOCAL DEV ONLY — grants Pro
 *      for free with no charge; never set this in production).
 *   3. else                          → null → the /api/purchase route returns
 *      503 "payments not configured" and grants NOTHING.
 *
 * The old default was DemoProvider, which meant the live web "Subscribe"
 * buttons handed out Pro for free. Never again: absent Stripe keys, we refuse
 * to grant rather than grant free.
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (process.env.STRIPE_SECRET_KEY) return new StripeProvider();
  if (process.env.PAYMENTS_DEMO === 'true') return new DemoProvider();
  return null;
}

/** True when a real, charging payment provider is configured. The Pro page
 *  reads NEXT_PUBLIC_STRIPE_ENABLED to decide whether to enable buy buttons;
 *  this server-side check is the actual gate. */
export function paymentsConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY || process.env.PAYMENTS_DEMO === 'true';
}
