'use client';

import { Trophy, Target, Zap, Flame, TrendingUp, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { WIN_FG } from '@/lib/tile-theme';
import { KitCard, StatCell } from './stat-kit';

// Snapshot hero — merges the old Global Summary Row + "This Week" recap into
// ONE card: lifetime headline stats up top, the week strip underneath. Kills
// the double-summary stutter the page used to open with.

interface SnapshotHeroProps {
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  dailyStreak: number;
  bestDailyStreak: number;
  gamesThisWeek: number;
  level: number;
  xpToNext: number;
  isPro: boolean;
}

export function SnapshotHero({
  totalWins, totalLosses, currentStreak, bestStreak,
  dailyStreak, bestDailyStreak, gamesThisWeek, level, xpToNext, isPro,
}: SnapshotHeroProps) {
  const totalGames = totalWins + totalLosses;
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <KitCard>
      <div className="grid grid-cols-4 gap-y-3 gap-x-2">
        <StatCell icon={Trophy} label="Wins" value={totalWins} color={WIN_FG} />
        <StatCell icon={Target} label="Win Rate" value={`${winRate}%`} color="#2563eb" />
        <StatCell icon={Zap} label="Streak" value={currentStreak} sub={`Best: ${bestStreak}`} color="#7c3aed" />
        <StatCell icon={Flame} label="Daily" value={dailyStreak} sub={`Best: ${bestDailyStreak}`} color="#f97316" />
      </div>
      <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: '#7c3aed' }} />
          <span className="text-[10px] font-black uppercase tracking-wide shrink-0" style={{ color: '#6d28d9' }}>This Week</span>
          <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--color-text)' }}>
            {gamesThisWeek} {gamesThisWeek === 1 ? 'game' : 'games'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <TrendingUp className="w-3.5 h-3.5" style={{ color: '#2563eb' }} />
          <span className="text-[11px] font-extrabold" style={{ color: 'var(--color-text)' }}>
            {xpToNext} XP <span style={{ color: 'var(--color-text-muted)' }}>to Lvl {level + 1}</span>
          </span>
        </div>
      </div>
      {!isPro && (
        <Link href="/pro" className="flex items-center justify-between mt-2.5 pt-2.5 text-[11px] font-extrabold" style={{ borderTop: '1px solid var(--color-border)', color: '#7c3aed' }}>
          <span>Unlock your full insights with Pro</span>
          <span>→</span>
        </Link>
      )}
    </KitCard>
  );
}
