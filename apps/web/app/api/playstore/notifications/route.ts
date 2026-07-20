import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminSupabase } from '@/lib/supabase-admin';

// ────────────────────────────────────────────────────────────────────────────
// Google Play Real-Time Developer Notifications (RTDN) webhook — the
// SERVER-AUTHORITATIVE source of Pro entitlement for Android, mirroring the
// Apple webhook at app/api/appstore/notifications. Play publishes every
// subscription lifecycle event to a Pub/Sub topic; a push subscription POSTs
// it here. We verify the purchase against the Play Developer API using a
// service account, map obfuscatedExternalAccountId (set by StoreManager.kt =
// the Supabase user id) to the user, and re-sync profiles.is_pro /
// pro_expires_at from the verified subscription state.
//
// ⚠️ SETUP (see ./README.md) — until configured this route fails CLOSED (503)
// and changes nothing; client-side fulfillment keeps working:
//   1. Google Cloud service account with the "Android Publisher" API enabled,
//      invited in Play Console → Users & permissions (View financial data +
//      Manage orders).
//   2. Env: PLAY_SA_EMAIL, PLAY_SA_PRIVATE_KEY (PEM, \n-escaped),
//      PLAY_PUBSUB_TOKEN (any random secret), SUPABASE_SERVICE_ROLE_KEY.
//      Optional: PLAY_PACKAGE_NAME (defaults to com.wordocious.app).
//   3. Pub/Sub topic + push subscription to
//      https://wordocious.com/api/playstore/notifications?token=<PLAY_PUBSUB_TOKEN>
//      and set the topic in Play Console → Monetize → Monetization setup.
//   4. Test with a license-tester purchase, THEN this route (together with the
//      Apple webhook) satisfies the lock_pro_columns migration prerequisite.
// ────────────────────────────────────────────────────────────────────────────

export const runtime = 'nodejs';

const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'com.wordocious.app';
const SA_EMAIL = process.env.PLAY_SA_EMAIL;
const SA_KEY = process.env.PLAY_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
const PUSH_TOKEN = process.env.PLAY_PUBSUB_TOKEN;

const DAY_PASS_PRODUCT_ID = 'pro_day';

// ── Service-account OAuth (no SDK: RS256 JWT → token exchange) ─────────────
let cachedToken: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const signature = crypto.createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(SA_KEY!, 'base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return cachedToken.token;
}

async function playApi(path: string): Promise<any | null> {
  const token = await getAccessToken();
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/${path}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return res.json();
}

// ── Entitlement sync ────────────────────────────────────────────────────────
async function syncSubscription(purchaseToken: string): Promise<string> {
  const sub = await playApi(`purchases/subscriptionsv2/tokens/${purchaseToken}`);
  if (!sub) return 'verify-failed';

  const userId = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!userId) return 'no-account-id'; // pre-webhook purchase without the id — client grant stands

  // Re-sync from the verified source of truth on EVERY event type: expiry in
  // the future → Pro until then; past → not Pro. Idempotent by construction.
  const expiryTimes: number[] = (sub.lineItems ?? [])
    .map((li: any) => Date.parse(li.expiryTime ?? ''))
    .filter((t: number) => Number.isFinite(t));
  const expiry = expiryTimes.length ? Math.max(...expiryTimes) : 0;
  const isPro = expiry > Date.now();

  const sb = getAdminSupabase();
  const { error } = await sb.from('profiles')
    .update({ is_pro: isPro, pro_expires_at: expiry ? new Date(expiry).toISOString() : null })
    .eq('id', userId);
  return error ? `db-error:${error.message}` : `synced:${isPro}`;
}

async function grantDayPass(purchaseToken: string, productId: string): Promise<string> {
  const purchase = await playApi(`purchases/products/${productId}/tokens/${purchaseToken}`);
  if (!purchase) return 'verify-failed';
  if (purchase.purchaseState !== 0) return 'not-purchased'; // 0 = purchased

  const userId = purchase.obfuscatedExternalAccountId;
  if (!userId) return 'no-account-id';

  // Day passes stack: extend from the later of now / current expiry (matches
  // StoreManager.kt + iOS StoreManager semantics).
  const sb = getAdminSupabase();
  const { data: profile } = await sb.from('profiles')
    .select('pro_expires_at').eq('id', userId).single();
  const base = Math.max(Date.now(), Date.parse(profile?.pro_expires_at ?? '') || 0);
  const expiry = new Date(base + 24 * 60 * 60 * 1000).toISOString();
  const { error } = await sb.from('profiles')
    .update({ is_pro: true, pro_expires_at: expiry }).eq('id', userId);
  return error ? `db-error:${error.message}` : 'day-pass-granted';
}

// ── Pub/Sub push handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!SA_EMAIL || !SA_KEY || !PUSH_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Fail closed: not configured yet — change nothing, let Pub/Sub retry.
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  if (req.nextUrl.searchParams.get('token') !== PUSH_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let notification: any;
  try {
    const envelope = await req.json();
    notification = JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8'));
  } catch {
    // Malformed push — ack it so Pub/Sub doesn't retry garbage forever.
    return NextResponse.json({ ok: false, reason: 'malformed' });
  }

  try {
    if (notification.subscriptionNotification?.purchaseToken) {
      const result = await syncSubscription(notification.subscriptionNotification.purchaseToken);
      // A DB write failure must 500 so Pub/Sub retries — returning 200 silently
      // loses the entitlement change (parity with the Apple webhook / audit #4).
      if (result.startsWith('db-error:')) return NextResponse.json({ error: result }, { status: 500 });
      return NextResponse.json({ ok: true, kind: 'subscription', result });
    }
    if (notification.oneTimeProductNotification?.purchaseToken) {
      const n = notification.oneTimeProductNotification;
      if (n.sku === DAY_PASS_PRODUCT_ID && n.notificationType === 1 /* PURCHASED */) {
        const result = await grantDayPass(n.purchaseToken, n.sku);
        if (result.startsWith('db-error:')) return NextResponse.json({ error: result }, { status: 500 });
        return NextResponse.json({ ok: true, kind: 'one-time', result });
      }
      return NextResponse.json({ ok: true, kind: 'one-time', result: 'ignored' });
    }
    // testNotification or voidedPurchase etc. — ack.
    return NextResponse.json({ ok: true, kind: 'other' });
  } catch (e) {
    // Transient (token exchange, network): 500 → Pub/Sub retries with backoff.
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
