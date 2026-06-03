import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  SignedDataVerifier,
  Environment,
  NotificationTypeV2,
} from '@apple/app-store-server-library';
import { getAdminSupabase } from '@/lib/supabase-admin';

// ────────────────────────────────────────────────────────────────────────────
// App Store Server Notifications V2 webhook — the SERVER-AUTHORITATIVE source
// of Pro entitlement for iOS. Apple POSTs a signed payload on every
// subscription lifecycle event; we verify it against Apple's root certs, map
// the transaction's appAccountToken (set by StoreManager = the Supabase user
// id) to the user, and set profiles.is_pro / pro_expires_at via service-role.
//
// ⚠️ SETUP (see apps/web/app/api/appstore/README.md) — until done, this route
// fails CLOSED (503) and changes nothing; the existing client-side fulfillment
// keeps working, so nothing breaks:
//   1. Drop Apple's root CA .cer files into apps/web/certs/ (gitignored).
//   2. Set env: APPSTORE_BUNDLE_ID, APPSTORE_APP_APPLE_ID, SUPABASE_SERVICE_ROLE_KEY.
//   3. Configure this URL in App Store Connect → App Information → App Store
//      Server Notifications (Production + Sandbox).
//   4. Sandbox-test, THEN run migration 20260603000004_lock_pro_columns.sql.
// ────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

const BUNDLE_ID = process.env.APPSTORE_BUNDLE_ID || 'com.wordocious.app';
const APP_APPLE_ID = process.env.APPSTORE_APP_APPLE_ID ? Number(process.env.APPSTORE_APP_APPLE_ID) : undefined;
const PRO_PRODUCT_IDS = new Set([
  'com.wordocious.app.pro_monthly',
  'com.wordocious.app.pro_yearly',
  'com.wordocious.app.pro_day',
]);

// Notification types that GRANT/extend Pro vs REVOKE it.
const GRANTS = new Set<string>([
  NotificationTypeV2.SUBSCRIBED,
  NotificationTypeV2.DID_RENEW,
  NotificationTypeV2.OFFER_REDEEMED,
  NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
  NotificationTypeV2.DID_CHANGE_RENEWAL_PREF,
  NotificationTypeV2.ONE_TIME_CHARGE,
]);
const REVOKES = new Set<string>([
  NotificationTypeV2.EXPIRED,
  NotificationTypeV2.GRACE_PERIOD_EXPIRED,
  NotificationTypeV2.REVOKE,
  NotificationTypeV2.REFUND,
]);

let _rootCAs: Buffer[] | null = null;
function appleRootCAs(): Buffer[] {
  if (_rootCAs) return _rootCAs;
  const dir = path.join(process.cwd(), 'certs');
  try {
    _rootCAs = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.cer') || f.endsWith('.der') || f.endsWith('.pem'))
      .map((f) => fs.readFileSync(path.join(dir, f)));
  } catch {
    _rootCAs = [];
  }
  return _rootCAs;
}

/** Verify+decode against PRODUCTION, falling back to SANDBOX. */
async function decode(signedPayload: string) {
  const cas = appleRootCAs();
  if (cas.length === 0) throw new Error('no-apple-root-cas');
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = new SignedDataVerifier(cas, true, env, BUNDLE_ID, APP_APPLE_ID);
      const payload = await verifier.verifyAndDecodeNotification(signedPayload);
      const signedTx = payload.data?.signedTransactionInfo;
      const tx = signedTx ? await verifier.verifyAndDecodeTransaction(signedTx) : undefined;
      return { payload, tx };
    } catch (e) {
      // Wrong environment → try the next one; otherwise rethrow on the last.
      if (env === Environment.SANDBOX) throw e;
    }
  }
  throw new Error('verify-failed');
}

export async function POST(req: NextRequest) {
  let signedPayload: string;
  try {
    signedPayload = (await req.json()).signedPayload;
    if (!signedPayload) return NextResponse.json({ error: 'missing signedPayload' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await decode(signedPayload);
  } catch (e) {
    const msg = (e as Error).message;
    // Not configured yet → fail closed (503) so Apple retries later once set up.
    if (msg === 'no-apple-root-cas') return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
    // Signature/verification failure → reject (do NOT touch entitlements).
    return NextResponse.json({ error: 'verification failed' }, { status: 401 });
  }

  const { payload, tx } = decoded;
  const userId = tx?.appAccountToken;          // = Supabase user UUID (set by StoreManager)
  const productId = tx?.productId;
  if (!userId || !productId || !PRO_PRODUCT_IDS.has(productId)) {
    return NextResponse.json({ ok: true, note: 'ignored (no user / non-pro product)' });
  }

  const type = payload.notificationType as string;
  const expiresMs = tx?.expiresDate;           // ms epoch (subscriptions)
  const now = Date.now();
  let isPro: boolean;
  let proExpiresAt: string | null;

  if (REVOKES.has(type)) {
    isPro = false;
    proExpiresAt = expiresMs ? new Date(expiresMs).toISOString() : new Date(now).toISOString();
  } else if (GRANTS.has(type)) {
    // Day pass is consumable (no expiresDate) → grant 24h from now.
    const exp = expiresMs ?? (productId.endsWith('pro_day') ? now + 24 * 3600 * 1000 : now);
    isPro = exp > now;
    proExpiresAt = new Date(exp).toISOString();
  } else {
    return NextResponse.json({ ok: true, note: `ignored type ${type}` });
  }

  try {
    const sb = getAdminSupabase();
    await sb.from('profiles').update({ is_pro: isPro, pro_expires_at: proExpiresAt }).eq('id', userId);
  } catch (e) {
    return NextResponse.json({ error: 'db update failed', detail: (e as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId, isPro, type });
}
