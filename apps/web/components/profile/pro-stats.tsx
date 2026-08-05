'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase-client';

interface ProStatsProps {
  userId: string;
  isPro: boolean;
}

const MODE_LABELS: Record<string, string> = {
  DUEL: 'Classic',
  MULTI_DUEL: 'Multi',
  GAUNTLET: 'Gauntlet',
  QUORDLE: 'Quad',
  OCTORDLE: 'Octo',
  SEQUENCE: 'Succ.',
  RESCUE: 'Deliv.',
  PROPERNOUNDLE: 'Proper',
  TOURNAMENT: 'Tourney',
  DUEL_6: 'Six',   // were falling through to the raw enum key ("DUEL_6"/"DUEL_7")
  DUEL_7: 'Seven',
};

function formatTime(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
        borderRadius: '10px',
        padding: '8px 12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <p className="text-xs font-black" style={{ color: 'var(--color-text)' }}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-[11px] font-bold" style={{ color: entry.color }}>
          {entry.name}: {entry.name.includes('Time') ? formatTime(entry.value) : `${entry.value}%`}
        </p>
      ))}
    </div>
  );
}

export function ProStats({ userId, isPro }: ProStatsProps) {
  const [modeStats, setModeStats] = useState<any[]>([]);

  useEffect(() => {
    if (!isPro) return;

    const fetchStats = async () => {
      const { data } = await (supabase as any)
        .from('user_stats')
        .select('game_mode, wins, losses, total_games, average_time, fastest_time')
        .eq('user_id', userId)
        .eq('play_type', 'solo');

      if (data) {
        setModeStats(data.map((s: any) => ({
          mode: MODE_LABELS[s.game_mode] || s.game_mode,
          winRate: s.total_games > 0 ? Math.round((s.wins / s.total_games) * 100) : 0,
          avgTime: s.average_time,
          games: s.total_games,
        })));
      }
    };

    fetchStats();
  }, [userId, isPro]);

  // Pro-only: free users see no card here — the blurred Skill Radar section
  // below it is the single Pro gate on the profile's global view (same
  // single-gate pattern as the mode-detail Deep Insights teaser; the old
  // locked card was redundant with it).
  if (!isPro) return null;

  if (modeStats.length === 0) return null;

  return (
    <>
      <div className="section-header mb-2">PRO STATS</div>
      <div className="space-y-3">
        {/* Win Rate Chart */}
        <div
          className="p-4"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
        >
          <h3 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>Win Rate by Mode</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="mode"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)' }} />
                <Bar dataKey="winRate" fill="#facc15" radius={[6, 6, 0, 0]} name="Win Rate" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Avg Solve Time Chart */}
        <div
          className="p-4"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
        >
          <h3 className="text-sm font-black mb-3" style={{ color: 'var(--color-text)' }}>Avg Solve Time by Mode</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeStats} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="mode"
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 700 }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (v === 0) return '0';
                    if (v < 60) return `${v}s`;
                    return `${Math.floor(v / 60)}m`;
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-hover)' }} />
                <Bar dataKey="avgTime" fill="#a78bfa" radius={[6, 6, 0, 0]} name="Avg Time" maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
