'use client';

import { useEffect, Suspense } from 'react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { ensureDictionaryInitialized(); }, []);
  return <AdGate><VsProGate mode={GameMode.RESCUE} inviteCode={inviteCode}><VsGame mode={GameMode.RESCUE} inviteCode={inviteCode} /></VsProGate></AdGate>;
}

export default function VsRescuePage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
