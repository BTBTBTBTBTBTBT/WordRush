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
  return <AdGate><VsProGate mode={GameMode.SEQUENCE} inviteCode={inviteCode}><VsGame mode={GameMode.SEQUENCE} inviteCode={inviteCode} /></VsProGate></AdGate>;
}

export default function VsSequencePage() {
  return <Suspense fallback={<VsLoadingScreen mode={GameMode.SEQUENCE} />}><Inner /></Suspense>;
}
