import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { fulfillStripePurchase, revokeStripePro } from '@/lib/payment/stripe-fulfillment';

// Stripe webhook — the SERVER-AUTHORITATIVE grant path for web Pro. Verifies
// the signature, then fulfills via service-role (never the client). Fails
// closed (503) until STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are set, so
// nothing here can grant Pro until Stripe is truly wired (PAYMENTS_RUNBOOK.md).
//
// Handled events:
//   checkout.session.completed  — initial purchase (sub OR Day Pass one-time)
//   invoice.paid                — subscription renewal (+ shields)
//   customer.subscription.deleted — cancellation ended → revoke
//
// The raw request body is required for signature verification (no JSON parse).

export const runtime = 'nodejs';

// Wordocious plan IDs. The Stripe account is SHARED with ShowLoud, LLC, so this
// endpoint receives ShowLoud's account-wide subscription events too. We act ONLY
// on events whose metadata.planId is one of ours — a ShowLoud event (different
// or absent planId) is ignored even if it somehow carries a userId.
const KNOWN_PLANS = new Set(['pro_monthly', 'pro_yearly', 'pro_day']);

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: 'stripe not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const stripe = new Stripe(secretKey);
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json({ error: `signature verification failed: ${(e as Error).message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id || s.metadata?.userId;
        const planId = s.metadata?.planId;
        if (!userId || !planId || !KNOWN_PLANS.has(planId)) break; // not one of ours (or a ShowLoud event)
        await fulfillStripePurchase({
          eventId: event.id,
          userId,
          planId,
          // Day Pass (mode: payment) gets no shields; subscriptions do.
          grantShields: s.mode === 'subscription',
          stripeCustomerId: typeof s.customer === 'string' ? s.customer : undefined,
          stripeSubscriptionId: typeof s.subscription === 'string' ? s.subscription : undefined,
        });
        break;
      }
      case 'invoice.paid': {
        // Renewal. The first invoice is also covered by checkout.session.completed;
        // idempotency (per event id) keeps the two from double-granting shields.
        const inv = event.data.object as Stripe.Invoice & { subscription?: string };
        const subId = typeof inv.subscription === 'string' ? inv.subscription : undefined;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = sub.metadata?.userId;
        const planId = sub.metadata?.planId;
        if (!userId || !planId || !KNOWN_PLANS.has(planId)) break; // ignore ShowLoud subs on the shared account
        await fulfillStripePurchase({
          eventId: event.id,
          userId,
          planId,
          grantShields: true,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : undefined,
          stripeSubscriptionId: sub.id,
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        const planId = sub.metadata?.planId;
        if (!userId || !planId || !KNOWN_PLANS.has(planId)) break; // ours only (shared account)
        await revokeStripePro(event.id, userId);
        break;
      }
      default:
        break; // ignore other event types
    }
  } catch (e) {
    // A fulfillment/DB failure must 500 so Stripe retries — a 200 would lose it.
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
