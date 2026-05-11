'use client';

import { Zap, Target, Flame } from 'lucide-react';

interface PersonalBestsProps {
  fastestWin: { time: number; date: string } | null;
  fewestGuesses: { count: number; date: string } | null;
  bestStreak: number;
  accentColor: string;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function PersonalBests({ fastestWin, fewestGuesses, bestStreak, accentColor }: PersonalBestsProps) {
  const bests = [
    { icon: Zap, label: 'Fastest Win', value: fastestWin ? formatTime(fastestWin.time) : '-', date: fastestWin?.date },
    { icon: Target, label: 'Fewest Guesses', value: fewestGuesses ? String(fewestGuesses.count) : '-', date: fewestGuesses?.date },
    { icon: Flame, label: 'Best Streak', value: bestStreak > 0 ? String(bestStreak) : '-', date: undefined },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {bests.map((b) => {
        const Icon = b.icon;
        return (
          <div
            key={b.label}
            className="p-3 text-center"
            style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}20`, borderRadius: '12px' }}
          >
            <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: accentColor }} />
            <div className="text-base font-black leading-tight" style={{ color: 'var(--color-text)' }}>{b.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{b.label}</div>
            {b.date && (
              <div className="text-[8px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{formatDate(b.date)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
