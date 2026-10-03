'use client';

import { useDictionary } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { OctordleGame } from '@/components/octordle/octordle-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { GameLoading } from '@/components/game/game-loading';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

export default function OctordlePage() {
  const ready = useDictionary([5]);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  if (!ready) return <GameLoading />;

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'OCTORDLE') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="octoword"><OctordleGame initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
