'use client';

import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { getUserDailyRank } from '@/lib/daily-service';
import { useAuth } from '@/lib/auth-context';

interface DailyRankBadgeProps {
  gameMode: string;
  playType?: 'solo' | 'vs';
}

export function DailyRankBadge({ gameMode, playType = 'solo' }: DailyRankBadgeProps) {
  const { profile } = useAuth();
  const [rank, setRank] = useState<{ rank: number; totalPlayers: number } | null>(null);

  useEffect(() => {
    if (!profile) return;
    getUserDailyRank(profile.id, gameMode, playType).then(r => setRank(r));
  }, [profile, gameMode, playType]);

  if (!rank || rank.totalPlayers < 2) return null;

  const percentile = Math.round((1 - (rank.rank - 1) / rank.totalPlayers) * 100);

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
      style={{
        background: percentile >= 75 ? '#fef3c7' : 'var(--color-surface-hover)',
        border: `1px solid ${percentile >= 75 ? '#fde68a' : 'var(--color-border)'}`,
        color: percentile >= 75 ? '#92400e' : 'var(--color-text-muted)',
      }}
    >
      <Trophy className="w-3 h-3" />
      Top {Math.max(1, 100 - percentile)}% · #{rank.rank} of {rank.totalPlayers}
    </span>
  );
}
