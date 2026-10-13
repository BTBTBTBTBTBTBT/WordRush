'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DollarSign, CreditCard, Smartphone, Megaphone, ExternalLink, Receipt, CheckCircle2, HelpCircle } from 'lucide-react';
import { useDrill } from '../components/drill-panel';
import { EXPENSES, expenseTotals } from '@/lib/expenses';
import type { AdTotals, AdWindow, LevelPlayResult, LevelPlayEnvVar } from '@/lib/levelplay-reporting';

// Revenue across every rail, each number labeled by its source: Stripe is a
// live API, subscription counts come from the entitlement DB (the cross-rail
// truth), and app ads come from the Unity LevelPlay reporting API once its two
// server env vars exist. The web serves no ads (AdSense is closed for good).
// Every unconnected card says so instead of showing fabricated zeros.
interface StoreRailEstimate { count: number; mrr: number; mrrIfAllYearly: number }

// Active non-Stripe Pro split into comped ($0: admin gifts, referral trials,
// inviter bonus days, no-expiry manual grants) vs paid — see the classifier
// in api/admin/revenue. paidEvidence/assumedPaid split the PAID side by
// whether a positive payment record exists.
interface CompedBreakdown {
  count: number;
  adminGrant: number;
  referralTrial: number;
  referralInviter: number;
  noExpiry: number;
  paidEvidence: number;
  assumedPaid: number;
}

interface RevenueData {
  subs: { activeTotal: number; stripe: number; store: number; storeIos: number; storeAndroid: number };
  storeEstimate: {
    assumption: 'monthly';
    monthlyPrice: number;
    yearlyMonthlyEquivalent: number;
    storeCut: number;
    ios: StoreRailEstimate;
    android: StoreRailEstimate;
    storeTotal: StoreRailEstimate;
    comped: CompedBreakdown;
  };
  combined: { mrr: number; stripeActual: boolean; estimated: boolean };
  apple: {
    connected: boolean;
    /** Which of the four ASC_* env vars are absent (only when not connected). */
    missing?: AscEnvName[];
    error?: string;
    reportDate?: string;
    rows?: { name: string; duration: string; price: number; proceeds: number; active: number }[];
    paidActive?: number;
    mrr?: number;
    proceedsMrr?: number;
    /** Apple has no SUBSCRIPTION report yet (no App Store subscription activity): the week's sales report instead. */
    noSubscriptionReport?: boolean;
    sales?: { through: string; days: number; firstDownloads: number; redownloads: number; updates: number; purchases: number; proceeds: Record<string, number> };
  };
  stripe: {
    configured: boolean;
    error?: string;
    activeSubscriptions?: number;
    byPlan?: { plan: string; count: number }[];
    mrr?: number;
    gross30d?: number;
    grossAllTime?: number;
    chargesCapped?: boolean;
    dayPasses30d?: number;
  };
  levelPlay: LevelPlayResult;
  /** The `ads` kill switch row (and any `ads.*` rows) from app_flags — the apps serve only while `ads` is live. */
  adFlags: { key: string; enabled: boolean; audience: string; note: string | null }[];
}

type AscEnvName = 'ASC_KEY_ID' | 'ASC_ISSUER_ID' | 'ASC_PRIVATE_KEY' | 'ASC_VENDOR_NUMBER';

// The four server env vars the Apple card needs and where each one lives in
// App Store Connect. Kept in the page (not imported from lib/asc-jwt, which
// pulls node:crypto into a client bundle) — the names are asserted equal by
// lib/asc-jwt.test.ts.
const ASC_ENV: { name: AscEnvName; from: string }[] = [
  { name: 'ASC_KEY_ID', from: 'Users and Access → Integrations → App Store Connect API → the key\u2019s Key ID' },
  { name: 'ASC_ISSUER_ID', from: 'same page → Issuer ID (one per team, shown above the key list)' },
  { name: 'ASC_PRIVATE_KEY', from: 'the downloaded AuthKey_<KEY_ID>.p8, BEGIN/END lines included — multi-line or \\n-escaped both work' },
  { name: 'ASC_VENDOR_NUMBER', from: 'Payments and Financial Reports → Vendor # at the top' },
];

const usd = (n?: number) => (n == null ? '—' : `$${n.toFixed(2)}`);

function SourceTag({ kind }: { kind: 'live' | 'db' | 'est' | 'off' }) {
  const map = {
    live: ['LIVE API', 'text-green-700 bg-green-50'],
    db: ['FROM ENTITLEMENT DB', 'text-blue-700 bg-blue-50'],
    est: ['ESTIMATED', 'text-amber-700 bg-amber-50'],
    off: ['NOT CONNECTED', 'text-gray-500 bg-gray-100'],
  } as const;
  const [label, cls] = map[kind];
  return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${cls}`}>{label}</span>;
}

export default function AdminRevenuePage() {
  const drill = useDrill();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/revenue')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data?.subs) return <p className="text-sm text-gray-400">Failed to load revenue.</p>;

  const s = data.stripe;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Revenue</h1>

      {/* Subscriptions across all three rails */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <Smartphone className="w-4 h-4" /> Subscriptions — all rails
          </h2>
          <SourceTag kind="db" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          <button type="button" onClick={() => drill({ metric: 'pro' })} className="rounded hover:bg-gray-50 py-1">
            <p className="text-2xl font-black text-gray-900">{data.subs.activeTotal}</p>
            <p className="text-xs font-bold text-gray-400">active Pro</p>
          </button>
          <div><p className="text-2xl font-black text-gray-900">{data.subs.stripe}</p><p className="text-xs font-bold text-gray-400">web (Stripe)</p></div>
          <div><p className="text-2xl font-black text-gray-900">{data.subs.store}</p><p className="text-xs font-bold text-gray-400">store total</p></div>
          <div><p className="text-2xl font-black text-gray-900">{data.subs.storeIos}</p><p className="text-xs font-bold text-gray-400">App Store*</p></div>
          <div><p className="text-2xl font-black text-gray-900">{data.subs.storeAndroid}</p><p className="text-xs font-bold text-gray-400">Play*</p></div>
        </div>
        <p className="text-[11px] font-bold text-gray-300 mt-3">
          The entitlement DB is what all three apps read, so these counts are the truth about who has Pro.
          *Store split uses the app-platform presence stamp and fills in as stamped builds reach users —
          store subscribers who haven&apos;t opened a stamped build yet appear only in &quot;store total&quot;.
        </p>
      </div>

      {/* Subscription dollars across all rails: Stripe actual + store estimate */}
      <EstimatedRevenueCard data={data} />

      {/* Stripe */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" /> Stripe (web)
          </h2>
          <SourceTag kind={s.configured && !s.error ? 'live' : 'off'} />
        </div>
        {!s.configured ? (
          <p className="text-sm font-bold text-gray-300">STRIPE_SECRET_KEY not configured.</p>
        ) : s.error ? (
          <p className="text-sm font-bold text-red-500">{s.error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-black text-gray-900">{usd(s.mrr)}</p><p className="text-xs font-bold text-gray-400">MRR (normalized)</p></div>
              <div><p className="text-2xl font-black text-gray-900">{usd(s.gross30d)}</p><p className="text-xs font-bold text-gray-400">gross, 30 days</p></div>
              <div><p className="text-2xl font-black text-gray-900">{usd(s.grossAllTime)}</p><p className="text-xs font-bold text-gray-400">gross, all time{s.chargesCapped ? ' (last 100 charges)' : ''}</p></div>
              <div><p className="text-2xl font-black text-gray-900">{s.dayPasses30d ?? 0}</p><p className="text-xs font-bold text-gray-400">day passes, 30d</p></div>
            </div>
            {!!s.byPlan?.length && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4">
                {s.byPlan.map((p) => (
                  <span key={p.plan} className="text-xs font-bold text-gray-500">{p.plan}: <span className="text-gray-900 font-black">{p.count}</span></span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* App ads: Unity LevelPlay in the iOS + Android apps */}
      <AppAdsCard levelPlay={data.levelPlay} adFlags={data.adFlags ?? []} />

      {/* Apple-reported subscription revenue (real, once ASC env exists) */}
      <AppleSalesCard apple={data.apple} />

      {/* Store payouts: still console-only */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide mb-1">
          <DollarSign className="w-3.5 h-3.5" /> Store payouts (Apple / Google)
        </div>
        <p className="text-[11px] font-bold text-gray-400 leading-relaxed">
          Store subscription dollars are now ESTIMATED above (counts × list price), and Apple&apos;s own
          figures appear once its report API is connected — but actual PAYOUT dollars (after refunds,
          taxes, and exchange rates) still live only in
          <a href="https://appstoreconnect.apple.com/trends" target="_blank" rel="noreferrer" className="mx-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">App Store Connect <ExternalLink className="w-3 h-3" /></a>
          and
          <a href="https://play.google.com/console" target="_blank" rel="noreferrer" className="mx-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">Play Console <ExternalLink className="w-3 h-3" /></a>
          (Play&apos;s financial data needs credentials the publisher key excludes by design).
        </p>
      </div>

      <ExpensesSection />
    </div>
  );
}

const LEVELPLAY_ENV: LevelPlayEnvVar[] = ['LEVELPLAY_SECRET_KEY', 'LEVELPLAY_REFRESH_TOKEN'];
const adUsd = (n: number) => `$${n.toFixed(2)}`;
const pct = (n: number | null) => (n == null ? '—' : `${(n * 100).toFixed(1)}%`);

// Daily revenue as a tiny inline SVG area line — no chart dependency, and the
// page has no other chart to reuse.
function Sparkline({ points }: { points: { date: string; revenue: number }[] }) {
  const w = 240;
  const h = 40;
  const max = Math.max(...points.map((p) => p.revenue), 0.01);
  const x = (i: number) => (points.length < 2 ? 0 : (i / (points.length - 1)) * w);
  const y = (v: number) => h - 3 - (v / max) * (h - 6);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.revenue).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none" role="img" aria-label="Daily ad revenue, last 30 days">
      <path d={`${line} L${w},${h} L0,${h} Z`} className="fill-purple-100" />
      <path d={line} className="stroke-purple-500 fill-none" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AdStatRow({ label, t }: { label: string; t: AdTotals }) {
  return (
    <tr className="border-t border-gray-50">
      <td className="py-1.5 pr-3 text-xs font-bold text-gray-500">{label}</td>
      <td className="py-1.5 px-2 text-right text-sm font-black text-gray-900">{adUsd(t.revenue)}</td>
      <td className="py-1.5 px-2 text-right text-xs font-bold text-gray-500">{t.impressions.toLocaleString()}</td>
      <td className="py-1.5 px-2 text-right text-xs font-bold text-gray-500">{t.ecpm == null ? '—' : adUsd(t.ecpm)}</td>
      <td className="py-1.5 pl-2 text-right text-xs font-bold text-gray-500">{pct(t.fillRate)}</td>
    </tr>
  );
}

function AdWindowTable({ w }: { w: AdWindow }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <thead>
          <tr className="text-[10px] font-black text-gray-400 uppercase tracking-wide">
            <th className="text-left pb-1 pr-3">Last {w.days} days</th>
            <th className="text-right pb-1 px-2">Revenue</th>
            <th className="text-right pb-1 px-2">Impressions</th>
            <th className="text-right pb-1 px-2">eCPM</th>
            <th className="text-right pb-1 pl-2">Fill</th>
          </tr>
        </thead>
        <tbody>
          <AdStatRow label="All app ads" t={w.total} />
          <AdStatRow label="iOS" t={w.byPlatform.ios} />
          <AdStatRow label="Android" t={w.byPlatform.android} />
          <AdStatRow label="Game Start Interstitial" t={w.byAdFormat.interstitial} />
          <AdStatRow label="Rewarded" t={w.byAdFormat.rewarded} />
        </tbody>
      </table>
    </div>
  );
}

// Unity LevelPlay (ironSource) reporting for the iOS + Android apps, or a calm
// setup card until the two server env vars exist. Also shows the app_flags
// The `ads` row is the apps' remote kill switch (unknown/missing = off).
function AppAdsCard({ levelPlay, adFlags }: { levelPlay: LevelPlayResult | undefined; adFlags: RevenueData['adFlags'] }) {
  const status = levelPlay?.status ?? 'not_connected';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Megaphone className="w-4 h-4" /> App ads — LevelPlay
        </h2>
        <SourceTag kind={status === 'ok' ? 'live' : 'off'} />
      </div>

      {levelPlay?.status === 'ok' ? (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <AdWindowTable w={levelPlay.summary.last7} />
            <AdWindowTable w={levelPlay.summary.last30} />
          </div>
          <div>
            <Sparkline points={levelPlay.summary.daily} />
            <p className="text-[11px] font-bold text-gray-300 mt-1">
              Daily revenue, last 30 days (UTC){levelPlay.summary.throughDate ? ` · data through ${levelPlay.summary.throughDate}` : ' · no data in this window yet'}.
              Today&apos;s figure is partial and LevelPlay revises recent days.
            </p>
          </div>
        </div>
      ) : levelPlay?.status === 'error' ? (
        <p className="text-sm font-bold text-red-500">{levelPlay.error}</p>
      ) : (
        <div className="text-xs font-bold text-gray-400 leading-relaxed">
          <p>
            Add <code className="px-1 bg-gray-100 rounded">LEVELPLAY_SECRET_KEY</code> and{' '}
            <code className="px-1 bg-gray-100 rounded">LEVELPLAY_REFRESH_TOKEN</code> in Vercel (LevelPlay → Account → API),
            then redeploy. The card connects on its next load.
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {LEVELPLAY_ENV.map((name) => {
              const isMissing = !levelPlay || levelPlay.status !== 'not_connected' || levelPlay.missing.includes(name);
              return (
                <li key={name} className="flex items-baseline gap-1.5">
                  <code className={`px-1 rounded ${isMissing ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{name}</code>
                  <span className={`text-[10px] font-black uppercase ${isMissing ? 'text-amber-600' : 'text-green-600'}`}>{isMissing ? 'missing' : 'set'}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2">
            Until then:
            <a href="https://platform.ironsrc.com" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">LevelPlay dashboard <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-gray-500">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Ads flag</span>
        {adFlags.length === 0 ? (
          <span className="text-gray-400">no <code className="px-1 bg-gray-100 rounded">ads</code> flag row (ads stay off)</span>
        ) : (
          adFlags.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1.5">
              <code className="px-1 bg-gray-100 rounded">{f.key}</code>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase ${f.enabled ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
                {f.enabled ? `on · ${f.audience}` : 'off'}
              </span>
            </span>
          ))
        )}
        <Link href="/admin/flags" className="ml-auto inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">Admin → Flags</Link>
      </div>
      <p className="text-[11px] font-bold text-gray-300 mt-2">
        iOS app key 28b3f4525, Android 28b3fb835. Revenue is LevelPlay&apos;s own estimate across all mediated networks; eCPM and fill are
        recomputed from totals (fill = ad-source fills ÷ requests). Pro means no ads. The web serves no ads.
      </p>
    </div>
  );
}

// Subscription dollars, all rails. Stripe's MRR is live; store rails are
// paid-classified count × list price — an ESTIMATE, because the entitlement
// DB records who has Pro but not which plan a store sub is on. COMPED Pro
// (admin gifts, referral 7-day trials, inviter bonus days, no-expiry manual
// grants) pays $0 and is classified out before the multiply — counting it at
// list price was fabricating MRR. Assumes monthly; the all-yearly floor
// bounds it below. Ignores proration, refunds, regional pricing.
// Apple/Google keep 15% (small-business tier).
function EstimatedRevenueCard({ data }: { data: RevenueData }) {
  const e = data.storeEstimate;
  const c = data.combined;
  if (!e || !c) return null;
  const net = (n: number) => n * (1 - e.storeCut);
  const comp = e.comped ?? { count: 0, adminGrant: 0, referralTrial: 0, referralInviter: 0, noExpiry: 0, paidEvidence: 0, assumedPaid: e.storeTotal.count };
  const compParts = [
    comp.adminGrant > 0 && `${comp.adminGrant} admin-gifted`,
    comp.referralTrial > 0 && `${comp.referralTrial} on a referral 7-day trial`,
    comp.referralInviter > 0 && `${comp.referralInviter} on referral inviter bonus days`,
    comp.noExpiry > 0 && `${comp.noExpiry} manual no-expiry`,
  ].filter(Boolean).join(', ');
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <DollarSign className="w-4 h-4" /> Subscription revenue — all rails
        </h2>
        <SourceTag kind="est" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
        <div>
          <p className="text-2xl font-black text-gray-900">{usd(c.mrr)}</p>
          <p className="text-xs font-bold text-gray-400">est. MRR, all rails</p>
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900">{c.stripeActual ? usd(data.stripe.mrr) : '—'}</p>
          <p className="text-xs font-bold text-gray-400">web (Stripe, actual)</p>
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900">{usd(e.ios.mrr)}</p>
          <p className="text-xs font-bold text-gray-400">App Store est. ({e.ios.count})</p>
        </div>
        <div>
          <p className="text-2xl font-black text-gray-900">{usd(e.android.mrr)}</p>
          <p className="text-xs font-bold text-gray-400">Play est. ({e.android.count})</p>
        </div>
        <div>
          <p className="text-2xl font-black text-gray-400">$0.00</p>
          <p className="text-xs font-bold text-gray-400">comped ({comp.count})</p>
        </div>
      </div>
      <p className="text-[11px] font-bold text-gray-300 mt-3 leading-relaxed">
        Store dollars are paid-classified count × list price ({usd(e.monthlyPrice)}/mo), NOT payment data.
        Comped Pro pays $0 and is excluded from every dollar figure
        {comp.count > 0 ? <> — {comp.count} of the {e.storeTotal.count + comp.count} store-side users: {compParts}</> : null}.
        A user is comped when their current Pro window is fully explained by the latest admin gift
        (audit-log expiry match), a redeemed referral&apos;s 7-day trial window, inviter bonus days, or an
        expiry-less grant no payment rail can produce. Of the {e.storeTotal.count} counted as paying,{' '}
        {comp.paidEvidence} have positive payment evidence (a webhook-stamped referral conversion); the
        other {comp.assumedPaid} have no per-user store payment record either way (the webhook ledger
        keeps only event ids) and are ASSUMED paying. Plan is also unrecorded, so this assumes monthly —
        all-yearly would make the store total {usd(e.storeTotal.mrrIfAllYearly)}/mo instead of{' '}
        {usd(e.storeTotal.mrr)}/mo. Ignores proration, refunds, and regional pricing. After the stores&apos;{' '}
        {Math.round(e.storeCut * 100)}% cut (small-business tier), the store estimate nets ≈{usd(net(e.storeTotal.mrr))}/mo.
        Store total ({e.storeTotal.count}) can exceed the App Store + Play split while presence stamps fill in.
      </p>
    </div>
  );
}

// Apple's own subscription numbers via the App Store Connect salesReports API —
// real prices and active counts from a daily snapshot, or a NOT CONNECTED
// state with the exact setup step (same honesty pattern as the app-ads card).
function AppleSalesCard({ apple }: { apple: RevenueData['apple'] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Smartphone className="w-4 h-4" /> App Store subscriptions (Apple-reported)
        </h2>
        <SourceTag kind={apple?.connected && !apple.error ? 'live' : 'off'} />
      </div>
      {!apple?.connected ? (
        <div className="text-xs font-bold text-gray-400 leading-relaxed">
          <p>
            Apple&apos;s salesReports API can supply its own subscription prices and active counts once
            these four server env vars exist in Vercel (Settings → Environment Variables, Production):
          </p>
          <ul className="mt-2 space-y-1.5">
            {ASC_ENV.map((v) => {
              const isMissing = !apple?.missing || apple.missing.includes(v.name);
              return (
                <li key={v.name} className="flex flex-wrap items-baseline gap-x-2">
                  <code className={`px-1 rounded ${isMissing ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{v.name}</code>
                  <span className={`text-[10px] font-black uppercase ${isMissing ? 'text-amber-600' : 'text-green-600'}`}>
                    {isMissing ? 'missing' : 'set'}
                  </span>
                  <span className="text-gray-400">App Store Connect → {v.from}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2">
            Vercel applies server env on the next deployment, so redeploy once all four are saved; the
            card then connects on its next load (a key that won&apos;t parse reports itself here). Until then:
            <a href="https://appstoreconnect.apple.com/trends" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">App Store Connect <ExternalLink className="w-3 h-3" /></a>
          </p>
        </div>
      ) : apple.error ? (
        <p className="text-sm font-bold text-red-500">{apple.error}</p>
      ) : apple.noSubscriptionReport && apple.sales ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><p className="text-2xl font-black text-gray-900">{apple.sales.firstDownloads}</p><p className="text-xs font-bold text-gray-400">first downloads</p></div>
            <div><p className="text-2xl font-black text-gray-900">{apple.sales.redownloads}</p><p className="text-xs font-bold text-gray-400">re-downloads</p></div>
            <div><p className="text-2xl font-black text-gray-900">{apple.sales.updates}</p><p className="text-xs font-bold text-gray-400">updates</p></div>
            <div>
              <p className="text-2xl font-black text-gray-900">{apple.sales.purchases}</p>
              <p className="text-xs font-bold text-gray-400">
                in-app purchases{Object.entries(apple.sales.proceeds).map(([c, v]) => ` · ${v.toFixed(2)} ${c}`).join('')}
              </p>
            </div>
          </div>
          <p className="text-[11px] font-bold text-gray-300 mt-3">
            Last 7 days of Apple&apos;s daily sales report{apple.sales.through ? ` (through ${apple.sales.through})` : ''}. Apple
            hasn&apos;t started a subscription report for this account yet: it appears after the first App Store subscription
            or trial, and then this card switches to subscribers and MRR on its own.
          </p>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-black text-gray-900">{usd(apple.mrr)}</p><p className="text-xs font-bold text-gray-400">MRR at Apple prices</p></div>
            <div><p className="text-2xl font-black text-gray-900">{usd(apple.proceedsMrr)}</p><p className="text-xs font-bold text-gray-400">proceeds MRR (after cut)</p></div>
            <div><p className="text-2xl font-black text-gray-900">{apple.paidActive ?? 0}</p><p className="text-xs font-bold text-gray-400">paid active subs</p></div>
          </div>
          {!!apple.rows?.length && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4">
              {apple.rows.map((r, i) => (
                <span key={i} className="text-xs font-bold text-gray-500">
                  {r.name} ({r.duration}): <span className="text-gray-900 font-black">{r.active} × {usd(r.price)}</span>
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] font-bold text-gray-300 mt-3">
            Daily snapshot from Apple&apos;s salesReports SUBSCRIPTION report ({apple.reportDate}); yearly plans
            counted at 1/12 per month. Free trials excluded.
          </p>
        </>
      )}
    </div>
  );
}

// The infrastructure ledger, folded in from the old standalone Expenses page
// (2026-08-02) so revenue and costs read as one P&L. Data lives in
// lib/expenses.ts — one maintained source; most billing APIs expose no
// plan/price reads. Totals count VERIFIED rows only.
function ExpensesSection() {
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const totals = expenseTotals(EXPENSES);

  return (
    <>
      <div className="flex items-center gap-2 pt-2">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <Receipt className="w-4 h-4" /> Expenses
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">Monthly (verified)</div>
          <p className="text-2xl font-black text-gray-900 mt-1">{usd(totals.verifiedMonthly)}</p>
          <p className="text-xs font-bold text-gray-400">yearly items counted at 1/12</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">Yearly (verified)</div>
          <p className="text-2xl font-black text-gray-900 mt-1">{usd(totals.verifiedYearly)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">Unconfirmed estimates</div>
          <p className="text-2xl font-black text-amber-600 mt-1">+{usd(totals.unverifiedMonthlyEstimate)}/mo</p>
          <p className="text-xs font-bold text-gray-400">pending founder check — not in totals</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">One-time (paid)</div>
          <p className="text-2xl font-black text-gray-900 mt-1">{usd(totals.oneTimeTotal)}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Account</th>
                <th className="px-4 py-3 hidden md:table-cell">Notes</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {EXPENSES.map((e) => (
                <tr key={e.service} className="border-b border-gray-50 align-top">
                  <td className="px-4 py-3">
                    <p className="font-black text-gray-900">{e.service}</p>
                    <p className="text-xs font-bold text-gray-400">{e.purpose}</p>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-700 whitespace-nowrap">{e.plan}</td>
                  <td className="px-4 py-3 font-black text-gray-900 whitespace-nowrap">
                    {e.monthly != null && `${usd(e.monthly)}/mo`}
                    {e.yearly != null && `${usd(e.yearly)}/yr`}
                    {e.oneTime != null && `${usd(e.oneTime)} once`}
                  </td>
                  <td className="px-4 py-3">
                    {e.verified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-green-50 text-green-700 uppercase">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 uppercase">
                        <HelpCircle className="w-3 h-3" /> Confirm
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-500 hidden lg:table-cell whitespace-nowrap">{e.account}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-400 hidden md:table-cell max-w-xs">{e.note ?? ''}</td>
                  <td className="px-4 py-3">
                    <a href={e.billingUrl} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-600 inline-flex" aria-label={`${e.service} billing`}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] font-bold text-gray-300 leading-relaxed">
        Ledger maintained in <code className="px-1 bg-gray-100 rounded">apps/web/lib/expenses.ts</code> —
        when a plan changes, that file is where it&apos;s recorded. Amber rows are estimates awaiting a
        check against the linked billing console. Usage-based costs (Stripe&apos;s per-transaction cut,
        Railway overage) appear in Notes rather than pretending to be fixed.
      </p>
    </>
  );
}
