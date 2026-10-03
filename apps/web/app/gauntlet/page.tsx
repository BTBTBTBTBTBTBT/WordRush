'use client';

import { useDictionary } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { GauntletGame } from '@/components/gauntlet/gauntlet-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { GameLoading } from '@/components/game/game-loading';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

export default function GauntletPage() {
  const ready = useDictionary([5]);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  if (!ready) return <GameLoading />;

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'GAUNTLET') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="gauntlet"><GauntletGame initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
