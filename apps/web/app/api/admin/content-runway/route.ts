import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { bankRunwayReport } from '@/lib/bank-runway';

export const dynamic = 'force-dynamic';

/** admin > Ops > Content runway: every bundled daily bank with its days left and recycle date. */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({ today, banks: bankRunwayReport(today) });
}
