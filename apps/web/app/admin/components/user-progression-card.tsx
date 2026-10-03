'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy, Smile, HeartHandshake } from 'lucide-react';
import { levelTier, levelTierLabel } from '@wordle-duel/core';

/**
 * A player's progression + social context on their admin page: level tier,
 * friends, saved mascot, unlocked achievements, and a one-achievement grant
 * (POST /api/admin/users/[id]/achievements: the existing server grant path,
 * audit-logged; hidden keys aren't offered). No revoke by design. The catalog
 * comes from the public /api/achievements (the same list the apps read), so
 * this page doesn't bundle the client achievement service.
 */
interface CatalogEntry { key: string; name: string; category: string; hidden?: boolean }
export function UserProgressionCard({ userId, profile, achievements, friendCount, onChanged }: {
  userId: string;
  profile: { level?: number | null; avatar_config?: Record<string, unknown> | null; avatar_url?: string | null; avatar_frame?: string | null; avatar_cast_id?: string | null };
  achievements: Array<{ achievement_key: string; unlocked_at: string }>;
  friendCount: number | null;
  onChanged: () => void;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);

  useEffect(() => {
    fetch('/api/achievements')
      .then((r) => r.json())
      .then((d) => setCatalog(((d?.achievements ?? []) as CatalogEntry[]).filter((a) => !a.hidden)))
      .catch(() => setCatalog([]));
  }, []);

  const nameOf = useMemo(() => new Map(catalog.map((a) => [a.key, a.name])), [catalog]);
  const have = useMemo(() => new Set(achievements.map((a) => a.achievement_key)), [achievements]);
  const grantable = useMemo(() => catalog.filter((a) => !have.has(a.key)), [catalog, have]);
  const list = showAll ? achievements : achievements.slice(0, 12);

  const cfg = profile.avatar_config ?? null;
  const tier = levelTierLabel(levelTier(profile.level ?? 1));

  const grant = async () => {
    if (!key) return;
    const label = nameOf.get(key) ?? key;
    if (!window.confirm(`Grant "${label}" to this player? It is written to the audit log and can't be revoked here.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/users/${userId}/achievements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) setMsg(d.error ?? 'Grant failed');
      else {
        setMsg(d.alreadyHad ? 'They already had it.' : `Granted ${label}.`);
        setKey('');
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Trophy className="w-4 h-4" /> Progression &amp; Social
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-400 font-bold text-xs">Level tier</p>
          <p className="text-gray-900 font-black text-lg">{tier}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold text-xs flex items-center gap-1"><HeartHandshake className="w-3 h-3" /> Friends</p>
          <p className="text-gray-900 font-black text-lg">{friendCount ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 font-bold text-xs">Achievements</p>
          <p className="text-gray-900 font-black text-lg">{achievements.length} <span className="text-xs text-gray-400 font-bold">/ {catalog.length || '…'}</span></p>
        </div>
        <div>
          <p className="text-gray-400 font-bold text-xs flex items-center gap-1"><Smile className="w-3 h-3" /> Mascot</p>
          <p className="text-gray-900 font-bold text-xs mt-1">
            {cfg
              ? `${String(cfg.body ?? '?')} · ${String(cfg.head ?? 'none')} hat · ${String(cfg.bg ?? 'auto')} backdrop · shows ${String(cfg.display ?? (profile.avatar_url ? 'photo' : 'mascot'))}`
              : profile.avatar_cast_id ? `Cast pick: ${profile.avatar_cast_id.toUpperCase()}` : 'Default (never saved)'}
            {profile.avatar_frame ? ` · ${profile.avatar_frame} frame` : ''}
          </p>
        </div>
      </div>

      {achievements.length === 0 ? (
        <p className="text-xs text-gray-400">No achievements yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((a) => (
            <span key={a.achievement_key} title={new Date(a.unlocked_at).toLocaleString()} className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {nameOf.get(a.achievement_key) ?? a.achievement_key}
            </span>
          ))}
          {achievements.length > 12 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-[11px] font-black text-gray-500 hover:text-gray-800 px-2">
              {showAll ? 'Show fewer' : `+${achievements.length - 12} more`}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
        <select value={key} onChange={(e) => setKey(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-md px-2 py-1.5 bg-white max-w-xs">
          <option value="">Grant an achievement…</option>
          {grantable.map((a) => <option key={a.key} value={a.key}>{a.name} ({a.category})</option>)}
        </select>
        <button
          onClick={grant}
          disabled={!key || busy}
          className="text-xs font-extrabold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40"
        >
          {busy ? 'Granting…' : 'Grant'}
        </button>
        {msg && <span className="text-xs font-bold text-gray-500">{msg}</span>}
      </div>
    </div>
  );
}
