'use client';

import { useEffect, useState } from 'react';
import { ShieldBan, ShieldCheck, Users, History } from 'lucide-react';

export default function AdminModerationPage() {
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // Recently active users (potential username review)
      fetch('/api/admin/users?limit=20').then(r => r.json()),
      // Search for banned users
      fetch('/api/admin/users?q=&limit=100').then(r => r.json()),
      // Admin audit log
      fetch('/api/admin/audit-log?limit=30').then(r => r.json()),
    ]).then(([recent, all, audit]) => {
      setRecentUsers(recent.users || []);
      setBannedUsers((all.users || []).filter((u: any) => u.is_banned));
      setAuditLog(audit.logs || []);
      setLoading(false);
    });
  }, []);

  const handleBan = async (userId: string, ban: boolean) => {
    await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ban, reason: ban ? 'Inappropriate username' : undefined }),
    });
    // Refresh
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-gray-900">Moderation</h1>
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Moderation</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Username Review */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Recent Users (Username Review)
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-black text-purple-600">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <a href={`/admin/users/${u.id}`} className="text-sm font-bold text-gray-900 hover:text-purple-600">
                    {u.username}
                  </a>
                  {u.is_banned && <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">BANNED</span>}
                </div>
                {!u.is_banned && (
                  <button
                    onClick={() => handleBan(u.id, true)}
                    className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Ban
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Banned Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ShieldBan className="w-4 h-4 text-red-500" /> Banned Users ({bannedUsers.length})
          </h2>
          {bannedUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No banned users.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {bannedUsers.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <a href={`/admin/users/${u.id}`} className="text-sm font-bold text-gray-900 hover:text-purple-600">
                    {u.username}
                  </a>
                  <button
                    onClick={() => handleBan(u.id, false)}
                    className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50"
                  >
                    <ShieldCheck className="w-3 h-3" /> Unban
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Admin Audit Log */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <History className="w-4 h-4" /> Admin Activity Log
        </h2>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">No admin actions recorded yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {auditLog.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-50">
                <div>
                  <span className="font-bold text-gray-700">{entry.action}</span>
                  {entry.target_user_id && (
                    <a href={`/admin/users/${entry.target_user_id}`} className="ml-2 text-purple-600 hover:underline">
                      {entry.target_user_id.slice(0, 8)}...
                    </a>
                  )}
                  {entry.details && Object.keys(entry.details).length > 0 && (
                    <span className="ml-2 text-gray-400">{JSON.stringify(entry.details).slice(0, 60)}</span>
                  )}
                </div>
                <span className="text-gray-400 whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
