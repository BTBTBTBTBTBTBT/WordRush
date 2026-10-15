'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ExternalLink } from 'lucide-react';
import { modeLabel } from '@/lib/mode-labels';
import { TabIntro, ErrorNote } from '../components/admin-ui';

// Ops > Health: the "is anything quietly broken" tab: cron heartbeats and an anti-cheat watchlist.
interface OpsData {
  suspects: { userId: string; username: string; day: string; mode: string; playType: string; score: number; reasons: string[] }[];
  crons: { job: string; label: string; status: string; lastRun: string | null; detail: string | null }[];
}

const CRON_STYLES: Record<string, string> = {
  healthy: 'text-green-700 bg-green-50',
  stale: 'text-amber-700 bg-amber-50',
  failed: 'text-red-600 bg-red-50',
  never: 'text-gray-500 bg-gray-100',
};

export default function HealthTab() {
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch('/api/admin/ops')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setFailed(true); setLoading(false); });
  }, []);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (failed || !data?.crons) return <ErrorNote>Could not load ops health.</ErrorNote>;

  return (
    <div className="space-y-6">
      <TabIntro>
        Is anything quietly broken: cron heartbeats and the anti-cheat watchlist. VS match health is on Games &gt; VS &amp; Bots; store webhooks are on Pro &amp; Gifts &gt; Store feed.
      </TabIntro>

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

      {/* Anti-cheat watchlist */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 pt-4 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Anti-cheat watchlist — scores that got through but look too high to be real (30d)
        </p>
        {data.suspects.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm font-bold text-gray-300">Nothing suspicious in the last 30 days.</p>
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
                  <td className="px-4 py-2 font-black text-gray-900">
                    <a href={`/admin/users/${s.userId}`} className="hover:text-purple-600">{s.username}</a>
                  </td>
                  <td className="px-4 py-2 font-bold text-gray-500">{s.day}</td>
                  <td className="px-4 py-2 font-bold text-gray-700">{modeLabel(s.mode)} <span className="text-gray-400">({s.playType})</span></td>
                  <td className="px-4 py-2 font-black text-red-500">{s.score}</td>
                  <td className="px-4 py-2 text-xs font-bold text-gray-500">{s.reasons.join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
