'use client';

import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { PAGE_SCENES } from '@/lib/art';
import { WIN_FG } from '@/lib/tile-theme';
import { SoftNum } from '@/components/ui/soft-number';

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
      <BrandEmptyState
        scene={PAGE_SCENES.empty}
        artHeight={64}
        accent="vs"
        className="py-2"
        title="NO VS MATCHES YET"
        line="Nobody's gone head to head in this mode yet."
      />
    );
  }

  const winPct = total > 0 ? (wins / total) * 100 : 0;
  const lossPct = total > 0 ? (losses / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-center flex-1">
          <SoftNum size={18} as="div" className="soft-num-auto">{wins}</SoftNum>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Won</div>
        </div>
        <div className="text-center px-4">
          <SoftNum size={24} as="div" className="soft-num-auto">{winRate}%</SoftNum>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Win Rate</div>
        </div>
        <div className="text-center flex-1">
          <SoftNum size={18} as="div" className="soft-num-auto">{losses}</SoftNum>
          <div className="text-[9px] font-bold uppercase" style={{ color: 'var(--color-text-muted)' }}>Lost</div>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-l-full" style={{ width: `${winPct}%`, background: WIN_FG }} />
        <div className="h-full rounded-r-full" style={{ width: `${lossPct}%`, background: '#dc2626' }} />
      </div>
      <div className="text-center mt-1">
        <span className="text-[9px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{total} total VS matches</span>
      </div>
    </div>
  );
}
