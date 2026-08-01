'use client';

import { useEffect, useState } from 'react';
import { Users, Gamepad2, Crown, Activity, ShieldBan, UserPlus, BookOpen, Copy, Check } from 'lucide-react';
import { useDrill } from './components/drill-panel';
import { modeLabel } from '@/lib/mode-labels';

interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  proSubscribers: number;
  gamesToday: number;
  bannedUsers: number;
  recentSignups: Array<{
    id: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
    is_pro: boolean;
    level: number;
  }>;
  modePopularity: Record<string, number>;
}

// Mode names come from the SHARED lib/mode-labels — this page carried its own
// pre-refactor copy that was missing DUEL_6/DUEL_7, so the popularity bars
// showed raw enum keys for Six and Seven (§199's drift lesson, again).

/** "Latest Bible entry" card: view + copy §NNN, or copy the whole bible —
 *  for pasting into another Claude session without a repo checkout. */
function BibleCard() {
  const [data, setData] = useState<{ latest: { number: number; text: string } | null; updated: string; entries: number; chars: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/bible').then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, []);

  const copy = async (text: string, tag: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied(null), 2000);
  };
  const copyFull = async () => {
    const r = await fetch('/api/admin/bible?full=1');
    if (r.ok) copy((await r.json()).full, 'full');
  };

  if (!data?.latest) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Engineering Bible
        </h2>
        <span className="text-xs font-bold text-gray-400">{data.entries} entries · {(data.chars / 1024).toFixed(0)}K</span>
      </div>
      <p className="text-sm font-black text-gray-900 mb-1">Latest: §{data.latest.number}</p>
      <p className="text-xs text-gray-500 line-clamp-3 mb-4">{data.latest.text.replace(/\*\*/g, '').slice(0, 240)}…</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen(true)} className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700">
          View entry
        </button>
        <button onClick={() => copy(data.latest!.text, 'entry')} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
          {copied === 'entry' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copy §{data.latest.number}
        </button>
        <button onClick={copyFull} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
          {copied === 'full' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copy full bible
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-black text-gray-900">Bible §{data.latest.number}</h3>
              <div className="flex gap-2">
                <button onClick={() => copy(data.latest!.text, 'entry')} className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-purple-600 text-white inline-flex items-center gap-1.5">
                  {copied === 'entry' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
                </button>
                <button onClick={() => setOpen(false)} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700">Close</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap text-xs text-gray-700 font-sans leading-relaxed">{data.latest.text}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const drill = useDrill();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div className="text-gray-500">Failed to load stats.</div>;
  }

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', drill: { metric: 'users' } },
    { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-green-600 bg-green-50', drill: { metric: 'dau' } },
    { label: 'Pro Subscribers', value: stats.proSubscribers, icon: Crown, color: 'text-purple-600 bg-purple-50', drill: { metric: 'pro' } },
    { label: 'Games Today', value: stats.gamesToday, icon: Gamepad2, color: 'text-orange-600 bg-orange-50', drill: { metric: 'plays', day: new Date().toISOString().slice(0, 10) } },
    { label: 'Banned Users', value: stats.bannedUsers, icon: ShieldBan, color: 'text-red-600 bg-red-50', drill: { metric: 'banned' } },
  ];

  const sortedModes = Object.entries(stats.modePopularity).sort((a, b) => b[1] - a[1]);
  const maxModeGames = sortedModes.length > 0 ? sortedModes[0][1] : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, drill: dp }) => (
          <button
            type="button" key={label} onClick={() => drill(dp)}
            className="text-left bg-white rounded-xl border border-gray-200 p-4 transition hover:border-purple-300 hover:shadow-sm"
            title="Click for the rows behind this number"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mode Popularity */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">Game Mode Popularity</h2>
          {sortedModes.length === 0 ? (
            <p className="text-sm text-gray-400">No game data yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedModes.map(([mode, count]) => (
                <div key={mode}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-gray-700">{modeLabel(mode)}</span>
                    <span className="font-bold text-gray-500">{count.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(count / maxModeGames) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Engineering Bible — latest entry, copyable */}
        <BibleCard />

        {/* Recent Signups */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">Recent Signups</h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-gray-400">No signups yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentSignups.map(user => (
                <a
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-sm font-black text-purple-600">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {user.username}
                      {user.is_pro && <span className="ml-1.5 text-[10px] font-extrabold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">PRO</span>}
                    </p>
                    <p className="text-xs text-gray-400">
                      Lvl {user.level} · {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <UserPlus className="w-4 h-4 text-gray-300" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
