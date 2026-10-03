'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { RefreshCw } from 'lucide-react';

/**
 * Shared building blocks for the admin pages, in the portal's existing look
 * (white cards on gray-50, gray-200 borders, small uppercase section labels,
 * purple accents). The older pages keep their inline markup; the newer pages
 * use these so they stay consistent.
 */

/** Fetch an admin API route as JSON with loading / error state and a reload. */
export function useAdminData<T>(url: string | null): { data: T | null; error: string | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!live) return;
        if (!r.ok || j?.error) setError(j?.error ?? `Request failed (${r.status})`);
        else setData(j as T);
      })
      .catch((e) => live && setError(String(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [url, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

/** A count for display: null (not tracked / not applied) → "—". */
export const fmt = (n: number | null | undefined): string => (n == null ? '—' : n.toLocaleString());

export function PageHeader({ title, subtitle, icon: Icon, actions }: { title: string; subtitle?: React.ReactNode; icon?: LucideIcon; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          {Icon && <Icon className="w-6 h-6 text-purple-600 shrink-0" />}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-gray-500 font-medium mt-1 max-w-3xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ReloadButton({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
    </button>
  );
}

export function Section({ title, icon: Icon, note, right, children, className = '' }: {
  title: string; icon?: LucideIcon; note?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          {Icon && <Icon className="w-4 h-4" />} {title}
        </h2>
        {right}
      </div>
      {children}
      {note && <p className="text-[11px] font-semibold text-gray-400 mt-3">{note}</p>}
    </section>
  );
}

/** A plain (non-drill) stat tile; use DrillCard when the number has rows behind it. */
export function Stat({ label, value, sub, icon: Icon, tone = 'text-purple-600 bg-purple-50' }: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon; tone?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icon && (
          <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
            <Icon className="w-4 h-4" />
          </span>
        )}
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs font-semibold text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/** A stat tile that navigates to another admin page. */
export function LinkStat({ href, label, value, sub, icon }: { href: string; label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link href={href} className="block bg-white border border-gray-200 rounded-xl p-4 transition hover:border-purple-300 hover:shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide">{icon}{label}</div>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs font-bold text-gray-400">{sub}</p>}
    </Link>
  );
}

/** Horizontal bars: label, count, share of the max. Rows can be clickable. */
export function BarList({ rows, empty = 'No data yet.', onPick }: {
  rows: Array<{ label: string; count: number | null; hint?: string }>;
  empty?: string;
  onPick?: (label: string) => void;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  const max = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex justify-between text-sm mb-1 gap-2">
              <span className="font-semibold text-gray-700 truncate">{r.label}{r.hint && <span className="ml-1.5 text-xs text-gray-400">{r.hint}</span>}</span>
              <span className="font-bold text-gray-500 tabular-nums">{fmt(r.count)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${((r.count ?? 0) / max) * 100}%` }} />
            </div>
          </>
        );
        return onPick ? (
          <button key={r.label} type="button" onClick={() => onPick(r.label)} className="block w-full text-left rounded-md hover:bg-gray-50 -mx-1 px-1">
            {inner}
          </button>
        ) : (
          <div key={r.label}>{inner}</div>
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-gray-400">{children}</p>;
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{children}</div>;
}

export function Callout({ children, tone = 'gray' }: { children: React.ReactNode; tone?: 'gray' | 'amber' | 'purple' }) {
  const cls = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-800' : tone === 'purple' ? 'border-purple-200 bg-purple-50 text-purple-800' : 'border-gray-200 bg-white text-gray-600';
  return <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${cls}`}>{children}</div>;
}

export function LoadingGrid({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: tiles }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
          <div className="h-8 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

/** A simple table: columns are [key, label, align?]. */
export function Table<R extends Record<string, unknown>>({ columns, rows, empty = 'Nothing yet.', rowKey }: {
  columns: Array<{ key: keyof R & string; label: string; align?: 'left' | 'right'; render?: (r: R) => React.ReactNode }>;
  rows: R[];
  empty?: string;
  rowKey?: (r: R, i: number) => string;
}) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
            {columns.map((c) => (
              <th key={c.key} className={`px-2 py-2 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
              {columns.map((c, ci) => (
                <td key={c.key} className={`px-2 py-2 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${ci === 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-600'}`}>
                  {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "3h ago" / "2d ago" for recent timestamps; full date beyond a week. */
export function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d <= 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
