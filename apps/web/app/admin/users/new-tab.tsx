'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { TabIntro, ReloadButton, Section, ErrorNote } from '../components/admin-ui';
import { BAN_REASONS, useBanActions } from './ban-actions';

// Users & Moderation > New: the 20 newest accounts with a Ban button (a quick
// pass over fresh usernames). Banned accounts are the Banned tab.
export default function NewTab() {
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The row currently being banned, with its chosen preset and free text.
  const [banning, setBanning] = useState<{ id: string; preset: string; custom: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/users?limit=20');
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.error) throw new Error(j?.error ?? `Request failed (${r.status})`);
      setRecentUsers(j.users || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load new accounts.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const { busy, actionError, setActionError, send } = useBanActions(async () => { setBanning(null); await load(); });

  const confirmBan = (u: any) => {
    if (!banning) return;
    const reason = banning.custom.trim() || banning.preset;
    if (!reason) { setActionError('Pick a reason or type one before banning.'); return; }
    if (!window.confirm(`Ban ${u.username}?\n\nReason: ${reason}`)) return;
    void send(u.id, true, reason);
  };

  return (
    <div className="space-y-6">
      <TabIntro actions={<ReloadButton onClick={load} loading={loading} />}>
        The newest accounts, newest first. Open one to see their profile, or ban an inappropriate username right here.
      </TabIntro>
      {error && <ErrorNote>Could not load new accounts: {error}</ErrorNote>}
      {actionError && <p className="text-sm font-bold text-red-500">{actionError}</p>}
      {loading && recentUsers.length === 0 && !error && <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />}
      {(recentUsers.length > 0 || (!loading && !error)) && (
        <Section title="New accounts" icon={Users} className="max-w-3xl">
          <div className="space-y-1.5 max-h-[32rem] overflow-y-auto">
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
        </Section>
      )}
    </div>
  );
}
