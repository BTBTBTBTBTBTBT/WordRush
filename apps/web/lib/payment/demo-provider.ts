import { PaymentProvider, WebhookResult } from './types';
import { fulfillSubscription } from './purchase-service';

/**
 * DemoProvider — simulates subscription purchases with instant fulfillment.
 * No real charges, no external API calls. Use this for development and
 * testing until Stripe (web) or RevenueCat (mobile) is wired up.
 *
 * To swap to Stripe: create stripe-provider.ts implementing PaymentProvider,
 * then update the factory in ./index.ts.
 */
export class DemoProvider implements PaymentProvider {
  async createSubscriptionSession(
    userId: string,
    planId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    await fulfillSubscription(userId, planId);
    const url = new URL(returnUrl);
    url.searchParams.set('purchase', 'success');
    url.searchParams.set('type', 'subscription');
    url.searchParams.set('plan', planId);
    return { url: url.toString() };
  }

  async createPortalSession(
    _customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    // No portal in demo mode — just redirect back
    return { url: returnUrl };
  }

  async handleWebhookEvent(
    _body: string,
    _signature: string,
  ): Promise<WebhookResult> {
    // No webhooks in demo mode
    throw new Error('DemoProvider does not support webhooks');
  }
}
