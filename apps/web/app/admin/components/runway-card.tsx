'use client';

import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { RunwayRow } from '@/lib/bank-runway';

const LEVEL: Record<RunwayRow['level'], { pill: string; label: string }> = {
  ok: { pill: 'text-green-700 bg-green-50', label: 'ok' },
  warn: { pill: 'text-amber-700 bg-amber-50', label: 'author more' },
  low: { pill: 'text-red-600 bg-red-50', label: 'low' },
  recycling: { pill: 'text-red-600 bg-red-50', label: 'recycling' },
};

/**
 * admin > Ops > Content runway (More Games §11; founder 2026-09-23). One row
 * per bundled daily bank: dailies shipped, days of unplayed puzzles left, and
 * the date the bank starts replaying from its first entry. Amber under 90
 * days (the nightly cron also flags it), red under 60 (CI is already failing).
 */
export function RunwayCard() {
  const [rows, setRows] = useState<RunwayRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/admin/content-runway')
      .then((r) => r.json())
      .then((d) => { setRows(d.banks ?? []); if (d.error) setErr(d.error); })
      .catch((e) => setErr(String(e)));
  }, []);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-black text-gray-400 uppercase tracking-wide flex items-center gap-2 mb-3">
        <CalendarClock className="w-3.5 h-3.5" /> Content runway
      </p>
      {rows === null && !err && <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />}
      {err && <p className="text-sm font-bold text-red-500">{err}</p>}
      {rows && (
        <div className="space-y-2">
          {rows.map((r) => {
            const pct = Math.max(0, Math.min(100, Math.round((r.daysLeft / r.dailies) * 100)));
            return (
              <div key={r.game} className="py-1 border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-sm font-black text-gray-900">{r.title}</span>
                    <span className="ml-2 text-xs font-bold text-gray-400">
                      {r.dailies} dailies · {r.extras} unlimited · {r.recycling ? `recycling since ${r.recyclesOn}` : `${r.daysLeft} days left · recycles ${r.recyclesOn}`}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${LEVEL[r.level].pill}`}>{LEVEL[r.level].label}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${r.level === 'ok' ? 'bg-green-400' : r.level === 'warn' ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] font-bold text-gray-300 mt-3">
        A bank never runs dry: past its last entry it replays from the first, oldest puzzle first. Author more before the recycle date to keep dailies fresh.
      </p>
    </div>
  );
}
