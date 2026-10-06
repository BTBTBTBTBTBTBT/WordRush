'use client';

import { useDictionary } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { enterClassicSounds } from '@/lib/sounds';
import { PracticeGame } from '@/components/practice/practice-game';
import { AdGate } from '@/components/ads/ad-gate';
import { UnlimitedGate } from '@/components/game/unlimited-gate';
import { GameLoading } from '@/components/game/game-loading';
import { GameMode } from '@wordle-duel/core';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';

export default function PracticePage() {
  const ready = useDictionary([5]);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  // Classic's own Sound Lab picks while this screen is up (lib/sound-map.ts CLASSIC_SOUNDS).
  useEffect(() => enterClassicSounds(), []);

  if (!ready) return <GameLoading />;

  const seed = isDaily ? generateDailySeed(getTodayLocal(), 'DUEL') : undefined;

  return <AdGate><UnlimitedGate isDaily={isDaily} modeSlug="practice"><PracticeGame mode={GameMode.DUEL} onBack={() => window.location.href = '/'} initialSeed={seed} isDaily={isDaily} /></UnlimitedGate></AdGate>;
}
