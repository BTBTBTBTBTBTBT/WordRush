import { supabase } from '../supabase-client';
import { COIN_PACKS } from './coin-packs';

/**
 * Fulfillment functions — bridge between payment events and game state.
 * Called by the payment provider after a successful transaction.
 */

export async function fulfillCoinPurchase(userId: string, packId: string): Promise<number> {
  const pack = COIN_PACKS.find(p => p.id === packId);
  if (!pack) throw new Error(`Unknown coin pack: ${packId}`);

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('coins')
    .eq('id', userId)
    .single() as { data: { coins: number } | null };

  if (!profile) throw new Error('Profile not found');

  await (supabase as any)
    .from('profiles')
    .update({ coins: profile.coins + pack.coins })
    .eq('id', userId);

  await (supabase as any)
    .from('coin_transactions')
    .insert({
      user_id: userId,
      amount: pack.coins,
      type: 'earn',
      reason: `purchase_${packId}`,
    });

  return pack.coins;
}

export async function fulfillSubscription(
  userId: string,
  planId: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string,
): Promise<void> {
  const now = Date.now();
  const DAY_MS = 86400000;

  // Day pass: stacks on top of any currently-active Pro window by banking
  // 24h on top of the existing expiry (never truncating it). Monthly/yearly
  // reset from `now`. Day pass also intentionally skips the streak-shield
  // grant — shields are a recurring subscription benefit, and handing out 4
  // shields for $1 is both economically bad and conceptually wrong.
  const isDayPass = planId === 'pro_day';
  let expiresAt: string;

  if (isDayPass) {
    const { data: existing } = await (supabase as any)
      .from('profiles')
      .select('pro_expires_at')
      .eq('id', userId)
      .single() as { data: { pro_expires_at: string | null } | null };

    const base = existing?.pro_expires_at
      ? Math.max(new Date(existing.pro_expires_at).getTime(), now)
      : now;
    expiresAt = new Date(base + DAY_MS).toISOString();
  } else if (planId === 'pro_yearly') {
    expiresAt = new Date(now + 365 * DAY_MS).toISOString();
  } else {
    expiresAt = new Date(now + 30 * DAY_MS).toISOString();
  }

  await (supabase as any)
    .from('profiles')
    .update({
      is_pro: true,
      pro_expires_at: expiresAt,
      ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
      ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
      streak_shields: (supabase as any).rpc ? undefined : 4, // Grant 4 shields on subscribe
    })
    .eq('id', userId);

  // Day pass: no shields granted. Return early before the shield-grant block.
  if (isDayPass) return;

  // Grant 4 shields separately to avoid RPC issues
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('streak_shields')
    .eq('id', userId)
    .single() as { data: { streak_shields: number } | null };

  if (profile) {
    await (supabase as any)
      .from('profiles')
      .update({ streak_shields: profile.streak_shields + 4 })
      .eq('id', userId);
  }
}

export async function cancelSubscription(userId: string): Promise<void> {
  await (supabase as any)
    .from('profiles')
    .update({ is_pro: false })
    .eq('id', userId);
}
