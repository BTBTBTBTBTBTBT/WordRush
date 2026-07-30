import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { verifyUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // The checkout session carries this id in its metadata, and the webhook
    // grants Pro to whoever it names — so it must come from the verified token
    // rather than the request body.
    const user = await verifyUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, itemId, returnUrl } = body;
    const userId = user.id;

    if (!type || !returnUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const provider = getPaymentProvider();
    // No provider configured → refuse (never grant free Pro). The Pro page
    // gates its buttons on NEXT_PUBLIC_STRIPE_ENABLED, so users shouldn't reach
    // here, but the API is the real backstop.
    if (!provider) {
      return NextResponse.json({ error: 'Payments are not available yet.' }, { status: 503 });
    }

    if (type === 'subscription') {
      if (!itemId) {
        return NextResponse.json({ error: 'Missing plan ID' }, { status: 400 });
      }
      const result = await provider.createSubscriptionSession(userId, itemId, returnUrl);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid purchase type' }, { status: 400 });
  } catch (error: any) {
    console.error('Purchase error:', error);
    return NextResponse.json(
      { error: error.message || 'Purchase failed' },
      { status: 500 },
    );
  }
}
