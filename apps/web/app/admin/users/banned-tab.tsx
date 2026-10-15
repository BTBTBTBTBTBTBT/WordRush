'use client';

import { useEffect, useState } from 'react';
import { ShieldBan, ShieldCheck } from 'lucide-react';
import { TabIntro, ReloadButton, Section, Empty, ErrorNote } from '../components/admin-ui';
import { useBanActions } from './ban-actions';

// Users & Moderation > Banned: every banned account (filtered on the server, so
// the total is true), with Unban behind a confirm.
const BANNED_PAGE = 100;

export default function BannedTab() {
  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [bannedTotal, setBannedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users?banned=1&limit=${BANNED_PAGE}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error ?? `Request failed (${r.status})`);
      setBannedUsers(j.users || []);
      setBannedTotal(j.total ?? (j.users || []).length);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load banned users.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const { busy, actionError, unban } = useBanActions(load);

  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={load} loading={loading} />}>
        Accounts that cannot play or sign in. Each shows the reason it was banned.
      </TabIntro>
      {error && <ErrorNote>Could not load banned users: {error}</ErrorNote>}
      {actionError && <p className="text-sm font-bold text-red-500">{actionError}</p>}
      {loading && bannedUsers.length === 0 && !error && <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />}
      {!error && !(loading && bannedUsers.length === 0) && (
        <Section title={`Banned users (${bannedTotal})`} icon={ShieldBan} className="max-w-3xl">
          {bannedUsers.length === 0 ? (
            <Empty>No banned users.</Empty>
          ) : (
            <div className="space-y-1.5 max-h-[32rem] overflow-y-auto">
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
                    onClick={() => unban(u)}
                    className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 disabled:opacity-40"
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
        </Section>
      )}
    </div>
  );
}
