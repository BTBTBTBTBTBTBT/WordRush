import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Google Search Console, read-only. Authenticates with the SAME service
// account JSON as FCM (FCM_SERVICE_ACCOUNT) — one key, two scopes — after
// that account's client_email is added as a user on the wordocious.com
// property in Search Console settings. Mint logic mirrors lib/push/fcm.ts.

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccount { client_email: string; private_key: string }

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!sa.client_email || !sa.private_key) return null;
    return { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, '\n') };
  } catch { return null; }
}

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600,
  })}`;
  const assertion = `${signingInput}.${crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key).toString('base64url')}`;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).access_token ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const sa = readServiceAccount();
  if (!sa) return NextResponse.json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, { status: 503 });
  const token = await accessToken(sa);
  if (!token) return NextResponse.json({ error: 'token mint failed' }, { status: 502 });

  const gsc = (path: string, init?: RequestInit) =>
    fetch(`https://www.googleapis.com/webmasters/v3${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    });

  // Property type (sc-domain: vs URL-prefix) is whatever was verified in the
  // console — discover it instead of hardcoding the wrong one.
  const sitesRes = await gsc('/sites');
  if (!sitesRes.ok) {
    return NextResponse.json(
      { error: `sites list failed (${sitesRes.status}) — is ${sa.client_email} added as a user on the property?` },
      { status: 502 },
    );
  }
  const sites: { siteUrl: string; permissionLevel: string }[] =
    (await sitesRes.json()).siteEntry ?? [];
  const site = sites.find((s) => s.siteUrl.includes('wordocious'));
  if (!site) {
    return NextResponse.json(
      { error: `service account sees no wordocious property — add ${sa.client_email} in Search Console settings` },
      { status: 404 },
    );
  }

  // GSC data lags ~2 days; ask for the last 28 available days.
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - 28 * 86_400_000);
  const encoded = encodeURIComponent(site.siteUrl);

  const [byDayRes, byQueryRes] = await Promise.all([
    gsc(`/sites/${encoded}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['date'], rowLimit: 30 }),
    }),
    gsc(`/sites/${encoded}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 15 }),
    }),
  ]);

  const byDay = byDayRes.ok ? ((await byDayRes.json()).rows ?? []) : [];
  const byQuery = byQueryRes.ok ? ((await byQueryRes.json()).rows ?? []) : [];

  const totals = byDay.reduce(
    (acc: { impressions: number; clicks: number }, r: any) => ({
      impressions: acc.impressions + (r.impressions ?? 0),
      clicks: acc.clicks + (r.clicks ?? 0),
    }),
    { impressions: 0, clicks: 0 },
  );
  // The SEO progress metric: branded ("wordocious"-ish) vs non-branded queries.
  const branded = byQuery
    .filter((r: any) => /wordocious|wordrush/i.test(r.keys?.[0] ?? ''))
    .reduce((n: number, r: any) => n + (r.impressions ?? 0), 0);

  return NextResponse.json({
    site: site.siteUrl,
    window: { start: fmt(start), end: fmt(end) },
    totals,
    brandedImpressions: branded,
    nonBrandedImpressions: Math.max(0, totals.impressions - branded),
    days: byDay.map((r: any) => ({ date: r.keys?.[0], impressions: r.impressions ?? 0, clicks: r.clicks ?? 0 })),
    topQueries: byQuery.map((r: any) => ({
      query: r.keys?.[0] ?? '', impressions: r.impressions ?? 0, clicks: r.clicks ?? 0,
      position: Math.round((r.position ?? 0) * 10) / 10,
    })),
  });
}
