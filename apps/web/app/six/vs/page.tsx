'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

function VsSixInner() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { ensureDictionaryInitialized(); }, []);
  return (
    <AdGate>
      <VsGame mode={GameMode.DUEL_6} isDaily={isDaily} inviteCode={inviteCode} />
    </AdGate>
  );
}

export default function VsSixPage() {
  return (
    <Suspense fallback={null}>
      <VsSixInner />
    </Suspense>
  );
}
