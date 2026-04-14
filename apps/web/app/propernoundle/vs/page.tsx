'use client';

import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import { AdGate } from '@/components/ads/ad-gate';

export default function VsProperNoundlePage() {
  return <AdGate><VsGame mode={GameMode.PROPERNOUNDLE} /></AdGate>;
}
