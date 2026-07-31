'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Share2, Flag, UserPlus } from 'lucide-react';
import { DrillCard, useDrill } from '../components/drill-panel';
import { modeLabel } from '@/lib/mode-labels';

// The Weekly Five as a page — the founders' agreed metric set (distribution
// memo §14), previously only runnable as SQL by hand. DAU, retention cohorts,
// share rate, Pro conversion, reports — plus provider mix and guest
// conversions.
interface MetricsData {
  dau: { day: string; dau: number }[];
  retention: { cohort: string; size: number; d1: number; d7: number; d30: number }[];
  shareRate: { day: string; games: number; shares: number; rate: number }[];
  shareBreakdown: {
    byMode: { key: string; count: number }[];
    bySurface: { key: string; count: number }[];
    byKind: { key: string; count: number }[];
  };
  summary: {
    totalProfiles: number;
    activePro: number;
    webCustomers: number;
    proPct: number;
    guestConversions: number;
    signups7d: number;
    lapsedNotSwept?: number;
  };
  providers: { key: string; count: number }[];
  reportsDaily: { day: string; count: number }[];
}

const fmtDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function Bars({ points, color, metric }: { points: { day: string; value: number }[]; color: string; metric?: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const drill = useDrill();
  return (
    <div className="flex items-end gap-1 h-16">
      {/* h-full on the column is load-bearing: a percentage height resolves
          against a parent with a DEFINITE height, and without it every bar
          collapsed to minHeight regardless of value. */}
      {[...points].reverse().map((p) => (
        <button
          type="button"
          key={p.day}
          disabled={!metric || p.value === 0}
          onClick={() => metric && drill({ metric, day: p.day })}
          className={`flex-1 flex flex-col justify-end h-full ${metric && p.value > 0 ? 'cursor-pointer hover:opacity-75' : 'cursor-default'}`}
          title={`${fmtDay(p.day)}: ${p.value}${metric && p.value > 0 ? ' — click for detail' : ''}`}
        >
          <div className="w-full rounded-t" style={{ height: `${(p.value / max) * 100}%`, minHeight: p.value > 0 ? 3 : 1, background: p.value > 0 ? color : '#e5e7eb' }} />
        </button>
      ))}
    </div>
  );
}

export default function AdminMetricsPage() {
  const drill = useDrill();
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data?.summary) return <p className="text-sm text-gray-400">Failed to load metrics.</p>;

  const { summary } = data;
  const todayDau = data.dau[0]?.dau ?? 0;
  const totalShares14 = data.shareRate.reduce((a, b) => a + b.shares, 0);
  const totalGames14 = data.shareRate.reduce((a, b) => a + b.games, 0);
  const reports30 = data.reportsDaily.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Metrics — the Weekly Five</h1>

      {/* Headline cards — each opens the rows behind its number */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <DrillCard
          label="DAU today" icon={<TrendingUp className="w-3.5 h-3.5" />}
          value={todayDau} drill={{ metric: 'dau' }}
        />
        <DrillCard
          label="Share rate (14d)" icon={<Share2 className="w-3.5 h-3.5" />}
          value={`${totalGames14 ? Math.round((1000 * totalShares14) / totalGames14) / 10 : 0}%`}
          sub={`${totalShares14} shares / ${totalGames14} games`}
          drill={{ metric: 'shares' }}
        />
        <DrillCard
          label="Pro conversion" value={`${summary.proPct}%`}
          sub={
            summary.lapsedNotSwept
              ? `${summary.activePro} active / ${summary.totalProfiles} accounts · ${summary.lapsedNotSwept} lapsed still flagged`
              : `${summary.activePro} Pro / ${summary.totalProfiles} accounts`
          }
          drill={{ metric: 'pro' }}
        />
        <DrillCard
          label="Signups (7d)" icon={<UserPlus className="w-3.5 h-3.5" />}
          value={summary.signups7d} sub={`${summary.guestConversions} from guest play`}
          drill={{ metric: 'signups' }}
        />
        <DrillCard
          label="Reports (30d)" icon={<Flag className="w-3.5 h-3.5" />}
          value={reports30} sub="the quiet sixth number"
          drill={{ metric: 'reports' }}
        />
      </div>

      {/* DAU + share rate charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">Daily active players — last 14 days</p>
          <Bars points={data.dau.map((d) => ({ day: d.day, value: d.dau }))} color="#7c3aed" metric="dau" />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-3">Shares per day — last 14 days</p>
          <Bars points={data.shareRate.map((d) => ({ day: d.day, value: d.shares }))} color="#ec4899" metric="shares" />
        </div>
      </div>

      {/* Retention cohorts */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 pt-4">Retention by first-played cohort</p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Cohort</th>
              <th className="px-4 py-2">Players</th>
              <th className="px-4 py-2">D1</th>
              <th className="px-4 py-2">D7</th>
              <th className="px-4 py-2">D30</th>
            </tr>
          </thead>
          <tbody>
            {data.retention.map((c) => (
              <tr key={c.cohort} onClick={() => drill({ metric: 'cohort', day: c.cohort })}
                  className="border-b border-gray-50 cursor-pointer hover:bg-gray-50" title="Click for the players in this cohort">
                <td className="px-4 py-2 font-bold text-gray-500">{fmtDay(c.cohort)}</td>
                <td className="px-4 py-2 font-black text-gray-900">{c.size}</td>
                <td className="px-4 py-2 font-bold text-gray-700">{c.d1}%</td>
                <td className="px-4 py-2 font-bold text-gray-700">{c.d7}%</td>
                <td className="px-4 py-2 font-bold text-gray-700">{c.d30}%</td>
              </tr>
            ))}
            {data.retention.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-300 font-bold">No cohorts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Share breakdowns + auth providers */}
      <div className="grid md:grid-cols-3 gap-4">
        {([
          ['Shares by mode', data.shareBreakdown.byMode, { metric: 'shares', by: 'mode' }],
          ['Shares by surface', data.shareBreakdown.bySurface, { metric: 'shares', by: 'surface' }],
          ['Sign-in providers', data.providers, { metric: 'provider' }],
        ] as const).map(([title, rows, dp]) => (
          <div key={title} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">{title}</p>
            {rows.length === 0 ? (
              <p className="text-xs font-bold text-gray-300">No data yet</p>
            ) : (
              <div className="space-y-1.5">
                {rows.slice(0, 6).map((r) => (
                  <button
                    type="button" key={r.key}
                    onClick={() => drill({ ...dp, key: r.key })}
                    className="w-full flex justify-between text-sm hover:bg-gray-50 rounded px-1 -mx-1 py-0.5"
                  >
                    <span className="font-bold text-gray-600">{title === 'Shares by mode' ? modeLabel(r.key) : r.key}</span>
                    <span className="font-black text-gray-900">{r.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
