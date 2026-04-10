'use client';

import { useEffect, useState } from 'react';
import { Users, Gamepad2, Crown, Activity, ShieldBan, UserPlus } from 'lucide-react';

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

const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic',
  QUORDLE: 'QuadWord',
  OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession',
  RESCUE: 'Deliverance',
  GAUNTLET: 'Gauntlet',
  PROPERNOUNDLE: 'ProperNoundle',
};

export default function AdminDashboard() {
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
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active Today', value: stats.activeToday, icon: Activity, color: 'text-green-600 bg-green-50' },
    { label: 'Pro Subscribers', value: stats.proSubscribers, icon: Crown, color: 'text-purple-600 bg-purple-50' },
    { label: 'Games Today', value: stats.gamesToday, icon: Gamepad2, color: 'text-orange-600 bg-orange-50' },
    { label: 'Banned Users', value: stats.bannedUsers, icon: ShieldBan, color: 'text-red-600 bg-red-50' },
  ];

  const sortedModes = Object.entries(stats.modePopularity).sort((a, b) => b[1] - a[1]);
  const maxModeGames = sortedModes.length > 0 ? sortedModes[0][1] : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-black text-gray-900">{value.toLocaleString()}</p>
          </div>
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
                    <span className="font-semibold text-gray-700">{MODE_LABELS[mode] || mode}</span>
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
