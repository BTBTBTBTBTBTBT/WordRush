'use client';

import { useEffect } from 'react';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function VsGauntletPage() {
  useEffect(() => { initDictionary(allowedWords, solutionWords); }, []);
  return <AdGate><VsGame mode={GameMode.GAUNTLET} /></AdGate>;
}
