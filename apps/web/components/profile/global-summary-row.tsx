'use client';

import { Trophy, Target, Flame, Zap } from 'lucide-react';

interface GlobalSummaryRowProps {
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  dailyStreak: number;
  bestDailyStreak: number;
}

export function GlobalSummaryRow({ totalWins, totalLosses, currentStreak, bestStreak, dailyStreak, bestDailyStreak }: GlobalSummaryRowProps) {
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const stats = [
    { icon: Trophy, label: 'Wins', value: totalWins, color: '#16a34a' },
    { icon: Target, label: 'Win Rate', value: `${winRate}%`, color: '#2563eb' },
    { icon: Zap, label: 'Streak', value: currentStreak, sub: `Best: ${bestStreak}`, color: '#7c3aed' },
    { icon: Flame, label: 'Daily', value: dailyStreak, sub: `Best: ${bestDailyStreak}`, color: '#f97316' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className="p-3 text-center"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}
          >
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: s.color }} />
            <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
            {s.sub && <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
