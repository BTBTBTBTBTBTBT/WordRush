'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Webhook, Swords, ExternalLink } from 'lucide-react';
import { DrillCard, useDrill } from '../components/drill-panel';

// Operational health — the "is anything quietly broken" page: cron heartbeats,
// the store-webhook ledger, an anti-cheat watchlist, and VS match health.
interface OpsData {
  webhooks: {
    recent: { event_id: string; source: string; processed_at: string }[];
    byDay: { day: string; appstore: number; playstore: number }[];
  };
  suspects: { username: string; day: string; mode: string; playType: string; score: number; reasons: string[] }[];
  vsHealth: {
    matches14d: number;
    completed14d: number;
    forfeits14d: number;
    abandonRate: number;
    avgDurationSec: number;
    distinctPlayers: number;
  };
  crons: { job: string; label: string; status: string; lastRun: string | null; detail: string | null }[];
}

const CRON_STYLES: Record<string, string> = {
  healthy: 'text-green-700 bg-green-50',
  stale: 'text-amber-700 bg-amber-50',
  failed: 'text-red-600 bg-red-50',
  never: 'text-gray-500 bg-gray-100',
};

export default function AdminOpsPage() {
  const drill = useDrill();
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/ops')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data?.crons) return <p className="text-sm text-gray-400">Failed to load ops data.</p>;

  const vs = data.vsHealth;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Ops</h1>

      {/* Cron heartbeats */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-2 mb-3">
          <Activity className="w-3.5 h-3.5" /> Cron heartbeats
        </p>
        <div className="space-y-2">
          {data.crons.map((c) => (
            <div key={c.job} className="flex items-center justify-between">
              <div>
                <span className="text-sm font-black text-gray-900">{c.label}</span>
                {c.detail && <span className="ml-2 text-xs font-bold text-gray-400">{c.detail}</span>}
              </div>
              <div className="flex items-center gap-3">
                {c.lastRun && (
                  <span className="text-xs font-bold text-gray-400">
                    {new Date(c.lastRun).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${CRON_STYLES[c.status]}`}>{c.status}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] font-bold text-gray-300 mt-3">
          Crashes live in Sentry — this page covers what Sentry can&apos;t see: jobs that silently stopped running.
          <a href="https://sentry.io" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 text-purple-400 hover:text-purple-600">
            Open Sentry <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      </div>

      {/* VS health */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <DrillCard label="Matches (14d)" icon={<Swords className="w-3.5 h-3.5" />}
          value={vs.matches14d} sub={`${vs.distinctPlayers} distinct players`}
          drill={{ metric: 'matches' }} />
        <DrillCard label="Completed" value={vs.completed14d} drill={{ metric: 'matches', key: 'completed' }} />
        <DrillCard label="Abandon rate" value={`${vs.abandonRate}%`} drill={{ metric: 'matches', key: 'abandoned' }} />
        <DrillCard label="Forfeits" value={vs.forfeits14d} drill={{ metric: 'matches', key: 'forfeit' }} />
        <DrillCard label="Avg duration" value={`${vs.avgDurationSec}s`} sub="bot games aren't match rows"
          drill={{ metric: 'matches', key: 'completed' }} />
      </div>

      {/* Anti-cheat watchlist */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 pt-4 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Anti-cheat watchlist — rows the DB clamps allowed but that exceed legit maxima (30d)
        </p>
        {data.suspects.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm font-bold text-gray-300">Nothing suspicious. The clamps held.</p>
        ) : (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2">Day</th>
                <th className="px-4 py-2">Mode</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Why flagged</th>
              </tr>
            </thead>
            <tbody>
              {data.suspects.map((s, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-2 font-black text-gray-900">{s.username}</td>
                  <td className="px-4 py-2 font-bold text-gray-500">{s.day}</td>
                  <td className="px-4 py-2 font-bold text-gray-700">{s.mode} <span className="text-gray-400">({s.playType})</span></td>
                  <td className="px-4 py-2 font-black text-red-500">{s.score}</td>
                  <td className="px-4 py-2 text-xs font-bold text-gray-500">{s.reasons.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Webhook ledger */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-2 mb-2">
            <Webhook className="w-3.5 h-3.5" /> Store webhooks by day
          </p>
          {data.webhooks.byDay.length === 0 ? (
            <p className="text-xs font-bold text-gray-300">No webhook events recorded</p>
          ) : (
            <div className="space-y-1">
              {data.webhooks.byDay.slice(0, 10).map((d) => (
                <button type="button" key={d.day} onClick={() => drill({ metric: 'webhooks', day: d.day })}
                  className="w-full flex justify-between text-sm hover:bg-gray-50 rounded px-1 -mx-1 py-0.5">
                  <span className="font-bold text-gray-500">{d.day}</span>
                  <span className="font-black text-gray-900">{d.appstore} App Store · {d.playstore} Play</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] font-bold text-gray-300 mt-3">
            The ledger records processed events only — a failing webhook shows up as silence here while
            subscriptions are active, not as an error row.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Latest events</p>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {data.webhooks.recent.map((e) => (
              <div key={e.event_id} className="flex justify-between text-xs">
                <span className="font-bold text-gray-500 truncate max-w-[50%]">{e.event_id}</span>
                <span className="font-black text-gray-700">{e.source}</span>
                <span className="font-bold text-gray-400">{new Date(e.processed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            ))}
            {data.webhooks.recent.length === 0 && <p className="text-xs font-bold text-gray-300">None yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
