'use client';

import { useEffect, useState } from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';

// Upcoming Word of the Day schedule. Server-derived from the exact module that
// renders the player-facing card and archive, so this table IS the future —
// not a simulation of it. Skips (blocklist / no dictionary definition) are
// shown inline so a surprising word choice is explainable at a glance.
interface WordsData {
  meta: {
    listLength: number;
    position: number;
    wrapInDays: number;
    wrapDate: string;
    cycleYears: number;
  };
  upcoming: {
    date: string;
    index: number;
    word: string;
    partOfSpeech: string;
    definition: string;
    skipped: { word: string; reason: string }[];
  }[];
}

const fmtDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
};

export default function AdminWordsPage() {
  const [data, setData] = useState<WordsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(45);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/words?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data?.meta) return <p className="text-sm text-gray-400">Failed to load the word schedule.</p>;

  const { meta } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Word of the Day</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm font-bold border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value={14}>Next 14 days</option>
          <option value={45}>Next 45 days</option>
          <option value={90}>Next 90 days</option>
          <option value={120}>Next 120 days</option>
        </select>
      </div>

      {/* Cycle mechanics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide">
            <BookOpen className="w-3.5 h-3.5" /> Word bank
          </div>
          <p className="text-2xl font-black text-gray-900 mt-1">{meta.listLength.toLocaleString()}</p>
          <p className="text-xs font-bold text-gray-400">curated answers in rotation</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">Cycle position</div>
          <p className="text-2xl font-black text-gray-900 mt-1">
            {meta.position.toLocaleString()}<span className="text-sm text-gray-400"> / {meta.listLength.toLocaleString()}</span>
          </p>
          <p className="text-xs font-bold text-gray-400">day of the current pass</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-wide">
            <RotateCcw className="w-3.5 h-3.5" /> Recycles on
          </div>
          <p className="text-2xl font-black text-gray-900 mt-1">{fmtDate(meta.wrapDate)}</p>
          <p className="text-xs font-bold text-gray-400">{meta.wrapInDays.toLocaleString()} days away</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-black text-gray-400 uppercase tracking-wide">Full cycle</div>
          <p className="text-2xl font-black text-gray-900 mt-1">~{meta.cycleYears} yrs</p>
          <p className="text-xs font-bold text-gray-400">then the list replays from word #1</p>
        </div>
      </div>

      <p className="text-xs font-bold text-gray-400 leading-relaxed">
        How the rotation works: each day indexes the word bank by days-since-epoch modulo the list
        length, so when the index reaches the end it wraps back to the first word and the list
        replays in the same order. The featured word walks forward from that index past any
        candidate that is on the taste blocklist or has no dictionary definition — skipped
        candidates are shown per-day below. Skipped words remain valid puzzle answers; they just
        never get featured.
      </p>

      {/* Upcoming table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Word</th>
              <th className="px-4 py-3 hidden md:table-cell">Definition</th>
              <th className="px-4 py-3">Skipped</th>
            </tr>
          </thead>
          <tbody>
            {data.upcoming.map((w, i) => (
              <tr key={w.date} className={`border-b border-gray-50 ${i === 0 ? 'bg-purple-50/50' : ''}`}>
                <td className="px-4 py-2.5 font-bold text-gray-500 whitespace-nowrap">
                  {fmtDate(w.date)}
                  {i === 0 && <span className="ml-2 text-[10px] font-black text-purple-600">TODAY</span>}
                </td>
                <td className="px-4 py-2.5 font-black text-gray-900">
                  {w.word}
                  {w.partOfSpeech && <span className="ml-2 text-[10px] font-bold italic text-purple-500">{w.partOfSpeech}</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell max-w-md truncate">{w.definition}</td>
                <td className="px-4 py-2.5">
                  {w.skipped.length === 0 ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {w.skipped.map((s) => (
                        <span
                          key={s.word}
                          title={s.reason}
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                            s.reason === 'blocklist' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {s.word}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
