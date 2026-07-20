import { getAdminSupabase } from '@/lib/supabase-admin';

// Server-side (service-role) Pro fulfillment for Stripe. This is the ONLY place
// a web purchase grants Pro — called from the Stripe webhook after payment is
// confirmed. Mirrors the App Store webhook: stack the Day Pass, reset
// subscriptions from now, +4 shields on a subscription (never on Day Pass),
// idempotent per Stripe event id. Uses the admin client, NOT the browser anon
// client (the old purchase-service wrote with no session → RLS-dependent).

const DAY_MS = 86_400_000;
const RENEWAL_SHIELDS = 4;

/** Returns false if this event id was already processed (caller should no-op). */
async function claimEvent(eventId: string): Promise<boolean> {
  const sb = getAdminSupabase();
  const { error } = await sb.from('store_webhook_events').insert({ event_id: eventId, source: 'stripe' });
  // Primary-key conflict → already processed.
  return !error;
}

export async function fulfillStripePurchase(opts: {
  eventId: string;
  userId: string;
  planId: string;
  grantShields: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}): Promise<void> {
  if (!(await claimEvent(opts.eventId))) return; // duplicate delivery

  const sb = getAdminSupabase();
  const now = Date.now();

  const { data: current } = await sb
    .from('profiles')
    .select('pro_expires_at, streak_shields')
    .eq('id', opts.userId)
    .maybeSingle();
  const storedMs = current?.pro_expires_at ? new Date(current.pro_expires_at).getTime() : 0;

  let expiresMs: number;
  if (opts.planId === 'pro_day') {
    expiresMs = Math.max(storedMs, now) + DAY_MS; // stack on any future window
  } else if (opts.planId === 'pro_yearly') {
    expiresMs = now + 365 * DAY_MS;
  } else {
    expiresMs = now + 30 * DAY_MS;
  }
  // Never shrink a longer existing window (e.g. a Day Pass on top of a sub).
  expiresMs = Math.max(expiresMs, storedMs);

  const update: Record<string, unknown> = {
    is_pro: expiresMs > now,
    pro_expires_at: new Date(expiresMs).toISOString(),
  };
  if (opts.stripeCustomerId) update.stripe_customer_id = opts.stripeCustomerId;
  if (opts.stripeSubscriptionId) update.stripe_subscription_id = opts.stripeSubscriptionId;
  if (opts.grantShields) update.streak_shields = (current?.streak_shields ?? 0) + RENEWAL_SHIELDS;

  const { error } = await sb.from('profiles').update(update).eq('id', opts.userId);
  if (error) throw new Error(`stripe fulfillment write failed: ${error.message}`);
}

/** Cancellation / final subscription end → revoke Pro. */
export async function revokeStripePro(eventId: string, userId: string): Promise<void> {
  if (!(await claimEvent(eventId))) return;
  const sb = getAdminSupabase();
  const { error } = await sb.from('profiles').update({ is_pro: false }).eq('id', userId);
  if (error) throw new Error(`stripe revoke write failed: ${error.message}`);
}
