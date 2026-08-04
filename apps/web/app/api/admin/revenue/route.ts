import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createSign } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { PRO_PLANS } from '@/lib/payment/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Revenue at a glance, across every rail — with each number labeled by where
// it actually comes from, because the three sources have different truths:
//
//   Stripe        LIVE API — we hold the secret key server-side.
//   Subscriptions DB-derived — profiles is the entitlement authority all three
//                 clients read, so counts here are the truth about who HAS Pro,
//                 regardless of which store billed them.
//   AdMob/AdSense LIVE API only after a ONE-TIME user OAuth grant: Google does
//                 not allow service accounts for either reporting API, so until
//                 the founder runs scripts/revenue-oauth.mjs the cards say
//                 "not connected" instead of showing fabricated zeros.
//
// Store DOLLARS come in two tiers of honesty:
//
//   ESTIMATED     store subscription counts (entitlement DB) × list price.
//                 The DB records WHO has Pro but not which plan a store sub
//                 is on (store_webhook_events keeps only event ids for
//                 idempotency), so the estimate assumes monthly and also
//                 reports the all-yearly floor. List prices ignore
//                 proration, refunds, and regional pricing; Apple/Google
//                 keep 15% (small-business tier, bible §194).
//   LIVE API      Apple's salesReports SUBSCRIPTION report — real
//                 Apple-side prices and active-sub counts — once the four
//                 ASC_* env vars exist server-side. Until then that card
//                 says "not connected". Play's financial data still needs
//                 credentials the publisher key deliberately excludes.
//
// Real PAYOUT dollars (what actually lands in the bank) remain in the store
// consoles; dashboard links fill that gap honestly.

const PLAN_MONTHLY_CENTS: Record<string, number> = {
  // MRR normalization: yearly contributes 1/12 per month. Derived from the
  // canonical plan list so a price change propagates here automatically.
  pro_monthly: Math.round(PRO_PLANS.monthly.price * 100),
  pro_yearly: Math.round((PRO_PLANS.yearly.price * 100) / 12),
};

// Apple/Google commission on subscriptions — 15% small-business tier (§194).
const STORE_CUT = 0.15;

async function googleAccessToken(refreshOverride?: string): Promise<string | null> {
  const id = process.env.REVENUE_GOOGLE_CLIENT_ID;
  const secret = process.env.REVENUE_GOOGLE_CLIENT_SECRET;
  const refresh = refreshOverride ?? process.env.REVENUE_GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        refresh_token: refresh,
        grant_type: 'refresh_token',
      }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

/** AdMob earnings, last 30 days, by app — needs the one-time OAuth grant. */
async function fetchAdmob(token: string) {
  const acctRes = await fetch('https://admob.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!acctRes.ok) return { error: `AdMob accounts: HTTP ${acctRes.status}` };
  const accts = (await acctRes.json()) as { account?: { name: string; currencyCode?: string }[] };
  const account = accts.account?.[0];
  if (!account) return { error: 'No AdMob account visible to this grant' };

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const d = (x: Date) => ({ year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate() });
  const repRes = await fetch(`https://admob.googleapis.com/v1/${account.name}/networkReport:generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reportSpec: {
        dateRange: { startDate: d(start), endDate: d(end) },
        // APP alone was ambiguous — both apps are named "Wordocious", so the
        // two rows were indistinguishable. PLATFORM disambiguates them.
        dimensions: ['APP', 'PLATFORM'],
        metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS'],
      },
    }),
  });
  if (!repRes.ok) return { error: `AdMob report: HTTP ${repRes.status}` };
  const rows = (await repRes.json()) as {
    row?: { dimensionValues?: { APP?: { displayLabel?: string }; PLATFORM?: { value?: string } }; metricValues?: { ESTIMATED_EARNINGS?: { microsValue?: string }; IMPRESSIONS?: { integerValue?: string } } };
  }[];
  const apps = rows
    .filter((r) => r.row)
    .map((r) => ({
      app: `${r.row!.dimensionValues?.APP?.displayLabel ?? 'unknown'}${r.row!.dimensionValues?.PLATFORM?.value ? ` (${r.row!.dimensionValues.PLATFORM.value})` : ''}`,
      earnings: Number(r.row!.metricValues?.ESTIMATED_EARNINGS?.microsValue ?? 0) / 1e6,
      impressions: Number(r.row!.metricValues?.IMPRESSIONS?.integerValue ?? 0),
    }));
  return {
    currency: account.currencyCode ?? 'USD',
    apps,
    total30d: apps.reduce((a, b) => a + b.earnings, 0),
  };
}

/** AdSense earnings, last 30 days — same grant, adsense.readonly scope. */
async function fetchAdsense(token: string) {
  const acctRes = await fetch('https://adsense.googleapis.com/v2/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!acctRes.ok) return { error: `AdSense accounts: HTTP ${acctRes.status}` };
  const accts = (await acctRes.json()) as { accounts?: { name: string }[] };
  const account = accts.accounts?.[0];
  if (!account) return { error: 'No AdSense account visible to this grant (application may still be under review)' };

  const repRes = await fetch(
    `https://adsense.googleapis.com/v2/${account.name}/reports:generate?dateRange=LAST_30_DAYS&metrics=ESTIMATED_EARNINGS&metrics=IMPRESSIONS`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!repRes.ok) return { error: `AdSense report: HTTP ${repRes.status}` };
  const rep = (await repRes.json()) as { totals?: { cells?: { value?: string }[] } };
  return {
    total30d: Number(rep.totals?.cells?.[0]?.value ?? 0),
    impressions: Number(rep.totals?.cells?.[1]?.value ?? 0),
  };
}

// ── Apple App Store Connect: real subscription revenue ──────────────────────
// The salesReports SUBSCRIPTION report is a daily snapshot of every active
// subscription with Apple's own price and proceeds figures. Auth is an ES256
// JWT signed with an App Store Connect API key. All four env vars must be
// present server-side (the .p8 lives only on the founder's machine, never in
// the repo): ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY (PEM, \n-escaped ok),
// ASC_VENDOR_NUMBER (from App Store Connect → Payments and Financial Reports).

function ascJwt(keyId: string, issuerId: string, privateKeyPem: string): string {
  const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iss: issuerId, iat, exp: iat + 20 * 60, aud: 'appstoreconnect-v1' }));
  const signer = createSign('SHA256');
  signer.update(`${header}.${payload}`);
  const sig = signer.sign({ key: privateKeyPem.replace(/\\n/g, '\n'), dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64url(sig)}`;
}

interface AppleReportRow { name: string; duration: string; price: number; proceeds: number; active: number }

/** Parse the gzipped TSV subscription report into duration-normalized MRR. */
function parseAppleSubscriptionReport(tsv: string) {
  const lines = tsv.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { rows: [] as AppleReportRow[], paidActive: 0, mrr: 0, proceedsMrr: 0 };
  const headers = lines[0].split('\t').map((h) => h.trim());
  const idx = (name: string) => headers.findIndex((h) => h === name);
  const [iName, iDur, iPrice, iProceeds] = ['Subscription Name', 'Standard Subscription Duration', 'Customer Price', 'Developer Proceeds'].map(idx);
  // Paid-active columns only — free trials and marketing opt-ins excluded.
  const activeIdx = headers
    .map((h, i) => (/^Active /.test(h) && !/Free Trial/.test(h) ? i : -1))
    .filter((i) => i >= 0);
  const rows: AppleReportRow[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split('\t');
    const active = activeIdx.reduce((a, i) => a + (Number(c[i]) || 0), 0);
    if (!active) continue;
    rows.push({
      name: iName >= 0 ? c[iName] : 'unknown',
      duration: iDur >= 0 ? c[iDur] : '',
      price: iPrice >= 0 ? Number(c[iPrice]) || 0 : 0,
      proceeds: iProceeds >= 0 ? Number(c[iProceeds]) || 0 : 0,
      active,
    });
  }
  // Normalize a yearly price to its per-month contribution so the total is MRR.
  const perMonth = (r: AppleReportRow, v: number) => (/year/i.test(r.duration) ? v / 12 : v);
  return {
    rows,
    paidActive: rows.reduce((a, r) => a + r.active, 0),
    mrr: rows.reduce((a, r) => a + perMonth(r, r.price) * r.active, 0),
    proceedsMrr: rows.reduce((a, r) => a + perMonth(r, r.proceeds) * r.active, 0),
  };
}

async function fetchAppleSubscriptions() {
  const keyId = process.env.ASC_KEY_ID;
  const issuerId = process.env.ASC_ISSUER_ID;
  const privateKey = process.env.ASC_PRIVATE_KEY;
  const vendor = process.env.ASC_VENDOR_NUMBER;
  if (!keyId || !issuerId || !privateKey || !vendor) return { connected: false as const };
  try {
    const jwt = ascJwt(keyId, issuerId, privateKey);
    // Daily reports appear with ~1 day lag; walk back a few days to the most
    // recent one that exists (404 = not published yet / no activity).
    for (let daysAgo = 1; daysAgo <= 4; daysAgo++) {
      const d = new Date(Date.now() - daysAgo * 86400000);
      const reportDate = d.toISOString().slice(0, 10);
      const qs = new URLSearchParams({
        'filter[frequency]': 'DAILY',
        'filter[reportDate]': reportDate,
        'filter[reportSubType]': 'SUMMARY',
        'filter[reportType]': 'SUBSCRIPTION',
        'filter[vendorNumber]': vendor,
        'filter[version]': '1_3',
      });
      const r = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${qs}`, {
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/a-gzip' },
      });
      if (r.status === 404) continue;
      if (!r.ok) return { connected: true as const, error: `Apple salesReports: HTTP ${r.status}` };
      const tsv = gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8');
      return { connected: true as const, reportDate, ...parseAppleSubscriptionReport(tsv) };
    }
    return { connected: true as const, error: 'No subscription report published in the last 4 days' };
  } catch (e) {
    return { connected: true as const, error: e instanceof Error ? e.message : 'Apple salesReports failed' };
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = Date.now();

  // ── Subscriptions: the entitlement DB is the cross-rail truth ─────────────
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, is_pro, pro_expires_at, stripe_customer_id, app_platform');
  const active = (profiles ?? []).filter(
    (p) => p.is_pro && (!p.pro_expires_at || new Date(p.pro_expires_at).getTime() > now),
  );
  const subs = {
    activeTotal: active.length,
    stripe: active.filter((p) => p.stripe_customer_id).length,
    store: active.filter((p) => !p.stripe_customer_id).length,
    // app_platform is the §199 presence stamp — fills in as stamped builds
    // reach users, so the store split is labeled "best known", not claimed.
    storeIos: active.filter((p) => !p.stripe_customer_id && p.app_platform === 'ios').length,
    storeAndroid: active.filter((p) => !p.stripe_customer_id && p.app_platform === 'android').length,
  };

  // ── Store revenue ESTIMATE: entitlement-DB counts × list price ────────────
  // The DB doesn't record which plan a store sub is on, so dollars assume
  // monthly ($6.99/mo); the all-yearly floor ($59.99/12 ≈ $5.00/mo per sub)
  // bounds the estimate from below. Cents math, floated once at the end.
  const est = (count: number) => ({
    count,
    mrr: (count * PLAN_MONTHLY_CENTS.pro_monthly) / 100,
    mrrIfAllYearly: (count * PLAN_MONTHLY_CENTS.pro_yearly) / 100,
  });
  const storeEstimate = {
    assumption: 'monthly' as const,
    monthlyPrice: PRO_PLANS.monthly.price,
    yearlyMonthlyEquivalent: PLAN_MONTHLY_CENTS.pro_yearly / 100,
    storeCut: STORE_CUT,
    ios: est(subs.storeIos),
    android: est(subs.storeAndroid),
    storeTotal: est(subs.store),
  };

  // ── Stripe: live ──────────────────────────────────────────────────────────
  let stripe: Record<string, unknown> = { configured: false };
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) {
    try {
      const client = new Stripe(key);
      const [subsList, charges] = await Promise.all([
        client.subscriptions.list({ status: 'active', limit: 100 }),
        client.charges.list({ limit: 100 }),
      ]);
      const byPlan = new Map<string, number>();
      let mrrCents = 0;
      for (const s of subsList.data) {
        const price = s.items.data[0]?.price;
        const plan = price?.nickname || price?.id || 'unknown';
        byPlan.set(plan, (byPlan.get(plan) ?? 0) + 1);
        mrrCents += PLAN_MONTHLY_CENTS[plan] ?? (price?.recurring?.interval === 'year'
          ? Math.round((price?.unit_amount ?? 0) / 12)
          : price?.unit_amount ?? 0);
      }
      const paid = charges.data.filter((c) => c.status === 'succeeded' && !c.refunded);
      const monthAgo = now / 1000 - 30 * 86400;
      stripe = {
        configured: true,
        activeSubscriptions: subsList.data.length,
        byPlan: [...byPlan.entries()].map(([plan, count]) => ({ plan, count })),
        mrr: mrrCents / 100,
        gross30d: paid.filter((c) => c.created >= monthAgo).reduce((a, c) => a + c.amount, 0) / 100,
        grossAllTime: paid.reduce((a, c) => a + c.amount, 0) / 100,
        chargesCounted: paid.length,
        chargesCapped: charges.data.length === 100,
        dayPasses30d: paid.filter((c) => c.created >= monthAgo && c.amount === 100).length,
      };
    } catch (e) {
      stripe = { configured: true, error: e instanceof Error ? e.message : 'Stripe request failed' };
    }
  }

  // ── Google ad networks: live only once the one-time grant exists ──────────
  // AdMob lives under bterchin@gmail; AdSense (the Wordocious application)
  // lives under bt@showloud — two logins, so optionally two refresh tokens.
  // The _ADSENSE token wins for AdSense when present; otherwise both use the
  // main grant.
  const token = await googleAccessToken();
  const adsenseToken = process.env.REVENUE_GOOGLE_REFRESH_TOKEN_ADSENSE
    ? await googleAccessToken(process.env.REVENUE_GOOGLE_REFRESH_TOKEN_ADSENSE)
    : token;
  const [admob, adsense, apple] = await Promise.all([
    token ? fetchAdmob(token) : Promise.resolve(null),
    adsenseToken ? fetchAdsense(adsenseToken) : Promise.resolve(null),
    fetchAppleSubscriptions(),
  ]);

  // All-rails MRR headline: Stripe's live number where we have it, plus the
  // store estimate — flagged combined-is-estimate whenever the store side > 0.
  const stripeMrr = typeof stripe.mrr === 'number' ? stripe.mrr : 0;
  const combined = {
    mrr: stripeMrr + storeEstimate.storeTotal.mrr,
    stripeActual: typeof stripe.mrr === 'number',
    estimated: storeEstimate.storeTotal.count > 0,
  };

  return NextResponse.json({
    subs,
    storeEstimate,
    combined,
    stripe,
    apple,
    admob: token ? admob : { connected: false },
    adsense: token ? adsense : { connected: false },
    adsConnected: !!token,
  });
}
