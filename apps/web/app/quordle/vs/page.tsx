'use client';

import { useEffect, Suspense } from 'react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { ensureDictionaryInitialized(); }, []);
  return <AdGate><VsGame mode={GameMode.QUORDLE} inviteCode={inviteCode} /></AdGate>;
}

export default function VsQuordlePage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
