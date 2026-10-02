'use client';

import { useState, useEffect } from 'react';
import { Icon3D } from '@/components/ui/icon3d';

import { getUserDailyRank } from '@/lib/daily-service';
import { topPercentLabel } from '@/lib/format';
import { BRAND_ACCENT, softPill } from '@/lib/soft-surface';
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

  const { label, gold } = topPercentLabel(rank.rank, rank.totalPlayers);

  // A1: a tinted pill (gold in the top quarter, brand purple otherwise) — no
  // plain white; the gold ink lightens on the dark theme (globals.css .lb-gold-ink).
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 tabular-nums ${gold ? 'lb-gold-ink' : ''}`}
      style={{
        ...softPill(gold ? '#f59e0b' : BRAND_ACCENT, { bar: false }),
        color: gold ? undefined : 'var(--color-text-secondary)',
      }}
    >
      <Icon3D name="trophy" size={14} />
      {label} · #{rank.rank} of {rank.totalPlayers}
    </span>
  );
}
