'use client';

import { useSearchParams } from 'next/navigation';
import { PracticeGame } from '@/components/practice/practice-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { GameLoading } from '@/components/game/game-loading';
import { GameMode } from '@wordle-duel/core';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';
import { useDictionary } from '@/lib/init-dictionary';

export default function SevenPage() {
  const ready = useDictionary([7]);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  if (!ready) return <GameLoading />;

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'DUEL_7') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="seven"><PracticeGame mode={GameMode.DUEL_7} onBack={() => window.location.href = '/'} initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
