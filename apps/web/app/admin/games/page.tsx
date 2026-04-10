'use client';

import { useEffect, useState } from 'react';
import { Calendar, Trophy, Swords } from 'lucide-react';

const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic', QUORDLE: 'QuadWord', OCTORDLE: 'OctoWord',
  SEQUENCE: 'Succession', RESCUE: 'Deliverance', GAUNTLET: 'Gauntlet', PROPERNOUNDLE: 'ProperNoundle',
};
const MODES = Object.keys(MODE_LABELS);

export default function AdminGamesPage() {
  const today = new Date().toISOString().split('T')[0];
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState('DUEL');
  const [playType, setPlayType] = useState('solo');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [seeds, setSeeds] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/games/leaderboard?day=${day}&mode=${mode}&play_type=${playType}`).then(r => r.json()),
      fetch(`/api/admin/games/seeds?day=${day}`).then(r => r.json()),
      fetch('/api/admin/games/matches?limit=15').then(r => r.json()),
    ]).then(([lb, sd, mt]) => {
      setLeaderboard(lb.results || []);
      setSeeds(sd.seeds || []);
      setMatches(mt.matches || []);
      setLoading(false);
    });
  }, [day, mode, playType]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-gray-900">Games</h1>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input type="date" value={day} onChange={e => setDay(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium" />
        <select value={mode} onChange={e => setMode(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium">
          {MODES.map(m => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
        <select value={playType} onChange={e => setPlayType(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium">
          <option value="solo">Solo</option>
          <option value="vs">VS</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Daily Leaderboard — {MODE_LABELS[mode]} ({playType})
          </h2>
          {loading ? (
            <div className="h-40 bg-gray-100 rounded animate-pulse" />
          ) : leaderboard.length === 0 ? (
            <p className="text-sm text-gray-400">No results for this day/mode.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {leaderboard.map((r: any, i: number) => (
                <div key={r.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-gray-50">
                  <span className="w-6 text-right font-bold text-gray-400">#{i + 1}</span>
                  <a href={`/admin/users/${r.user_id}`} className="font-bold text-gray-900 hover:text-purple-600">
                    {(r.profiles as any)?.username || r.user_id.slice(0, 8)}
                  </a>
                  <span className="ml-auto text-gray-500">
                    {r.composite_score.toFixed(0)} pts · {r.guess_count} guesses · {r.time_seconds}s
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Seeds */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Seeds for {day}
          </h2>
          {seeds.length === 0 ? (
            <p className="text-sm text-gray-400">No seeds generated for this day.</p>
          ) : (
            <div className="space-y-2">
              {seeds.map((s: any) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-50">
                  <span className="font-bold text-gray-700">{MODE_LABELS[s.game_mode] || s.game_mode}</span>
                  <span className="font-mono text-gray-500 text-[10px]">{s.seed.slice(0, 30)}</span>
                  <span className="font-bold text-gray-900">
                    {Array.isArray(s.solutions) ? s.solutions.join(', ') : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent VS Matches */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Swords className="w-4 h-4" /> Recent VS Matches
        </h2>
        {matches.length === 0 ? (
          <p className="text-sm text-gray-400">No matches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Mode</th>
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Player 1</th>
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Player 2</th>
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Winner</th>
                  <th className="text-left px-3 py-2 font-bold text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m: any) => (
                  <tr key={m.id} className="border-b border-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-700">{MODE_LABELS[m.game_mode] || m.game_mode}</td>
                    <td className="px-3 py-2">
                      <a href={`/admin/users/${m.player1_id}`} className="text-purple-600 hover:underline">{m.player1_id.slice(0, 8)}...</a>
                    </td>
                    <td className="px-3 py-2">
                      {m.player2_id ? (
                        <a href={`/admin/users/${m.player2_id}`} className="text-purple-600 hover:underline">{m.player2_id.slice(0, 8)}...</a>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 font-bold">
                      {m.winner_id ? <span className="text-green-600">{m.winner_id.slice(0, 8)}...</span> : <span className="text-gray-400">Draw</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-400">{new Date(m.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
