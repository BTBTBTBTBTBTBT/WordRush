#!/usr/bin/env node
// Create the three Play monetization products, mirroring the App Store exactly.
//
//   node scripts/play-create-products.mjs            # dry run: show what would be created
//   node scripts/play-create-products.mjs --write    # create + activate
//
// Products (verified against ASC 2026-08-01 — all three APPROVED on Apple):
//   pro_monthly  $6.99   auto-renewing P1M   → +30d
//   pro_yearly   $59.99  auto-renewing P1Y   → +365d
//   pro_day      $1.00   one-time consumable → +24h stacked
//
// The IDs are bare (pro_monthly), not bundle-prefixed like Apple's
// com.wordocious.app.pro_monthly — StoreManager.kt expects the bare form.
//
// Requires the service account to hold "Manage store presence" on the app
// ("...edit pricing; manage in-app products..."). NOT "Manage orders and
// subscriptions", which is order handling and does not grant product creation.
// Permission changes take time to reach the API — a 403 right after granting is
// propagation lag, not a wrong permission.
//
// Pricing for non-US regions comes from Google's own converter
// (pricing:convertRegionPrices) so every market gets a sensible local price
// rather than a raw FX conversion. If that call is unavailable the script stops
// rather than silently shipping US-only pricing.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY = process.env.PLAY_SERVICE_ACCOUNT || path.join(os.homedir(), '.android-keys/play-publisher.json');
const PACKAGE = 'com.wordocious.app';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const REGIONS_VERSION = '2022/02';
const write = process.argv.includes('--write');

async function token() {
  const sa = JSON.parse(fs.readFileSync(KEY, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.createSign('RSA-SHA256').update(input)
    .sign(sa.private_key.replace(/\\n/g, '\n')).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${input}.${sig}`,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`token exchange failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

const money = (dollars) => {
  const [u, c = '0'] = String(dollars).split('.');
  return { currencyCode: 'USD', units: u, nanos: Number(c.padEnd(2, '0')) * 10_000_000 };
};

let H;
const call = async (method, url, body) => {
  const r = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, json: j, err: j.error?.message };
};

/** Google's own per-region prices for a USD base — not a raw FX conversion. */
async function regionPrices(dollars) {
  const r = await call('POST', `${API}/applications/${PACKAGE}/pricing:convertRegionPrices`,
    { price: money(dollars) });
  if (!r.ok) throw new Error(`convertRegionPrices failed (${r.status}): ${r.err}`);
  const regional = Object.entries(r.json.convertedRegionPrices || {})
    .map(([regionCode, v]) => ({ regionCode, price: v.price, newSubscriberAvailability: true }));
  return { regional, other: r.json.convertedOtherRegionsPrice };
}

const SUBS = [
  { productId: 'pro_monthly', basePlanId: 'monthly', period: 'P1M', usd: '6.99',
    title: 'Wordocious Pro Monthly', description: 'Unlock every mode, no ads, and full stats.' },
  { productId: 'pro_yearly', basePlanId: 'yearly', period: 'P1Y', usd: '59.99',
    title: 'Wordocious Pro Yearly', description: 'A year of Wordocious Pro — every mode, no ads, full stats.' },
];

async function createSubscription(s) {
  const { regional, other } = await regionPrices(s.usd);
  const body = {
    packageName: PACKAGE, productId: s.productId,
    listings: [{ languageCode: 'en-US', title: s.title, description: s.description }],
    basePlans: [{
      basePlanId: s.basePlanId,
      // 7-day grace: a failed renewal keeps Pro alive while the card is retried,
      // rather than yanking it mid-puzzle over a transient decline.
      autoRenewingBasePlanType: { billingPeriodDuration: s.period, gracePeriodDuration: 'P7D' },
      regionalConfigs: regional,
      otherRegionsConfig: other
        ? { usdPrice: other.usdPrice, eurPrice: other.eurPrice, newSubscriberAvailability: true }
        : undefined,
    }],
  };
  console.log(`\n${s.productId}: $${s.usd} ${s.period} — ${regional.length} regions priced`);
  if (!write) return console.log('  (dry run)');

  const c = await call('POST',
    `${API}/applications/${PACKAGE}/subscriptions?productId=${s.productId}` +
    `&regionsVersion.version=${encodeURIComponent(REGIONS_VERSION)}`, body);
  if (!c.ok) return console.error(`  CREATE FAILED (${c.status}): ${c.err}`);
  console.log('  created');

  const a = await call('POST',
    `${API}/applications/${PACKAGE}/subscriptions/${s.productId}/basePlans/${s.basePlanId}:activate`,
    { packageName: PACKAGE, productId: s.productId, basePlanId: s.basePlanId });
  console.log(a.ok ? '  base plan activated' : `  ACTIVATE FAILED (${a.status}): ${a.err}`);
}

async function createDayPass() {
  const { regional } = await regionPrices('1.00');
  const product = {
    packageName: PACKAGE, productId: 'pro_day',
    regionsVersion: { version: REGIONS_VERSION },
    listings: [{ languageCode: 'en-US', title: 'Wordocious Pro Day Pass',
      description: '24 hours of Wordocious Pro.' }],
    purchaseOptions: [{
      purchaseOptionId: 'day',
      // legacyCompatible so it also resolves through the older Play Billing
      // query path; only one purchase option per product may set this.
      buyOption: { legacyCompatible: true, multiQuantityEnabled: false },
      regionalPricingAndAvailabilityConfigs: regional.map(({ regionCode, price }) => ({
        regionCode, price, availability: 'AVAILABLE',
      })),
    }],
  };
  console.log(`\npro_day: $1.00 consumable — ${regional.length} regions priced`);
  if (!write) return console.log('  (dry run)');

  const r = await call('POST', `${API}/applications/${PACKAGE}/oneTimeProducts:batchUpdate`,
    { requests: [{ oneTimeProduct: product, allowMissing: true,
      regionsVersion: { version: REGIONS_VERSION } }] });
  console.log(r.ok ? '  created' : `  FAILED (${r.status}): ${r.err}`);
}

const t = await token();
H = { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
for (const s of SUBS) await createSubscription(s);
await createDayPass();
console.log(write ? '\nDone. Verify in Play Console → Monetize → Products.' : '\nDry run — pass --write to create.');
