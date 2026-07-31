'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCard, Users, Activity, LifeBuoy } from 'lucide-react';

// The customer-service payments view. Design rule: an agent reading this page
// should be able to answer "what is this user paying, through which rail, and
// where can I actually act on their request" without leaving the portal —
// acting means Stripe dashboard links for web billing, store guidance for
// Apple/Google (we cannot refund those), and the Grant-Pro panel on the user
// page for goodwill credit.
interface PaymentsData {
  proUsers: { id: string; username: string; pro_expires_at: string | null; rail: 'stripe' | 'store' }[];
  webhookEvents: { event_id: string; source: string; processed_at: string }[];
  lifecycle?: {
    expiringSoon: { username: string; expiresAt: string; rail: string }[];
    referrals: { pending: number; redeemed: number; converted: number; awaitingConversion: number };
  };
  stripe: {
    configured: boolean;
    error?: string;
    subscriptions: { id: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number | null; customerId: string | null; customerEmail: string | null; plan: string | null; amount: number | null; currency: string | null }[];
    payments: { id: string; amount: number; currency: string; status: string; refunded: boolean; email: string | null; created: number; customerId: string | null }[];
  };
}

const money = (amount: number | null, currency: string | null) =>
  amount == null ? '—' : `${(amount / 100).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/payments')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data) return <p className="text-sm text-gray-400">Failed to load payments.</p>;

  const stripeSubs = data.proUsers.filter((u) => u.rail === 'stripe').length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Payments</h1>

      {/* CS crib sheet — where a request can actually be executed */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 font-medium">
        <div className="flex items-center gap-1.5 font-black uppercase tracking-wide mb-1"><LifeBuoy className="w-4 h-4" /> Handling requests</div>
        <ul className="space-y-0.5 list-disc ml-4">
          <li><b>Web (Stripe):</b> refunds and cancellations are executed in the Stripe dashboard — links below and on each user&apos;s Billing card.</li>
          <li><b>App Store / Google Play:</b> we cannot refund or cancel store purchases. Point users to the store&apos;s own flow; goodwill Pro time can be granted from their user page.</li>
          <li><b>Entitlement disputes</b> (&quot;I paid but no Pro&quot;): check the user&apos;s Billing card, then the webhook feed below — if events stopped arriving, fulfillment is the problem, not the purchase.</li>
        </ul>
      </div>

      {/* Forward-looking lifecycle — get ahead of "my Pro vanished" */}
      {data.lifecycle && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Expiring within 7 days</h2>
            {data.lifecycle.expiringSoon.length === 0 ? (
              <p className="text-sm font-bold text-gray-300">Nobody expires this week.</p>
            ) : (
              <div className="space-y-1.5">
                {data.lifecycle.expiringSoon.map((u) => (
                  <div key={u.username} className="flex justify-between text-sm">
                    <span className="font-black text-gray-900">{u.username} <span className="text-[10px] font-bold text-gray-400 uppercase">{u.rail}</span></span>
                    <span className="font-bold text-amber-600">{new Date(u.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] font-bold text-gray-300 mt-2">Store renewals extend automatically via webhook; a Stripe sub here with cancel-at-period-end is a real churn.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Referral gift pipeline</h2>
            <div className="grid grid-cols-4 gap-2 text-center">
              {([
                ['Pending', data.lifecycle.referrals.pending],
                ['Redeemed', data.lifecycle.referrals.redeemed],
                ['Converted', data.lifecycle.referrals.converted],
                ['Awaiting pay', data.lifecycle.referrals.awaitingConversion],
              ] as const).map(([label, n]) => (
                <div key={label}>
                  <p className="text-xl font-black text-gray-900">{n}</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] font-bold text-gray-300 mt-3">Redeemed = friend has the 7-day trial; awaiting pay = inviter&apos;s 30/60-day reward fires on the friend&apos;s first paid invoice.</p>
          </div>
        </div>
      )}

      {/* Pro subscribers */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Users className="w-4 h-4" /> Active Pro — {data.proUsers.length} ({stripeSubs} Stripe, {data.proUsers.length - stripeSubs} store)
        </h2>
        {data.proUsers.length === 0 ? (
          <p className="text-sm text-gray-400">No active Pro users.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {data.proUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50">
                <Link href={`/admin/users/${u.id}`} className="font-bold text-gray-900 hover:text-purple-600">{u.username}</Link>
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${u.rail === 'stripe' ? 'text-indigo-700 bg-indigo-50' : 'text-gray-600 bg-gray-100'}`}>
                  {u.rail === 'stripe' ? 'STRIPE' : 'STORE'}
                </span>
                <span className="ml-auto text-gray-500">
                  expires {u.pro_expires_at ? new Date(u.pro_expires_at).toLocaleDateString() : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stripe subscriptions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" /> Stripe Subscriptions
          </h2>
          {!data.stripe.configured ? (
            <p className="text-sm text-gray-400">Stripe key not configured in this environment.</p>
          ) : data.stripe.error ? (
            <p className="text-sm text-red-500">{data.stripe.error}</p>
          ) : data.stripe.subscriptions.length === 0 ? (
            <p className="text-sm text-gray-400">No subscriptions yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {data.stripe.subscriptions.map((s) => (
                <div key={s.id} className="text-xs py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{s.customerEmail || s.customerId || '—'}</span>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${s.status === 'active' ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-100'}`}>{s.status}</span>
                    {s.cancelAtPeriodEnd && <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">CANCELS AT PERIOD END</span>}
                    <a href={`https://dashboard.stripe.com/subscriptions/${s.id}`} target="_blank" rel="noreferrer" className="ml-auto text-purple-600 hover:underline font-bold">Stripe ↗</a>
                  </div>
                  <div className="text-gray-500">
                    {money(s.amount, s.currency)}{s.plan ? ` · ${s.plan}` : ''}
                    {s.currentPeriodEnd ? ` · renews ${new Date(s.currentPeriodEnd * 1000).toLocaleDateString()}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Stripe payments */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" /> Recent Stripe Payments
          </h2>
          {!data.stripe.configured || data.stripe.payments.length === 0 ? (
            <p className="text-sm text-gray-400">No payments yet.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {data.stripe.payments.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50">
                  <span className="font-bold text-gray-900">{money(c.amount, c.currency)}</span>
                  <span className="text-gray-500">{c.email || '—'}</span>
                  {c.refunded ? (
                    <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">REFUNDED</span>
                  ) : (
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${c.status === 'succeeded' ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-100'}`}>{c.status}</span>
                  )}
                  <span className="ml-auto text-gray-400">{new Date(c.created * 1000).toLocaleDateString()}</span>
                  <a href={`https://dashboard.stripe.com/payments/${c.id}`} target="_blank" rel="noreferrer" className="text-purple-600 hover:underline font-bold">↗</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Store webhook liveness */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Activity className="w-4 h-4" /> Store Webhook Feed (Apple / Google fulfillment liveness)
        </h2>
        {data.webhookEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No store notifications received yet.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {data.webhookEvents.map((e) => (
              <div key={e.event_id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50">
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${e.source === 'appstore' ? 'text-gray-700 bg-gray-100' : 'text-green-700 bg-green-50'}`}>{e.source}</span>
                <span className="font-mono text-gray-500 text-[10px] truncate">{e.event_id}</span>
                <span className="ml-auto text-gray-400">{new Date(e.processed_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
