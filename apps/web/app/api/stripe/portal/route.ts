import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { verifyUser } from '@/lib/api-auth';

// Stripe Customer Portal — the self-serve manage/cancel path for a subscription
// bought on the WEB (wordocious.com). Mobile subs are managed in the App Store /
// Play (see the settings Subscription section). Looks up the user's
// stripe_customer_id (written by the Stripe webhook on first purchase) and mints
// a portal session. 404 if they have no web subscription.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // The user comes from the verified access token, NEVER from the body.
    // This route used to take `userId` as a POST field with no auth at all —
    // and user UUIDs are public (the leaderboard and records pages render
    // /profile/<uuid> links). Anyone could harvest an id, POST it here, and
    // receive a Stripe Customer Portal session for that person: their billing
    // history, their card details, and a cancel button for their subscription.
    const user = await verifyUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { returnUrl } = await req.json();
    if (!returnUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const userId = user.id;
    const provider = getPaymentProvider();
    if (!provider) {
      return NextResponse.json({ error: 'Billing is not available.' }, { status: 503 });
    }
    const sb = getAdminSupabase();
    const { data } = await sb
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();
    const customerId = data?.stripe_customer_id;
    if (!customerId) {
      // No web purchase on file — the caller shows the store links instead.
      return NextResponse.json({ error: 'No web subscription found.' }, { status: 404 });
    }
    const result = await provider.createPortalSession(customerId, returnUrl);
    return NextResponse.json(result);
  } catch (error: any) {
    // §255 (founder clicked "Manage web subscription" and got Stripe's raw
    // "No such customer: 'cus_…'" printed in Settings): a customer id on the
    // profile that this Stripe account doesn't know is the same situation as
    // no id at all — typically a test-mode customer left over from development.
    // Answer 404 so the client shows the friendly "no web subscription" copy,
    // and never surface Stripe's own message to the user.
    if (error?.code === 'resource_missing' || /No such customer/i.test(String(error?.message))) {
      console.warn('Stripe portal: customer id on profile is unknown to this Stripe account', error?.message);
      return NextResponse.json({ error: 'No web subscription found.' }, { status: 404 });
    }
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: 'Could not open billing portal.' }, { status: 500 });
  }
}
