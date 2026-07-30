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
    console.error('Stripe portal error:', error);
    return NextResponse.json({ error: error.message || 'Could not open billing portal.' }, { status: 500 });
  }
}
