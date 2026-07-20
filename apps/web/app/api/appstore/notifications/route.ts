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
// ⚠️ SETUP (see PAYMENTS_RUNBOOK.md) — until done, this route fails CLOSED
// (503) and changes nothing; the existing client-side fulfillment keeps
// working, so nothing breaks:
//   1. Drop Apple's root CA .cer files into apps/web/certs/ (gitignored).
//   2. Set env: APPSTORE_BUNDLE_ID, APPSTORE_APP_APPLE_ID,
//      SUPABASE_SERVICE_ROLE_KEY (and APPSTORE_ACCEPT_SANDBOX=true in preview).
//   3. Configure this URL in App Store Connect → App Store Server Notifications
//      (Production + Sandbox).
//   4. Sandbox-verify, THEN apply supabase/manual-migrations/…_lock_pro_columns.
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
const RENEWAL_SHIELDS = 4;

// Grant/extend Pro vs revoke it. IMMEDIATE_REVOKES fire regardless of any
// expiry (a refund/revoke takes effect now); EXPIRY_REVOKES are period-driven
// and must be ignored if they're a stale event from an already-superseded
// period (audit #5, out-of-order delivery).
const GRANTS = new Set<string>([
  NotificationTypeV2.SUBSCRIBED,
  NotificationTypeV2.DID_RENEW,
  NotificationTypeV2.OFFER_REDEEMED,
  NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS,
  NotificationTypeV2.DID_CHANGE_RENEWAL_PREF,
  NotificationTypeV2.ONE_TIME_CHARGE,
]);
const IMMEDIATE_REVOKES = new Set<string>([
  NotificationTypeV2.REVOKE,
  NotificationTypeV2.REFUND,
]);
const EXPIRY_REVOKES = new Set<string>([
  NotificationTypeV2.EXPIRED,
  NotificationTypeV2.GRACE_PERIOD_EXPIRED,
]);
// Notification types that credit the +4 renewal shields (per billing period).
const SHIELD_GRANTS = new Set<string>([
  NotificationTypeV2.SUBSCRIBED,
  NotificationTypeV2.DID_RENEW,
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

/** Verify+decode against PRODUCTION, falling back to SANDBOX; report which env
 *  actually verified so the caller can reject sandbox events in production. */
async function decode(signedPayload: string) {
  const cas = appleRootCAs();
  if (cas.length === 0) throw new Error('no-apple-root-cas');
  for (const env of [Environment.PRODUCTION, Environment.SANDBOX]) {
    try {
      const verifier = new SignedDataVerifier(cas, true, env, BUNDLE_ID, APP_APPLE_ID);
      const payload = await verifier.verifyAndDecodeNotification(signedPayload);
      const signedTx = payload.data?.signedTransactionInfo;
      const tx = signedTx ? await verifier.verifyAndDecodeTransaction(signedTx) : undefined;
      return { payload, tx, env };
    } catch (e) {
      if (env === Environment.SANDBOX) throw e; // last env → real failure
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

  const { payload, tx, env } = decoded;

  // Reject SANDBOX notifications on the production deployment — otherwise a
  // TestFlight/sandbox purchase (or App Review) would mint real Pro. Preview
  // deployments opt in with APPSTORE_ACCEPT_SANDBOX=true (audit #9).
  const isProd = process.env.VERCEL_ENV === 'production';
  const acceptSandbox = process.env.APPSTORE_ACCEPT_SANDBOX === 'true';
  if (env === Environment.SANDBOX && isProd && !acceptSandbox) {
    return NextResponse.json({ ok: true, note: 'sandbox event ignored in production' });
  }

  const userId = tx?.appAccountToken;          // = Supabase user UUID (set by StoreManager)
  const productId = tx?.productId;
  if (!userId || !productId || !PRO_PRODUCT_IDS.has(productId)) {
    return NextResponse.json({ ok: true, note: 'ignored (no user / non-pro product)' });
  }

  const type = payload.notificationType as string;
  const eventId = (payload as { notificationUUID?: string }).notificationUUID;
  const expiresMs = tx?.expiresDate;           // ms epoch (subscriptions)
  const now = Date.now();

  const sb = getAdminSupabase();

  // Idempotency: a replayed/duplicate delivery must not re-apply (esp. shields).
  if (eventId) {
    const dup = await sb.from('store_webhook_events').select('event_id').eq('event_id', eventId).maybeSingle();
    if (dup.data) return NextResponse.json({ ok: true, note: 'already processed' });
  }

  // Current stored state — needed for the out-of-order guard and shield increment.
  const { data: current } = await sb
    .from('profiles')
    .select('pro_expires_at, streak_shields')
    .eq('id', userId)
    .maybeSingle();
  const storedExpiryMs = current?.pro_expires_at ? new Date(current.pro_expires_at).getTime() : 0;

  let isPro: boolean;
  let proExpiresAt: string;
  let shieldDelta = 0;

  if (IMMEDIATE_REVOKES.has(type)) {
    isPro = false;
    proExpiresAt = new Date(expiresMs ?? now).toISOString();
  } else if (EXPIRY_REVOKES.has(type)) {
    // Ignore a stale expiry event that predates the currently-stored window
    // (a late EXPIRED arriving after a newer DID_RENEW).
    const eventExpiry = expiresMs ?? now;
    if (storedExpiryMs && eventExpiry < storedExpiryMs) {
      if (eventId) await sb.from('store_webhook_events').insert({ event_id: eventId, source: 'appstore' });
      return NextResponse.json({ ok: true, note: 'stale expiry event ignored' });
    }
    isPro = false;
    proExpiresAt = new Date(eventExpiry).toISOString();
  } else if (GRANTS.has(type)) {
    // Day pass is consumable (no expiresDate) → stack 24h on any future window.
    const exp = expiresMs ?? (productId === DAY_PASS_ID ? Math.max(storedExpiryMs, now) + 24 * 3600 * 1000 : now);
    // Never let a stale grant shrink a newer stored expiry.
    const effectiveExp = Math.max(exp, storedExpiryMs);
    isPro = effectiveExp > now;
    proExpiresAt = new Date(effectiveExp).toISOString();
    if (SHIELD_GRANTS.has(type)) shieldDelta = RENEWAL_SHIELDS;
  } else {
    if (eventId) await sb.from('store_webhook_events').insert({ event_id: eventId, source: 'appstore' });
    return NextResponse.json({ ok: true, note: `ignored type ${type}` });
  }

  const update: Record<string, unknown> = { is_pro: isPro, pro_expires_at: proExpiresAt };
  if (shieldDelta > 0) update.streak_shields = (current?.streak_shields ?? 0) + shieldDelta;

  const { error } = await sb.from('profiles').update(update).eq('id', userId);
  if (error) {
    // MUST 500 so Apple retries — returning 200 on a failed write silently
    // loses the entitlement change (audit #4).
    return NextResponse.json({ error: 'db update failed', detail: error.message }, { status: 500 });
  }

  // Record only after a successful write, so a failed-then-retried event isn't
  // skipped as "already processed".
  if (eventId) await sb.from('store_webhook_events').insert({ event_id: eventId, source: 'appstore' });

  return NextResponse.json({ ok: true, userId, isPro, type });
}
