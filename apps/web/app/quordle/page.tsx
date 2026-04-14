'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { QuordleGame } from '@/components/quordle/quordle-game';
import { AdGate } from '@/components/ads/ad-gate';
import { initDictionary } from '@wordle-duel/core';
import { generateDailySeed } from '@wordle-duel/core';
import { getTodayUTC } from '@/lib/daily-service';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function QuordlePage() {
  const [ready, setReady] = useState(false);
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    setReady(true);
  }, []);

  if (!ready) return null;

  const seed = isDaily ? generateDailySeed(getTodayUTC(), 'QUORDLE') : undefined;

  return <AdGate><QuordleGame initialSeed={seed} isDaily={isDaily} /></AdGate>;
}
