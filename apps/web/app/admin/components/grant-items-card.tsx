'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import { AVATAR_ACCESS_TABLE } from '@wordle-duel/core';

/**
 * Admin user page, "Grant items" (FRIDAY-QUEUE 5b): give a player any mascot part so it saves without Pro, or take
 * one back. Search + category filter over the access table's keys, multi-select, one POST. The ledger
 * (owned_items) is written only by /api/admin/users/<id>/items; every change lands in owned_items_log + the audit log.
 */
interface OwnedRow { item_key: string; source: string; granted_by: string | null; acquired_at: string; revoked_at: string | null }

const ALL = Object.keys(AVATAR_ACCESS_TABLE.parts).sort();
const FIELDS = ['all', ...Array.from(new Set(ALL.map((k) => k.split(':')[0])))];
const pretty = (key: string) => key.split(':')[1].replace(/-/g, ' ');

export function GrantItemsCard({ userId }: { userId: string }) {
  const [owned, setOwned] = useState<OwnedRow[]>([]);
  const [q, setQ] = useState('');
  const [field, setField] = useState('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${userId}/items`);
    if (res.ok) setOwned((await res.json()).items ?? []);
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  const active = useMemo(() => new Set(owned.filter((r) => !r.revoked_at).map((r) => r.item_key)), [owned]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return ALL.filter((k) => (field === 'all' || k.startsWith(`${field}:`)) && (!t || k.toLowerCase().includes(t))).slice(0, 120);
  }, [q, field]);

  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const send = async (method: 'POST' | 'DELETE', keys: string[]) => {
    if (keys.length === 0) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/users/${userId}/items`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? (method === 'POST' ? `Granted ${json.granted?.length ?? 0}, already had ${json.alreadyHad?.length ?? 0}` : `Revoked ${json.revoked?.length ?? 0}`) : json.error ?? 'Failed');
    if (res.ok && method === 'POST') setPicked(new Set());
    await load();
    setBusy(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Gift className="w-3.5 h-3.5" /> Grant items
      </h3>
      <div className="flex gap-2 mb-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items (crown, goth, jersey…)" className="flex-1 min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium" />
        <select value={field} onChange={(e) => setField(e.target.value)} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold" aria-label="Category">
          {FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
        {shown.map((k) => (
          <label key={k} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={picked.has(k)} onChange={() => toggle(k)} />
            <span className="font-semibold text-gray-700 flex-1 truncate">{pretty(k)}</span>
            <span className="text-gray-400">{k.split(':')[0]}</span>
            {active.has(k) && <span className="text-green-600 font-extrabold">OWNED</span>}
          </label>
        ))}
        {shown.length === 0 && <p className="p-2 text-xs text-gray-400">No items match.</p>}
      </div>
      <button onClick={() => void send('POST', Array.from(picked))} disabled={busy || picked.size === 0}
        className="mt-2 w-full px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50">
        Grant {picked.size || ''} selected
      </button>
      {msg && <p className="mt-1.5 text-xs font-semibold text-gray-600">{msg}</p>}
      {active.size > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase mb-1">Owned ({active.size})</p>
          <div className="flex flex-wrap gap-1">
            {owned.filter((r) => !r.revoked_at).map((r) => (
              <button key={r.item_key} onClick={() => void send('DELETE', [r.item_key])} disabled={busy} title={`${r.source}: click to revoke`}
                className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold hover:bg-red-50 hover:text-red-600">
                {pretty(r.item_key)} ×
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
