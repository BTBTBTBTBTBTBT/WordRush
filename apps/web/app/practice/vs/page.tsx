'use client';

import { useEffect, Suspense } from 'react';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';

function VsClassicInner() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { ensureDictionaryInitialized(); }, []);
  return (
    <AdGate>
      <VsGame mode={GameMode.DUEL} isDaily={isDaily} inviteCode={inviteCode} />
    </AdGate>
  );
}

export default function VsClassicPage() {
  return (
    <Suspense fallback={null}>
      <VsClassicInner />
    </Suspense>
  );
}
