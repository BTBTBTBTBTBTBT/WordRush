'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

function getRankKey(mode: string, playType: string, pageKey: string) {
  return `rank:${pageKey}:${mode}:${playType}`;
}

export function saveRank(mode: string, playType: string, pageKey: string, rank: number) {
  try {
    sessionStorage.setItem(getRankKey(mode, playType, pageKey), String(rank));
  } catch {}
}

export function getRankDelta(mode: string, playType: string, pageKey: string, currentRank: number): number | null {
  try {
    const prev = sessionStorage.getItem(getRankKey(mode, playType, pageKey));
    if (!prev) return null;
    const delta = parseInt(prev) - currentRank;
    return delta !== 0 ? delta : null;
  } catch {
    return null;
  }
}

export function RankDeltaBadge({
  mode,
  playType,
  pageKey,
  currentRank,
}: {
  mode: string;
  playType: string;
  pageKey: string;
  currentRank: number;
}) {
  const [delta, setDelta] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const d = getRankDelta(mode, playType, pageKey, currentRank);
    setDelta(d);
    saveRank(mode, playType, pageKey, currentRank);
    if (d !== null) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [mode, playType, pageKey, currentRank]);

  if (!delta || !visible) return null;

  const improved = delta > 0;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1 animate-in fade-in slide-in-from-left-1"
      style={{
        background: improved ? 'var(--color-win-bg)' : 'var(--color-loss-bg)',
        color: improved ? 'var(--color-win-text)' : 'var(--color-loss-text)',
        transition: 'opacity 0.3s',
        opacity: visible ? 1 : 0,
      }}
    >
      {improved ? (
        <TrendingUp className="w-2.5 h-2.5" />
      ) : (
        <TrendingDown className="w-2.5 h-2.5" />
      )}
      {improved ? `+${delta}` : delta}
    </span>
  );
}
