'use client';

import { Receipt, ExternalLink, CheckCircle2, HelpCircle } from 'lucide-react';
import { EXPENSES, expenseTotals } from '@/lib/expenses';

// The infrastructure ledger — every service, its plan, its cost, and which
// login owns it. Data lives in lib/expenses.ts (one maintained source; most
// billing APIs expose no plan/price reads). Totals count VERIFIED rows only;
// estimates are shown separately rather than silently rolled in.
const usd = (n: number) => `$${n.toFixed(2)}`;

export default function AdminExpensesPage() {
  const totals = expenseTotals(EXPENSES);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Expenses</h1>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide">
            <Receipt className="w-3.5 h-3.5" /> Monthly (verified)
          </div>
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

      {/* Ledger */}
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
        This ledger is maintained in <code className="px-1 bg-gray-100 rounded">apps/web/lib/expenses.ts</code> —
        billing APIs don&apos;t expose plan/price reads, so when a plan changes, that file is where it&apos;s
        recorded. Amber rows are estimates awaiting a check against the linked billing console; confirming
        one is a one-word edit (verified: true). Usage-based costs (Stripe&apos;s per-transaction cut, Railway
        overage) appear in Notes rather than pretending to be fixed.
      </p>
    </div>
  );
}
