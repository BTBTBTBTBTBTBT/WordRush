import { PaymentProvider, WebhookResult } from './types';
import { fulfillSubscription } from './purchase-service';

/**
 * DemoProvider — instant fulfillment, NO real charge. ⚠️ LOCAL DEV ONLY.
 * The factory (index.ts) returns this ONLY when PAYMENTS_DEMO === 'true';
 * production uses StripeProvider (STRIPE_SECRET_KEY) or refuses to grant.
 * Never set PAYMENTS_DEMO in a deployed environment — it hands out free Pro,
 * which is exactly the bug that shipped when this was the default provider.
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
