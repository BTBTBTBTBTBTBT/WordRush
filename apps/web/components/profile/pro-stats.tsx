'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Lock, Crown } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';

interface ProStatsProps {
  userId: string;
  isPro: boolean;
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
          mode: s.game_mode,
          winRate: s.total_games > 0 ? Math.round((s.wins / s.total_games) * 100) : 0,
          avgTime: s.average_time,
          games: s.total_games,
        })));
      }
    };

    fetchStats();
  }, [userId, isPro]);

  if (!isPro) {
    return (
      <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
          <Lock className="w-8 h-8 text-white/40 mb-2" />
          <p className="text-white/60 text-sm font-medium mb-3">Pro Feature</p>
          <Link href="/pro">
            <button className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full px-4 py-2 text-white text-xs font-bold hover:from-yellow-500 hover:to-orange-600 transition-colors">
              <Crown className="w-3.5 h-3.5" />
              Upgrade to Pro
            </button>
          </Link>
        </div>

        {/* Blurred preview */}
        <h3 className="text-lg font-bold text-white mb-4">Extended Stats</h3>
        <div className="h-48 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4">Win Rate by Mode</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modeStats}>
              <XAxis dataKey="mode" tick={{ fill: '#fff', fontSize: 11 }} />
              <YAxis tick={{ fill: '#fff', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="winRate" fill="#facc15" radius={[4, 4, 0, 0]} name="Win %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4">Avg Solve Time by Mode</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modeStats}>
              <XAxis dataKey="mode" tick={{ fill: '#fff', fontSize: 11 }} />
              <YAxis tick={{ fill: '#fff', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="avgTime" fill="#a78bfa" radius={[4, 4, 0, 0]} name="Avg Time (s)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
