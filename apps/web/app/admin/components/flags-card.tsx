'use client';

import { useEffect, useState } from 'react';
import { ToggleLeft } from 'lucide-react';
import type { AppFlag } from '@/lib/flags';
import { MODES } from '@/lib/modes.generated';

interface FlagRow extends AppFlag { note: string | null; updated_at: string }

/**
 * admin > Ops > Feature flags (More Games §7 + §10). One row per app_flags
 * key: the enabled switch (off = kill switch, everyone) and the audience
 * (testers = the TestFlight / Play-internal gate; all = public launch — no
 * rebuild). The catalog column shows whether this deploy even compiles the
 * mode in; a flag cannot show a game the build does not carry.
 */
export function FlagsCard() {
  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    fetch('/api/admin/flags')
      .then((r) => r.json())
      .then((d) => { setFlags(d.flags ?? []); if (d.error) setErr(d.error); })
      .catch((e) => setErr(String(e)));
  useEffect(() => { load(); }, []);

  const save = async (key: string, patch: Partial<Pick<AppFlag, 'enabled' | 'audience'>>) => {
    setBusy(key); setErr(null);
    try {
      const r = await fetch('/api/admin/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, ...patch }),
      });
      const d = await r.json();
      if (d.error) setErr(d.error);
      await load();
    } finally { setBusy(null); }
  };

  const catalogFor = (key: string) => MODES.find((m) => m.flagKey === key);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-2 mb-3">
        <ToggleLeft className="w-3.5 h-3.5" /> Feature flags
      </p>
      {flags === null && <div className="h-20 bg-gray-100 rounded-lg animate-pulse" />}
      {flags && flags.length === 0 && (
        <p className="text-sm font-bold text-gray-400">No flags yet — apply supabase/manual-migrations/20260922000003_app_flags.sql (Stage 8).</p>
      )}
      {flags && flags.length > 0 && (
        <div className="space-y-2">
          {flags.map((f) => {
            const cat = catalogFor(f.key);
            return (
              <div key={f.key} className="flex items-center justify-between gap-3 py-1 border-b border-gray-100 last:border-0">
                <div className="min-w-0">
                  <span className="text-sm font-black text-gray-900">{f.key}</span>
                  {f.note && <span className="ml-2 text-xs font-bold text-gray-400">{f.note}</span>}
                  <div className="text-[10px] font-bold text-gray-300">
                    catalog: {cat ? (cat.enabled ? 'compiled in' : 'not compiled in this deploy') : 'no catalog record'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    className="text-xs font-bold border border-gray-200 rounded-md px-2 py-1 bg-white"
                    value={f.audience}
                    disabled={busy === f.key}
                    onChange={(e) => save(f.key, { audience: e.target.value })}
                  >
                    <option value="testers">testers</option>
                    <option value="all">all (public)</option>
                  </select>
                  <button
                    onClick={() => save(f.key, { enabled: !f.enabled })}
                    disabled={busy === f.key}
                    className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${f.enabled ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}
                  >
                    {f.enabled ? 'enabled' : 'off'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {err && <p className="text-xs font-bold text-red-600 mt-2">{err}</p>}
      <p className="text-[11px] font-bold text-gray-300 mt-3">
        Off hides a game for everyone within a minute. Testers = admin and tester accounts only. All = public launch, no rebuild.
      </p>
    </div>
  );
}
