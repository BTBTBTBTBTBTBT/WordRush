'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { VsLoadingScreen } from '@/components/vs/vs-ui';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function VsClassicInner() {
  const searchParams = useSearchParams();
  const isDaily = searchParams.get('daily') === 'true';
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  return (
    <AdGate>
      {/* ?daily=true is the one free VS door — the gate lets it through. */}
      <VsProGate mode={GameMode.DUEL} isDaily={isDaily} inviteCode={inviteCode}>
        <VsGame mode={GameMode.DUEL} isDaily={isDaily} inviteCode={inviteCode} />
      </VsProGate>
    </AdGate>
  );
}

export default function VsClassicPage() {
  return (
    <Suspense fallback={<VsLoadingScreen mode={GameMode.DUEL} />}>
      <VsClassicInner />
    </Suspense>
  );
}
