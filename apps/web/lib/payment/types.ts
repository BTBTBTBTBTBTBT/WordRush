export interface CoinPack {
  id: string;
  coins: number;
  price: number;
  label: string;
  popular?: boolean;
}

export interface WebhookResult {
  type: 'coin_purchase' | 'cosmetic_purchase' | 'subscription_created' | 'subscription_cancelled';
  userId: string;
  data: Record<string, any>;
}

/**
 * Payment provider interface — the single swap point for monetization.
 * Game logic (coins, shields, cosmetics) never imports a payment SDK directly.
 * To switch from DemoProvider to Stripe or RevenueCat, implement this interface
 * and update the factory in ./index.ts.
 */
export interface PaymentProvider {
  createCoinPurchaseSession(
    userId: string,
    packId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;

  createCosmeticPurchaseSession(
    userId: string,
    cosmeticId: string,
    returnUrl: string,
  ): Promise<{ url: string }>;

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
  monthly: { id: 'pro_monthly', price: 6.99, label: '$6.99/mo' },
  yearly: { id: 'pro_yearly', price: 59.99, label: '$4.99/mo billed annually' },
} as const;
