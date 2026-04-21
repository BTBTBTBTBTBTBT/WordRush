import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, itemId, returnUrl } = body;

    if (!userId || !type || !returnUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const provider = getPaymentProvider();

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
