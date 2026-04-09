'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { GauntletGame } from '@/components/gauntlet/gauntlet-game';
import { initDictionary } from '@wordle-duel/core';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayUTC } from '@/lib/daily-service';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function GauntletPage() {
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    setReady(true);
  }, []);

  if (!ready) return null;

  const seed = isDaily ? generateDailySeed(getTodayUTC(), 'GAUNTLET') : undefined;

  return <GauntletGame initialSeed={seed} isDaily={isDaily} />;
}
