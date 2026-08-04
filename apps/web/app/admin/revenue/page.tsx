'use client';

import { useEffect, useState } from 'react';
import { DollarSign, CreditCard, Smartphone, Globe, ExternalLink, Receipt, CheckCircle2, HelpCircle } from 'lucide-react';
import { useDrill } from '../components/drill-panel';
import { EXPENSES, expenseTotals } from '@/lib/expenses';

// Revenue across every rail, each number labeled by its source: Stripe is a
// live API, subscription counts come from the entitlement DB (the cross-rail
// truth), and the ad networks are live only after the one-time OAuth grant —
// until then they say "not connected" instead of showing fabricated zeros.
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
    error?: string;
    reportDate?: string;
    rows?: { name: string; duration: string; price: number; proceeds: number; active: number }[];
    paidActive?: number;
    mrr?: number;
    proceedsMrr?: number;
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
  admob: { connected?: boolean; error?: string; currency?: string; total30d?: number; apps?: { app: string; earnings: number; impressions: number }[] } | null;
  adsense: { connected?: boolean; error?: string; total30d?: number; impressions?: number } | null;
  adsConnected: boolean;
}

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

      {/* Ad networks */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> AdMob (iOS + Android)
            </h2>
            <SourceTag kind={data.adsConnected && !data.admob?.error ? 'live' : 'off'} />
          </div>
          {!data.adsConnected ? (
            <p className="text-xs font-bold text-gray-400 leading-relaxed">
              Google&apos;s AdMob reporting API only accepts a personal OAuth grant (service accounts are
              not supported), so live numbers need a one-time authorization: run
              <code className="mx-1 px-1 bg-gray-100 rounded">node scripts/revenue-oauth.mjs</code>
              and approve with the AdMob Google account. Until then:
              <a href="https://apps.admob.com" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">AdMob dashboard <ExternalLink className="w-3 h-3" /></a>
            </p>
          ) : data.admob?.error ? (
            <p className="text-sm font-bold text-red-500">{data.admob.error}</p>
          ) : (
            <>
              <p className="text-2xl font-black text-gray-900">{usd(data.admob?.total30d)} <span className="text-xs font-bold text-gray-400">last 30 days</span></p>
              <div className="mt-2 space-y-1">
                {data.admob?.apps?.map((a) => (
                  <div key={a.app} className="flex justify-between text-xs">
                    <span className="font-bold text-gray-500">{a.app}</span>
                    <span className="font-black text-gray-900">{usd(a.earnings)} · {a.impressions.toLocaleString()} impr.</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> AdSense (web)
            </h2>
            <SourceTag kind={data.adsConnected && !data.adsense?.error ? 'live' : 'off'} />
          </div>
          {!data.adsConnected ? (
            <p className="text-xs font-bold text-gray-400 leading-relaxed">
              Same one-time grant lights this up too (the script requests both scopes). AdSense is
              still under Google review, so expect $0 until approval either way.
              <a href="https://www.google.com/adsense" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">AdSense dashboard <ExternalLink className="w-3 h-3" /></a>
            </p>
          ) : data.adsense?.error ? (
            <p className="text-sm font-bold text-amber-600">{data.adsense.error}</p>
          ) : (
            <p className="text-2xl font-black text-gray-900">{usd(data.adsense?.total30d)} <span className="text-xs font-bold text-gray-400">last 30 days · {data.adsense?.impressions?.toLocaleString() ?? 0} impressions</span></p>
          )}
        </div>
      </div>

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
// state with the exact setup step (same honesty pattern as AdMob).
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
        <p className="text-xs font-bold text-gray-400 leading-relaxed">
          Apple&apos;s salesReports API can supply its own subscription prices and active counts, but the
          credentials aren&apos;t on the server yet: set
          <code className="mx-1 px-1 bg-gray-100 rounded">ASC_KEY_ID</code>
          <code className="mr-1 px-1 bg-gray-100 rounded">ASC_ISSUER_ID</code>
          <code className="mr-1 px-1 bg-gray-100 rounded">ASC_PRIVATE_KEY</code>
          <code className="mr-1 px-1 bg-gray-100 rounded">ASC_VENDOR_NUMBER</code>
          in Vercel (key contents from the local .p8; vendor number from App Store Connect →
          Payments and Financial Reports). Until then:
          <a href="https://appstoreconnect.apple.com/trends" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-500 hover:text-purple-700">App Store Connect <ExternalLink className="w-3 h-3" /></a>
        </p>
      ) : apple.error ? (
        <p className="text-sm font-bold text-red-500">{apple.error}</p>
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
