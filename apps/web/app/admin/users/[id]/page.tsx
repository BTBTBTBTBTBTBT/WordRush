'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Crown, ShieldBan, ShieldCheck, Gamepad2, History } from 'lucide-react';

interface UserDetail {
  profile: any;
  stats: any[];
  recentMatches: any[];
  auditLog: any[];
}

const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic', QUORDLE: 'QuadWord', OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession', RESCUE: 'Deliverance', GAUNTLET: 'Gauntlet', PROPERNOUNDLE: 'ProperNoundle',
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Pro grant
  const [proDays, setProDays] = useState('30');

  // Ban
  const [banReason, setBanReason] = useState('');

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}`);
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const doAction = async (url: string, body: any) => {
    setActionLoading(true);
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await fetchUser();
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-gray-500">User not found.</div>;
  }

  const { profile: p, stats, recentMatches, auditLog } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/users')} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            {p.username}
            {p.is_pro && <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">PRO</span>}
            {p.is_banned && <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded">BANNED</span>}
            {p.role === 'admin' && <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">ADMIN</span>}
          </h1>
          <p className="text-xs text-gray-400 font-medium">ID: {p.id}</p>
        </div>
      </div>

      {/* Profile Overview */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Profile Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            ['Level', p.level],
            ['XP', p.xp.toLocaleString()],
            ['Shields', p.streak_shields],
            ['Wins', p.total_wins],
            ['Losses', p.total_losses],
            ['Current Streak', p.current_streak],
            ['Best Streak', p.best_streak],
            ['Gold Medals', p.gold_medals],
            ['Silver Medals', p.silver_medals],
            ['Bronze Medals', p.bronze_medals],
            ['Login Streak', p.daily_login_streak],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-gray-400 font-bold text-xs">{label}</p>
              <p className="text-gray-900 font-black text-lg">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500 font-medium">
          <div><span className="text-gray-400">Joined:</span> {new Date(p.created_at).toLocaleString()}</div>
          <div><span className="text-gray-400">Last Active:</span> {p.last_played_at ? new Date(p.last_played_at).toLocaleString() : 'Never'}</div>
          <div><span className="text-gray-400">Pro Expires:</span> {p.pro_expires_at ? new Date(p.pro_expires_at).toLocaleString() : 'N/A'}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pro Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" /> Pro Status
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number" value={proDays} onChange={e => setProDays(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Days"
              />
              <span className="text-xs text-gray-400 font-medium">days</span>
            </div>
            <button
              onClick={() => doAction(`/api/admin/users/${userId}/pro`, { grant: true, days: parseInt(proDays) })}
              disabled={actionLoading}
              className="w-full px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50"
            >
              {p.is_pro ? 'Extend Pro' : 'Grant Pro'}
            </button>
            {p.is_pro && (
              <button
                onClick={() => doAction(`/api/admin/users/${userId}/pro`, { grant: false })}
                disabled={actionLoading}
                className="w-full px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                Revoke Pro
              </button>
            )}
          </div>
        </div>

        {/* Ban Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            {p.is_banned ? <ShieldBan className="w-3.5 h-3.5 text-red-500" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            {p.is_banned ? 'User is Banned' : 'Ban User'}
          </h3>
          {p.is_banned ? (
            <div className="space-y-2">
              <p className="text-xs text-red-600 font-medium">Reason: {p.ban_reason || 'No reason given'}</p>
              <button
                onClick={() => doAction(`/api/admin/users/${userId}/ban`, { ban: false })}
                disabled={actionLoading}
                className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 disabled:opacity-50"
              >
                Unban User
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text" value={banReason} onChange={e => setBanReason(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Ban reason"
              />
              <button
                onClick={() => doAction(`/api/admin/users/${userId}/ban`, { ban: true, reason: banReason })}
                disabled={actionLoading || p.role === 'admin'}
                className="w-full px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Ban User
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats by Mode */}
      {stats.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Gamepad2 className="w-4 h-4" /> Stats by Mode
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Mode</th>
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Type</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500">Wins</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500">Losses</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500">Games</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500">Best</th>
                  <th className="text-right px-3 py-2 font-bold text-gray-500">Fastest</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-700">{MODE_LABELS[s.game_mode] || s.game_mode}</td>
                    <td className="px-3 py-2 text-gray-500">{s.play_type}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-bold">{s.wins}</td>
                    <td className="px-3 py-2 text-right text-red-500 font-bold">{s.losses}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{s.total_games}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{s.best_score}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{s.fastest_time > 0 ? `${(s.fastest_time / 1000).toFixed(1)}s` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Admin Audit Log */}
      {auditLog.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <History className="w-4 h-4" /> Admin Actions on This User
          </h2>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-50">
                <span className="font-semibold text-gray-700">{entry.action}</span>
                <span className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
