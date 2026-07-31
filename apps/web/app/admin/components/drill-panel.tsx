'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';

/**
 * Portal-wide drill-down. Any number on any admin page can open the rows
 * behind it: pages call `useDrill()(params)` and this panel fetches
 * /api/admin/drill, which returns a uniform { title, subtitle, columns, rows }
 * so one component renders every metric. Rows carrying a `userId` link to
 * that player's admin page.
 */
export interface DrillParams {
  metric: string;
  day?: string;
  key?: string;
  by?: string;
}

interface DrillData {
  title: string;
  subtitle: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  error?: string;
}

const DrillContext = createContext<(p: DrillParams) => void>(() => {});

/** Open the drill panel for a metric. */
export const useDrill = () => useContext(DrillContext);

export function DrillProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<DrillParams | null>(null);
  const [data, setData] = useState<DrillData | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback((p: DrillParams) => setParams(p), []);
  const close = useCallback(() => { setParams(null); setData(null); }, []);

  useEffect(() => {
    if (!params) return;
    setLoading(true);
    setData(null);
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null) as [string, string][],
    );
    fetch(`/api/admin/drill?${qs}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setData({ title: 'Error', subtitle: '', columns: [], rows: [], error: 'Failed to load' }); setLoading(false); });
  }, [params]);

  useEffect(() => {
    if (!params) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [params, close]);

  const exportCsv = () => {
    if (!data?.rows.length) return;
    const head = data.columns.map((c) => c.label).join(',');
    const body = data.rows
      .map((r) => data.columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`${head}\n${body}`], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DrillContext.Provider value={open}>
      {children}
      {params && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={close}>
          <div
            className="h-full w-full max-w-4xl bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">{loading ? 'Loading…' : data?.title ?? ''}</h2>
                <p className="text-xs font-bold text-gray-400">{data?.subtitle ?? ''}</p>
              </div>
              <div className="flex items-center gap-3">
                {!!data?.rows?.length && (
                  <button onClick={exportCsv} className="text-xs font-black text-purple-600 hover:text-purple-800 uppercase tracking-wide">
                    Export CSV
                  </button>
                )}
                <button onClick={close} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {loading && <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />}
              {!loading && data?.error && <p className="text-sm font-bold text-red-500">{data.error}</p>}
              {!loading && data && !data.error && data.rows.length === 0 && (
                <p className="text-sm font-bold text-gray-300">No rows behind this number.</p>
              )}
              {!loading && data && !data.error && data.rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
                        {data.columns.map((c) => <th key={c.key} className="px-3 py-2 whitespace-nowrap">{c.label}</th>)}
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          {data.columns.map((c, ci) => (
                            <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${ci === 0 ? 'font-black text-gray-900' : 'font-bold text-gray-600'}`}>
                              {String(r[c.key] ?? '—')}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {typeof r.userId === 'string' && (
                              <Link href={`/admin/users/${r.userId}`} className="text-purple-400 hover:text-purple-600 inline-flex" aria-label="Open player">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DrillContext.Provider>
  );
}

/** A stat card that opens its own drill-down when clicked. */
export function DrillCard({
  label, value, sub, icon, drill, className = '',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  drill?: DrillParams;
  className?: string;
}) {
  const open = useDrill();
  const clickable = !!drill;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => drill && open(drill)}
      className={`text-left bg-white border border-gray-200 rounded-xl p-4 w-full transition ${
        clickable ? 'hover:border-purple-300 hover:shadow-sm cursor-pointer' : 'cursor-default'
      } ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide">
        {icon}{label}
      </div>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs font-bold text-gray-400">{sub}</p>}
    </button>
  );
}
