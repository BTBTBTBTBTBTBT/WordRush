'use client';

import { Swords } from 'lucide-react';

interface HeadToHeadCardProps {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  accentColor: string;
}

export function HeadToHeadCard({ wins, losses, total, winRate, accentColor }: HeadToHeadCardProps) {
  if (total === 0) {
    return (
      <div className="text-center py-3">
        <Swords className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>No VS matches in this mode yet</p>
      </div>
    );
  }

  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-center flex-1">
          <div className="text-lg font-black" style={{ color: '#16a34a' }}>{wins}</div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Won</div>
        </div>
        <div className="text-center px-4">
          <div className="text-2xl font-black" style={{ color: accentColor }}>{winRate}%</div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Win Rate</div>
        </div>
        <div className="text-center flex-1">
          <div className="text-lg font-black" style={{ color: '#dc2626' }}>{losses}</div>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Lost</div>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-l-full" style={{ width: `${winPct}%`, background: '#16a34a' }} />
        <div className="h-full rounded-r-full" style={{ width: `${lossPct}%`, background: '#dc2626' }} />
      </div>
      <div className="text-center mt-1">
        <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{total} total VS matches</span>
      </div>
    </div>
  );
}
