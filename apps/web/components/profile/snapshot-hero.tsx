'use client';

import { Icon3D } from '@/components/ui/icon3d';
import { CandyLink } from '@/components/ui/candy-button';
import { SoftNum } from '@/components/ui/soft-number';
import { KitCard, TintTile, CountUp } from './stat-kit';
import { STAT_LABELS } from '@/lib/stat-labels';
import { MedalArt } from '@/components/stats/medal-art';

// Snapshot hero — the All-time page's lifetime headline (docs/FINISH_SPEC.md
// C3 cont; mockup stats-friends-polish.html `.tiles4`): four tiles, each in its
// own color with a 3D icon and a soft number — purple Wins, green Win Rate,
// gold Win Streak, pink Daily Streak — then the this-week strip on a lavender
// card (and the Pro door as a candy pill for free players).

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
    <div className="space-y-2.5">
      {/* F4: marquee numbers count up on mount (instant under Reduce Motion). */}
      <div className="grid grid-cols-2 gap-2.5">
        <TintTile accent="#7c3aed" ink="#6d28d9" icon={<MedalArt medal="trophy" size={20} />} label="Wins" value={<CountUp target={totalWins} />} sub="all games" />
        <TintTile accent="#16a34a" ink="#137a3d" icon={<Icon3D name="badge-check" size={20} />} label="Win Rate" value={<CountUp target={winRate} suffix="%" />} sub={`${totalGames.toLocaleString()} ${totalGames === 1 ? 'game' : 'games'}`} />
        <TintTile accent="#f5a524" ink="#a2560c" icon={<Icon3D name="badge-w" size={20} />} label={STAT_LABELS.winStreak} value={<CountUp target={currentStreak} />} sub={`best ${bestStreak}`} />
        <TintTile accent="#ec4899" ink="#a0336b" icon={<Icon3D name="flame" size={20} />} label={STAT_LABELS.dailyStreak} value={<CountUp target={dailyStreak} />} sub={`best ${bestDailyStreak}`} />
      </div>
      <KitCard>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wide shrink-0 tint-ink" style={{ color: '#6d28d9' }}>This Week</span>
            <SoftNum size={17} className="soft-num-auto">{gamesThisWeek}</SoftNum>
            <span className="text-[11px] font-extrabold truncate" style={{ color: 'var(--color-text-muted)' }}>{gamesThisWeek === 1 ? 'game' : 'games'}</span>
          </div>
          <div className="flex items-baseline gap-1.5 shrink-0">
            <SoftNum size={17} className="soft-num-auto">{xpToNext}</SoftNum>
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>XP to Lvl {level + 1}</span>
          </div>
        </div>
        {!isPro && (
          <div className="flex items-center justify-between gap-2 mt-3 pt-3" style={{ borderTop: '1.5px dashed rgba(124, 58, 237, 0.25)' }}>
            <span className="text-[11px] font-extrabold" style={{ color: 'var(--color-text)' }}>Unlock your full insights with Pro</span>
            <CandyLink href="/pro" color="amber" size="sm" className="shrink-0">Go Pro</CandyLink>
          </div>
        )}
      </KitCard>
    </div>
  );
}
