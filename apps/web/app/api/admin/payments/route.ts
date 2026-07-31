import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The customer-service payments view, one call:
 *   - proUsers: every active Pro profile with its rail (Stripe vs store-managed).
 *     The rail matters because it decides where a refund/cancel can actually be
 *     executed — Stripe we control; Apple/Google purchases belong to the store.
 *   - stripe: live subscriptions + recent payments straight from the Stripe API
 *     (server-side secret; nothing sensitive reaches the browser beyond what an
 *     agent needs — emails, amounts, statuses, dashboard ids).
 *   - webhookEvents: the store_webhook_events ledger, newest first. It is an
 *     idempotency ledger (event id + source only), so it serves here as a
 *     liveness feed proving Apple/Google notifications are arriving.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();

  const soonIso = new Date(Date.now() + 7 * 86400000).toISOString();
  const [proRes, eventsRes, referralsRes] = await Promise.all([
    admin
      .from('profiles')
      .select('id, username, is_pro, pro_expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('is_pro', true)
      .order('pro_expires_at', { ascending: false })
      .limit(200),
    admin
      .from('store_webhook_events')
      .select('event_id, source, processed_at')
      .order('processed_at', { ascending: false })
      .limit(25),
    admin.from('referrals').select('status, redeemed_at, reward_granted_at, expires_at'),
  ]);

  const proUsers = (proRes.data || []).map((p) => ({
    ...p,
    rail: p.stripe_customer_id ? 'stripe' : 'store',
  }));

  // Forward-looking Pro lifecycle: who is ABOUT to expire (CS gets ahead of
  // "my Pro vanished" tickets), plus the referral-gift pipeline state.
  const refs = referralsRes.data || [];
  const lifecycle = {
    expiringSoon: proUsers
      .filter((p) => p.pro_expires_at && p.pro_expires_at <= soonIso)
      .map((p) => ({ username: p.username, expiresAt: p.pro_expires_at, rail: p.rail })),
    referrals: {
      pending: refs.filter((r) => r.status === 'pending').length,
      redeemed: refs.filter((r) => r.status === 'redeemed').length,
      converted: refs.filter((r) => r.status === 'converted').length,
      // Redeemed trials whose conversion reward hasn't fired — inviters still
      // waiting on their friend's first paid invoice.
      awaitingConversion: refs.filter((r) => r.status === 'redeemed' && !r.reward_granted_at).length,
    },
  };

  // Live Stripe data — degrade gracefully when the key isn't configured (local
  // dev) instead of failing the whole page.
  let stripe: any = { configured: false, subscriptions: [], payments: [] };
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey) {
    try {
      const client = new Stripe(secretKey);
      const [subs, charges] = await Promise.all([
        client.subscriptions.list({ limit: 20, status: 'all', expand: ['data.customer'] }),
        client.charges.list({ limit: 20 }),
      ]);
      stripe = {
        configured: true,
        subscriptions: subs.data.map((s) => ({
          id: s.id,
          status: s.status,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          // Newer Stripe API versions moved current_period_end onto the items;
          // fall back for whichever shape this account's version returns.
          currentPeriodEnd: (s as any).current_period_end ?? (s.items.data[0] as any)?.current_period_end ?? null,
          created: s.created,
          customerId: typeof s.customer === 'string' ? s.customer : s.customer?.id,
          customerEmail:
            typeof s.customer === 'object' && s.customer && 'email' in s.customer
              ? (s.customer as any).email
              : null,
          plan: s.items.data[0]?.price?.nickname || s.items.data[0]?.price?.id || null,
          amount: s.items.data[0]?.price?.unit_amount ?? null,
          currency: s.items.data[0]?.price?.currency ?? null,
        })),
        payments: charges.data.map((c) => ({
          id: c.id,
          amount: c.amount,
          currency: c.currency,
          status: c.status,
          refunded: c.refunded,
          email: c.billing_details?.email || c.receipt_email || null,
          created: c.created,
          customerId: typeof c.customer === 'string' ? c.customer : null,
        })),
      };
    } catch (e: any) {
      stripe = { configured: true, error: e?.message || 'Stripe request failed', subscriptions: [], payments: [] };
    }
  }

  return NextResponse.json({
    proUsers,
    webhookEvents: eventsRes.data || [],
    stripe,
    lifecycle,
  });
}
