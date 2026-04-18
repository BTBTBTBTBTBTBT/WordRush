'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { initDictionary(allowedWords, solutionWords); }, []);
  return <AdGate><VsGame mode={GameMode.GAUNTLET} inviteCode={inviteCode} /></AdGate>;
}

export default function VsGauntletPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
