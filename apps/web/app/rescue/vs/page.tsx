'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { VsLoadingScreen } from '@/components/vs/vs-ui';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  return <AdGate><VsProGate mode={GameMode.RESCUE} inviteCode={inviteCode}><VsGame mode={GameMode.RESCUE} inviteCode={inviteCode} /></VsProGate></AdGate>;
}

export default function VsRescuePage() {
  return <Suspense fallback={<VsLoadingScreen mode={GameMode.RESCUE} />}><Inner /></Suspense>;
}
