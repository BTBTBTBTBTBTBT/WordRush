'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';
import { VsProGate } from '@/components/game/unlimited-gate';

function VsSixInner() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  useEffect(() => { ensureDictionaryInitialized(); }, []);
  return (
    <AdGate>
      {/* ?daily=true rides along for the queue seed, but the free daily VS is
          Classic only — the gate treats this route as Pro either way. */}
      <VsProGate mode={GameMode.DUEL_6} isDaily={isDaily} inviteCode={inviteCode}>
        <VsGame mode={GameMode.DUEL_6} isDaily={isDaily} inviteCode={inviteCode} />
      </VsProGate>
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
