'use client';

interface ModeStatsCardProps {
  wins: number;
  losses: number;
  totalGames: number;
  bestScore: number;
  fastestTime: number;
  accentColor: string;
  winStreak?: { current: number; best: number };
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '-';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ModeStatsCard({ wins, losses, totalGames, bestScore, fastestTime, accentColor, winStreak }: ModeStatsCardProps) {
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const stats = [
    { label: 'Wins', value: wins, color: '#16a34a' },
    { label: 'Losses', value: losses, color: '#dc2626' },
    { label: 'Games', value: totalGames, color: accentColor },
    { label: 'Win Rate', value: `${winRate}%`, color: '#7c3aed' },
    { label: 'Best', value: bestScore > 0 ? bestScore : '-', color: '#d97706' },
    { label: 'Fastest', value: formatTime(fastestTime), color: '#2563eb' },
    { label: 'Streak', value: winStreak?.current || 0, color: '#f59e0b' },
    { label: 'Best Streak', value: winStreak?.best || 0, color: '#ea580c' },
  ];

  return (
    <div
      className="p-4"
      style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '16px' }}
    >
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>{s.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
