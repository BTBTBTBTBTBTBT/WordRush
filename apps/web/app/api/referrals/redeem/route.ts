import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api-auth';
import { redeemReferral } from '@/lib/referral-service';

export const dynamic = 'force-dynamic';

/**
 * Redeem a referral code for the calling user. The code arrives from (in
 * priority order) the request body, the `wr_ref` cookie set by /join/[code],
 * or the signup metadata (`referral_code` passed to auth.signUp) — belt and
 * braces because the OAuth round-trip keeps the cookie while an email
 * confirmation opened in a different browser keeps only the metadata.
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let bodyCode: string | undefined;
  try {
    const body = await req.json();
    bodyCode = typeof body?.code === 'string' ? body.code : undefined;
  } catch {}

  const code = bodyCode
    || req.cookies.get('wr_ref')?.value
    || (user.user_metadata?.referral_code as string | undefined);
  if (!code) return NextResponse.json({ ok: false, reason: 'no_code' });

  const result = await redeemReferral(user.id, code);

  const res = NextResponse.json(result);
  // One shot either way — clear the cookie so sign-ins stop re-attempting.
  res.cookies.set('wr_ref', '', { maxAge: 0, path: '/' });
  return res;
}
