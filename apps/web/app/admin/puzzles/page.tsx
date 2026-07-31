'use client';

import { useEffect, useState } from 'react';
import { Puzzle, Flame, Shield } from 'lucide-react';
import { DrillCard, useDrill } from '../components/drill-panel';
import { modeLabel } from '@/lib/mode-labels';

// Puzzle analytics — which dailies were brutal, which modes get played, and
// whether the streak/shield economy is actually being used.
interface PuzzlesData {
  days: number;
  difficulty: { day: string; mode: string; plays: number; winRate: number; avgGuesses: number; boardRate: number }[];
  popularity: { mode: string; plays: number; vsPlays: number; winRate: number }[];
  streakEconomy: {
    distribution: { label: string; count: number }[];
    longestActive: number;
    bestEver: number;
    shieldsHeld: number;
    shieldHolders: number;
    proHolders: number;
  };
}

const fmtDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const winColor = (r: number) => (r < 40 ? 'text-red-500' : r < 65 ? 'text-amber-600' : 'text-green-600');

export default function AdminPuzzlesPage() {
  const drill = useDrill();
  const [data, setData] = useState<PuzzlesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(14);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/puzzles?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="h-60 bg-gray-100 rounded-xl animate-pulse" />;
  if (!data?.popularity) return <p className="text-sm text-gray-400">Failed to load puzzle analytics.</p>;

  const se = data.streakEconomy;
  // Group difficulty rows by day for a scannable table.
  const dayGroups = new Map<string, typeof data.difficulty>();
  for (const row of data.difficulty) {
    if (!dayGroups.has(row.day)) dayGroups.set(row.day, []);
    dayGroups.get(row.day)!.push(row);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Puzzles</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm font-bold border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
      </div>

      {/* Mode popularity */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 pt-4 flex items-center gap-2">
          <Puzzle className="w-3.5 h-3.5" /> Mode popularity
        </p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Solo plays</th>
              <th className="px-4 py-2">VS plays</th>
              <th className="px-4 py-2">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {data.popularity.map((m) => (
              <tr key={m.mode} onClick={() => drill({ metric: 'plays', key: m.mode })}
                  className="border-b border-gray-50 cursor-pointer hover:bg-gray-50" title="Click for every play of this mode">
                <td className="px-4 py-2 font-black text-gray-900">{modeLabel(m.mode)}</td>
                <td className="px-4 py-2 font-bold text-gray-700">{m.plays}</td>
                <td className="px-4 py-2 font-bold text-gray-500">{m.vsPlays}</td>
                <td className={`px-4 py-2 font-black ${winColor(m.winRate)}`}>{m.winRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Streak & shield economy */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DrillCard
          label="Longest active" icon={<Flame className="w-3.5 h-3.5" />}
          value={`${se.longestActive} days`} sub={`best ever: ${se.bestEver}`}
          drill={{ metric: 'streaks' }}
        />
        <DrillCard
          label="Shields held" icon={<Shield className="w-3.5 h-3.5" />}
          value={se.shieldsHeld} sub={`across ${se.shieldHolders} players (${se.proHolders} Pro)`}
          drill={{ metric: 'shields' }}
        />
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide mb-2">Streak distribution</p>
          <div className="flex gap-2">
            {se.distribution.map((b) => (
              <button
                type="button" key={b.label}
                onClick={() => drill({ metric: 'streaks', key: b.label })}
                className="flex-1 text-center rounded hover:bg-gray-50 py-1"
                title="Click for the players in this bucket"
              >
                <p className="text-lg font-black text-gray-900">{b.count}</p>
                <p className="text-[10px] font-bold text-gray-400">{b.label}d</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Daily difficulty */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <p className="text-xs font-black text-gray-400 uppercase tracking-wide px-4 pt-4">
          Daily difficulty — win rate under 40% is red (a brutal word), over 65% green
        </p>
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="text-left text-xs font-black text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Plays</th>
              <th className="px-4 py-2">Win rate</th>
              <th className="px-4 py-2 hidden md:table-cell">Avg guesses</th>
              <th className="px-4 py-2 hidden md:table-cell">Boards solved</th>
            </tr>
          </thead>
          <tbody>
            {[...dayGroups.entries()].map(([day, rows]) =>
              rows.map((r, i) => (
                <tr key={`${day}-${r.mode}`} onClick={() => drill({ metric: 'plays', day, key: r.mode })}
                    className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${i === 0 ? 'border-t border-gray-100' : ''}`}
                    title="Click for the individual results behind this row">
                  <td className="px-4 py-2 font-bold text-gray-500 whitespace-nowrap">{i === 0 ? fmtDay(day) : ''}</td>
                  <td className="px-4 py-2 font-black text-gray-900">{modeLabel(r.mode)}</td>
                  <td className="px-4 py-2 font-bold text-gray-700">{r.plays}</td>
                  <td className={`px-4 py-2 font-black ${winColor(r.winRate)}`}>{r.winRate}%</td>
                  <td className="px-4 py-2 font-bold text-gray-500 hidden md:table-cell">{r.avgGuesses || '—'}</td>
                  <td className="px-4 py-2 font-bold text-gray-500 hidden md:table-cell">{r.boardRate}%</td>
                </tr>
              )),
            )}
            {data.difficulty.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-300 font-bold">No plays in this window</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
