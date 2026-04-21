export interface WebhookResult {
  type: 'subscription_created' | 'subscription_cancelled';
  userId: string;
  data: Record<string, any>;
}

/**
 * Payment provider interface — the single swap point for monetization.
 * Game logic never imports a payment SDK directly. To switch from
 * DemoProvider to Stripe or RevenueCat, implement this interface and
 * update the factory in ./index.ts.
 *
 * The coin + cosmetic purchase flows that previously lived here were
 * removed along with the in-game economy; Pro subscriptions are the only
 * monetized transaction.
 */
export interface PaymentProvider {
  createSubscriptionSession(
    userId: string,
    planId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;

  createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;

  handleWebhookEvent(
    body: string,
    signature: string,
  ): Promise<WebhookResult>;
}

export const PRO_PLANS = {
  day: { id: 'pro_day', price: 1.0, label: '$1 for 24 hours' },
  monthly: { id: 'pro_monthly', price: 6.99, label: '$6.99/mo' },
  yearly: { id: 'pro_yearly', price: 59.99, label: '$4.99/mo billed annually' },
} as const;
