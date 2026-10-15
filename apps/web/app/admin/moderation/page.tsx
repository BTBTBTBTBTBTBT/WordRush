'use client';

import { useEffect, useState } from 'react';
import { ShieldBan, ShieldCheck, Users, History } from 'lucide-react';
import { PageHeader } from '../components/admin-ui';

// Preset ban reasons. Free text is the fallback; whatever is picked is stored
// as the profile's ban_reason and written to the admin audit log.
const BAN_REASONS = ['Inappropriate username', 'Harassment or abuse', 'Spam or advertising', 'Cheating', 'Underage'];

const BANNED_PAGE = 100;

export default function AdminModerationPage() {
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [bannedTotal, setBannedTotal] = useState(0);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // The row currently being banned, with its chosen preset and free text.
  const [banning, setBanning] = useState<{ id: string; preset: string; custom: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const get = async (url: string) => {
        const r = await fetch(url);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.error) throw new Error(j?.error ?? `Request failed (${r.status})`);
        return j;
      };
      const [recent, banned, audit] = await Promise.all([
        // Newest accounts (username review)
        get('/api/admin/users?limit=20'),
        // Every banned account, filtered on the server
        get(`/api/admin/users?banned=1&limit=${BANNED_PAGE}`),
        // Admin audit log
        get('/api/admin/audit-log?limit=30'),
      ]);
      setRecentUsers(recent.users || []);
      setBannedUsers(banned.users || []);
      setBannedTotal(banned.total ?? (banned.users || []).length);
      setAuditLog(audit.logs || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load moderation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const send = async (userId: string, ban: boolean, reason?: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ban, reason: ban ? reason : undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Request failed (${res.status})`);
      }
      setBanning(null);
      await load();
    } catch (e: any) {
      setActionError(`${ban ? 'Ban' : 'Unban'} failed: ${e?.message || 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmBan = (u: any) => {
    if (!banning) return;
    const reason = banning.custom.trim() || banning.preset;
    if (!reason) { setActionError('Pick a reason or type one before banning.'); return; }
    if (!window.confirm(`Ban ${u.username}?\n\nReason: ${reason}`)) return;
    send(u.id, true, reason);
  };

  const confirmUnban = (u: any) => {
    if (!window.confirm(`Unban ${u.username}?`)) return;
    send(u.id, false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Moderation" />
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Moderation" />
        <p className="text-sm font-bold text-red-500">Could not load moderation data: {error}</p>
        <button onClick={() => { setLoading(true); load(); }} className="text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Moderation" />
      {actionError && <p className="text-sm font-bold text-red-500">{actionError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Username Review */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4" /> New accounts
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="py-2 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-[10px] font-black text-purple-600">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <a href={`/admin/users/${u.id}`} className="text-sm font-bold text-gray-900 hover:text-purple-600">
                      {u.username}
                    </a>
                    {u.is_banned && <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">BANNED</span>}
                  </div>
                  {!u.is_banned && banning?.id !== u.id && (
                    <button
                      onClick={() => { setActionError(null); setBanning({ id: u.id, preset: '', custom: '' }); }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Ban
                    </button>
                  )}
                </div>
                {banning && banning.id === u.id && (
                  <div className="mt-2 ml-8 space-y-2">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Why ban {u.username}?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BAN_REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setBanning({ ...banning, preset: r })}
                          className={`text-[11px] font-bold px-2 py-1 rounded-full ${banning.preset === r ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text" value={banning.custom} maxLength={200}
                      onChange={(e) => setBanning({ ...banning, custom: e.target.value })}
                      placeholder="Or type your own reason"
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-purple-400"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        disabled={busy || !(banning.custom.trim() || banning.preset)}
                        onClick={() => confirmBan(u)}
                        className="text-[11px] font-extrabold text-white bg-red-500 hover:bg-red-600 disabled:opacity-40 px-3 py-1.5 rounded-lg"
                      >
                        {busy ? 'Banning…' : 'Ban user'}
                      </button>
                      <button onClick={() => setBanning(null)} className="text-[11px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Banned Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ShieldBan className="w-4 h-4 text-red-500" /> Banned Users ({bannedTotal})
          </h2>
          {bannedUsers.length === 0 ? (
            <p className="text-sm text-gray-400">No banned users.</p>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {bannedUsers.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div className="min-w-0">
                    <a href={`/admin/users/${u.id}`} className="text-sm font-bold text-gray-900 hover:text-purple-600">
                      {u.username}
                    </a>
                    {u.ban_reason && <p className="text-[11px] font-semibold text-gray-400 truncate">{u.ban_reason}</p>}
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => confirmUnban(u)}
                    className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50"
                  >
                    <ShieldCheck className="w-3 h-3" /> Unban
                  </button>
                </div>
              ))}
              {bannedTotal > bannedUsers.length && (
                <p className="text-[11px] font-semibold text-gray-400 pt-1">Showing the newest {bannedUsers.length} of {bannedTotal}.</p>
              )}
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
