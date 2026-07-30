'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';
import { VsProGate } from '@/components/game/unlimited-gate';

function Inner() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') ?? undefined;
  return <AdGate><VsProGate mode={GameMode.PROPERNOUNDLE} inviteCode={inviteCode}><VsGame mode={GameMode.PROPERNOUNDLE} inviteCode={inviteCode} /></VsProGate></AdGate>;
}

export default function VsProperNoundlePage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
