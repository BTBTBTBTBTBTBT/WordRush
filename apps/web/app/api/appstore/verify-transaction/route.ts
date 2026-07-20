import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { SignedDataVerifier, Environment } from '@apple/app-store-server-library';
import { getAdminSupabase } from '@/lib/supabase-admin';

// ────────────────────────────────────────────────────────────────────────────
// Client → server transaction verification — the SERVER-AUTHORITATIVE path for
// the Day Pass (and any purchase the client wants confirmed immediately).
//
// WHY THIS EXISTS: App Store Server Notifications are the source of truth for
// SUBSCRIPTIONS, but Apple does NOT reliably send ASSN for CONSUMABLES. The Day
// Pass (com.wordocious.app.pro_day) is a consumable, so it may never reach
// /api/appstore/notifications. Before the RLS lock lands (which stops the iOS
// client from writing profiles.is_pro directly), Day Pass fulfillment would
// silently break. This endpoint closes that gap: StoreManager POSTs the Day
// Pass's `Transaction.jwsRepresentation`; we verify it against Apple's root
// certs (identical trust model to the webhook) and write via service-role.
//
// The JWS is cryptographically signed by Apple and carries appAccountToken (the
// Supabase user id set by StoreManager at purchase), so it is self-identifying
// and tamper-proof — no separate auth is needed, and a replayed JWS can only
// ever re-grant the ORIGINAL buyer (idempotency below makes that a no-op).
//
// Fails CLOSED (503) until the same certs + env as the webhook are configured
// (see PAYMENTS_RUNBOOK.md). Until then the client-side grant keeps working, so
// nothing breaks pre-lock.
// ────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

const BUNDLE_ID = process.env.APPSTORE_BUNDLE_ID || 'com.wordocious.app';
const APP_APPLE_ID = process.env.APPSTORE_APP_APPLE_ID ? Number(process.env.APPSTORE_APP_APPLE_ID) : undefined;
const PRO_PRODUCT_IDS = new Set([
  'com.wordocious.app.pro_monthly',
  'com.wordocious.app.pro_yearly',
  'com.wordocious.app.pro_day',
]);
const DAY_PASS_ID = 'com.wordocious.app.pro_day';

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

/** Verify+decode a bare signed transaction (JWS) against PRODUCTION, falling
 *  back to SANDBOX; report which env actually verified so we can reject sandbox
 *  transactions on the production deployment. */
async function decodeTransaction(signedTransaction: string) {
  const cas = appleRootCAs();
  if (cas.length === 0) throw new Error('no-apple-root-cas');
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = new SignedDataVerifier(cas, true, env, BUNDLE_ID, APP_APPLE_ID);
      const tx = await verifier.verifyAndDecodeTransaction(signedTransaction);
      return { tx, env };
    } catch (e) {
      if (env === Environment.SANDBOX) throw e; // last env → real failure
    }
  }
  throw new Error('verify-failed');
}

export async function POST(req: NextRequest) {
  let signedTransaction: string;
  try {
    signedTransaction = (await req.json()).signedTransaction;
    if (!signedTransaction) return NextResponse.json({ error: 'missing signedTransaction' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'bad body' }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await decodeTransaction(signedTransaction);
  } catch (e) {
    const msg = (e as Error).message;
    // Not configured yet → fail closed (503) so the client can retry once set up.
    if (msg === 'no-apple-root-cas') return NextResponse.json({ error: 'verify not configured' }, { status: 503 });
    // Signature/verification failure → reject (do NOT touch entitlements).
    return NextResponse.json({ error: 'verification failed' }, { status: 401 });
  }

  const { tx, env } = decoded;

  // Reject SANDBOX transactions on the production deployment — otherwise a
  // TestFlight/sandbox purchase (or App Review) would mint real Pro. Preview
  // deployments opt in with APPSTORE_ACCEPT_SANDBOX=true (matches the webhook).
  const isProd = process.env.VERCEL_ENV === 'production';
  const acceptSandbox = process.env.APPSTORE_ACCEPT_SANDBOX === 'true';
  if (env === Environment.SANDBOX && isProd && !acceptSandbox) {
    return NextResponse.json({ ok: true, note: 'sandbox transaction ignored in production' });
  }

  const userId = tx?.appAccountToken;          // = Supabase user UUID (set by StoreManager)
  const productId = tx?.productId;
  const transactionId = tx?.transactionId;
  if (!userId || !productId || !PRO_PRODUCT_IDS.has(productId)) {
    return NextResponse.json({ ok: true, note: 'ignored (no user / non-pro product)' });
  }

  // A refunded/revoked transaction must not grant. (The webhook handles the
  // revoke write; here we simply refuse to re-grant a reversed purchase.)
  if (tx?.revocationDate) {
    return NextResponse.json({ ok: true, note: 'revoked transaction — no grant' });
  }

  const now = Date.now();
  const expiresMs = tx?.expiresDate;           // ms epoch (subscriptions); undefined for the consumable Day Pass
  const sb = getAdminSupabase();

  // Idempotency: keyed on the Apple transactionId, namespaced ('tx:') so it can
  // never collide with the webhook's notificationUUID keys in the shared ledger.
  // A replayed JWS (same transactionId) no-ops here.
  const eventId = transactionId ? `tx:${transactionId}` : undefined;
  if (eventId) {
    const dup = await sb.from('store_webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
    if (dup.data) return NextResponse.json({ ok: true, note: 'already processed' });
  }

  const { data: current } = await sb
    .from('profiles')
    .select('pro_expires_at')
    .eq('id', userId)
    .maybeSingle();
  const storedExpiryMs = current?.pro_expires_at ? new Date(current.pro_expires_at).getTime() : 0;

  // Day Pass is consumable (no expiresDate) → stack 24h onto any future window.
  // Subscriptions carry expiresDate. Never let this write shrink a newer stored
  // expiry (an out-of-order confirm after the webhook already advanced it).
  const exp = expiresMs ?? (productId === DAY_PASS_ID ? Math.max(storedExpiryMs, now) + 24 * 3600 * 1000 : now);
  const effectiveExp = Math.max(exp, storedExpiryMs);
  const isPro = effectiveExp > now;

  // NOTE: no streak-shield credit here. Shields are granted ONLY by the
  // authoritative ASSN webhook (SUBSCRIBED/DID_RENEW), so a subscription's
  // initial purchase can't be double-credited by both this confirm and the
  // webhook. This endpoint only establishes/extends entitlement.
  const { error } = await sb
    .from('profiles')
    .update({ is_pro: isPro, pro_expires_at: new Date(effectiveExp).toISOString() })
    .eq('id', userId);
  if (error) {
    // 500 so the client retries — a 200 on a failed write silently loses the
    // Day Pass the user paid for.
    return NextResponse.json({ error: 'db update failed', detail: error.message }, { status: 500 });
  }

  // Record only after a successful write, so a failed-then-retried confirm isn't
  // skipped as "already processed".
  if (eventId) await sb.from('store_webhook_events').insert({ event_id: eventId, source: 'appstore-verify' });

  return NextResponse.json({ ok: true, userId, isPro, productId });
}
