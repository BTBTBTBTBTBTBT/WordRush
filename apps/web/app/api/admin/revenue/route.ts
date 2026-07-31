import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

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
// Store PROCEEDS (Apple/Google payouts) are deliberately absent rather than
// faked: Apple's sales reports and Play's financial data need separate
// credentials (Play's publisher key excludes financial scopes by design).
// Dashboard links fill that gap honestly.

const PLAN_MONTHLY_CENTS: Record<string, number> = {
  // MRR normalization: yearly contributes 1/12 per month.
  pro_monthly: 699,
  pro_yearly: Math.round(5999 / 12),
};

async function googleAccessToken(): Promise<string | null> {
  const id = process.env.REVENUE_GOOGLE_CLIENT_ID;
  const secret = process.env.REVENUE_GOOGLE_CLIENT_SECRET;
  const refresh = process.env.REVENUE_GOOGLE_REFRESH_TOKEN;
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
  const token = await googleAccessToken();
  const [admob, adsense] = token
    ? await Promise.all([fetchAdmob(token), fetchAdsense(token)])
    : [null, null];

  return NextResponse.json({
    subs,
    stripe,
    admob: token ? admob : { connected: false },
    adsense: token ? adsense : { connected: false },
    adsConnected: !!token,
  });
}
