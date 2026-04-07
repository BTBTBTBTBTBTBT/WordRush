import { PaymentProvider, WebhookResult } from './types';
import { fulfillCoinPurchase, fulfillSubscription } from './purchase-service';

/**
 * DemoProvider — simulates all purchases with instant fulfillment.
 * No real charges, no external API calls. Coins are credited immediately,
 * subscriptions activate instantly. Use this for development and testing
 * until a real payment provider (Stripe, RevenueCat) is registered.
 *
 * To swap to Stripe: create stripe-provider.ts implementing PaymentProvider,
 * then update the factory in ./index.ts.
 */
export class DemoProvider implements PaymentProvider {
  async createCoinPurchaseSession(
    userId: string,
    packId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    // Instant fulfillment — no checkout page needed
    await fulfillCoinPurchase(userId, packId);
    const url = new URL(returnUrl);
    url.searchParams.set('purchase', 'success');
    url.searchParams.set('type', 'coins');
    url.searchParams.set('pack', packId);
    return { url: url.toString() };
  }

  async createCosmeticPurchaseSession(
    userId: string,
    cosmeticId: string,
    returnUrl: string,
  ): Promise<{ url: string }> {
    // Cosmetic fulfillment handled by cosmetic-service directly for demo
    const url = new URL(returnUrl);
    url.searchParams.set('purchase', 'success');
    url.searchParams.set('type', 'cosmetic');
    url.searchParams.set('item', cosmeticId);
    return { url: url.toString() };
  }

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
