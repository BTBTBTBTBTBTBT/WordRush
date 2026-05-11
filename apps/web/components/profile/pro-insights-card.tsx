'use client';

import { Lock, Crown } from 'lucide-react';
import Link from 'next/link';
import { PersonalBests } from './personal-bests';
import { TimeOfDayHeatmap } from './time-of-day-heatmap';
import { ConsistencyGauge } from './consistency-gauge';
import { HeadToHeadCard } from './head-to-head-card';

interface ProInsightsCardProps {
  isPro: boolean;
  accentColor: string;
  showVs: boolean;
  personalBests: { fastestWin: { time: number; date: string } | null; fewestGuesses: { count: number; date: string } | null } | null;
  winStreak: { current: number; best: number } | null;
  timeOfDay: Array<{ hour: number; gamesPlayed: number; gamesWon: number }> | null;
  consistency: { score: number; sampleSize: number } | null;
  improvement: { recentAvg: number; overallAvg: number; percentChange: number; improving: boolean } | null;
  perfectGames: number;
  headToHead: { wins: number; losses: number; total: number; winRate: number } | null;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ProInsightsCard({
  isPro, accentColor, showVs,
  personalBests, winStreak, timeOfDay, consistency, improvement, perfectGames, headToHead,
}: ProInsightsCardProps) {
  const hasData = personalBests || timeOfDay || consistency || improvement || headToHead;

  return (
    <div
      className="relative overflow-hidden"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      {/* Pro lock overlay */}
      {!isPro && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{ background: 'rgba(248, 247, 255, 0.85)', backdropFilter: 'blur(4px)' }}
        >
          <Lock className="w-6 h-6 mb-2" style={{ color: '#c4b5fd' }} />
          <p className="text-[10px] font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Deep Insights</p>
          <Link href="/pro">
            <button
              className="btn-3d flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 0 #92400e' }}
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade to Pro
            </button>
          </Link>
        </div>
      )}

      <div className="p-4 space-y-4">
        <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: accentColor }}>
          Pro Insights
        </div>

        {/* Personal Bests */}
        {personalBests && (
          <PersonalBests
            fastestWin={personalBests.fastestWin}
            fewestGuesses={personalBests.fewestGuesses}
            bestStreak={winStreak?.best || 0}
            accentColor={accentColor}
          />
        )}

        {/* Improvement Trend */}
        {improvement && improvement.overallAvg > 0 && (
          <div className="flex items-center gap-3 px-3 py-2" style={{ background: `${accentColor}08`, borderRadius: '10px' }}>
            <span className="text-xl">{improvement.improving ? '📈' : '📉'}</span>
            <div>
              <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>
                {improvement.improving ? 'Improving' : 'Slowing down'}
                <span className="ml-1" style={{ color: improvement.improving ? '#16a34a' : '#dc2626' }}>
                  {improvement.percentChange > 0 ? '+' : ''}{improvement.percentChange}%
                </span>
              </div>
              <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                Recent avg {formatTime(improvement.recentAvg)} vs overall {formatTime(improvement.overallAvg)}
              </div>
            </div>
          </div>
        )}

        {/* Perfect Games + Mode Streak */}
        {(perfectGames > 0 || (winStreak && winStreak.current > 0)) && (
          <div className="flex gap-3">
            {perfectGames > 0 && (
              <div className="flex-1 text-center p-2" style={{ background: `${accentColor}08`, borderRadius: '10px' }}>
                <div className="text-lg font-black" style={{ color: accentColor }}>{perfectGames}</div>
                <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Perfect Games</div>
              </div>
            )}
            {winStreak && winStreak.current > 0 && (
              <div className="flex-1 text-center p-2" style={{ background: `${accentColor}08`, borderRadius: '10px' }}>
                <div className="text-lg font-black" style={{ color: accentColor }}>{winStreak.current}</div>
                <div className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Win Streak</div>
              </div>
            )}
          </div>
        )}

        {/* Time of Day Heatmap */}
        {timeOfDay && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              When You Play
            </div>
            <TimeOfDayHeatmap data={timeOfDay} accentColor={accentColor} />
          </div>
        )}

        {/* Consistency */}
        {consistency && consistency.sampleSize >= 3 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Consistency
            </div>
            <ConsistencyGauge score={consistency.score} sampleSize={consistency.sampleSize} accentColor={accentColor} />
          </div>
        )}

        {/* Head to Head (VS only) */}
        {showVs && headToHead && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
              VS Record
            </div>
            <HeadToHeadCard {...headToHead} accentColor={accentColor} />
          </div>
        )}

        {/* Empty state */}
        {!hasData && (
          <p className="text-center text-[10px] font-bold py-4" style={{ color: 'var(--color-text-muted)' }}>
            Play more games to unlock insights
          </p>
        )}
      </div>
    </div>
  );
}
