import Stripe from 'stripe';
import { PaymentProvider, WebhookResult } from './types';

// Real Stripe fulfillment for web Pro. Checkout Sessions for purchase;
// entitlement is granted ONLY by the webhook (app/api/stripe/webhook) after
// Stripe confirms payment — never at session creation (that's the free-Pro bug
// the demo provider had). Set STRIPE_SECRET_KEY + the three price envs to
// enable; index.ts falls back to a no-payments provider (NOT free Pro) when
// they're absent.

const PLAN_TO_PRICE: Record<string, string | undefined> = {
  pro_monthly: process.env.STRIPE_PRICE_MONTHLY,
  pro_yearly: process.env.STRIPE_PRICE_YEARLY,
  pro_day: process.env.STRIPE_PRICE_DAY,
};

export class StripeProvider implements PaymentProvider {
  private stripe: Stripe;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not set');
    this.stripe = new Stripe(key);
  }

  async createSubscriptionSession(userId: string, planId: string, returnUrl: string): Promise<{ url: string }> {
    const price = PLAN_TO_PRICE[planId];
    if (!price) throw new Error(`no Stripe price configured for ${planId}`);

    // Day Pass is a one-time charge (mode: payment); monthly/yearly recur.
    const isDayPass = planId === 'pro_day';
    const success = new URL(returnUrl);
    success.searchParams.set('purchase', 'success');
    success.searchParams.set('plan', planId);

    const session = await this.stripe.checkout.sessions.create({
      mode: isDayPass ? 'payment' : 'subscription',
      line_items: [{ price, quantity: 1 }],
      // client_reference_id + metadata carry the Supabase user id to the
      // webhook (initial purchase). subscription_data.metadata carries it onto
      // the Subscription so renewals (invoice.paid) and cancels can map back.
      client_reference_id: userId,
      metadata: { userId, planId },
      ...(isDayPass
        ? {}
        : { subscription_data: { metadata: { userId, planId } } }),
      success_url: success.toString(),
      cancel_url: returnUrl,
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  // Webhook verification/dispatch lives in the route (it needs the raw body +
  // signature header); this interface method is unused for Stripe.
  async handleWebhookEvent(): Promise<WebhookResult> {
    throw new Error('Stripe webhooks are handled in app/api/stripe/webhook');
  }
}
