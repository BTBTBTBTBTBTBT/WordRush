'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  return <AdGate><VsProGate mode={GameMode.GAUNTLET} inviteCode={inviteCode}><VsGame mode={GameMode.GAUNTLET} inviteCode={inviteCode} /></VsProGate></AdGate>;
}

export default function VsGauntletPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
