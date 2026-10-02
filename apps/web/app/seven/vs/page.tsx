'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { VsLoadingScreen } from '@/components/vs/vs-ui';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function VsSevenInner() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  return (
    <AdGate>
      {/* ?daily=true rides along for the queue seed, but the free daily VS is
          Classic only — the gate treats this route as Pro either way. */}
      <VsProGate mode={GameMode.DUEL_7} isDaily={isDaily} inviteCode={inviteCode}>
        <VsGame mode={GameMode.DUEL_7} isDaily={isDaily} inviteCode={inviteCode} />
      </VsProGate>
    </AdGate>
  );
}

export default function VsSevenPage() {
  return (
    <Suspense fallback={<VsLoadingScreen mode={GameMode.DUEL_7} />}>
      <VsSevenInner />
    </Suspense>
  );
}
