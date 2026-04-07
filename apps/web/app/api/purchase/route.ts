import { NextRequest, NextResponse } from 'next/server';
import { getPaymentProvider } from '@/lib/payment';
import { COIN_PACKS } from '@/lib/payment/coin-packs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, itemId, returnUrl } = body;

    if (!userId || !type || !returnUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const provider = getPaymentProvider();

    switch (type) {
      case 'coins': {
        if (!itemId || !COIN_PACKS.find(p => p.id === itemId)) {
          return NextResponse.json({ error: 'Invalid coin pack' }, { status: 400 });
        }
        const result = await provider.createCoinPurchaseSession(userId, itemId, returnUrl);
        return NextResponse.json(result);
      }

      case 'cosmetic': {
        if (!itemId) {
          return NextResponse.json({ error: 'Missing cosmetic ID' }, { status: 400 });
        }
        const result = await provider.createCosmeticPurchaseSession(userId, itemId, returnUrl);
        return NextResponse.json(result);
      }

      case 'subscription': {
        if (!itemId) {
          return NextResponse.json({ error: 'Missing plan ID' }, { status: 400 });
        }
        const result = await provider.createSubscriptionSession(userId, itemId, returnUrl);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Invalid purchase type' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Purchase error:', error);
    return NextResponse.json(
      { error: error.message || 'Purchase failed' },
      { status: 500 },
    );
  }
}
