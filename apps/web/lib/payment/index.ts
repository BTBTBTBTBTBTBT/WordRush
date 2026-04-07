import { PaymentProvider } from './types';
import { DemoProvider } from './demo-provider';

/**
 * Payment provider factory.
 *
 * Currently returns DemoProvider (instant fulfillment, no real charges).
 * When Stripe is registered, swap to:
 *
 *   import { StripeProvider } from './stripe-provider';
 *   return new StripeProvider();
 *
 * For mobile (RevenueCat), create revenuecat-provider.ts and swap here.
 */
export function getPaymentProvider(): PaymentProvider {
  // TODO: swap to StripeProvider when STRIPE_SECRET_KEY is available
  // if (process.env.STRIPE_SECRET_KEY) {
  //   return new StripeProvider();
  // }
  return new DemoProvider();
}
