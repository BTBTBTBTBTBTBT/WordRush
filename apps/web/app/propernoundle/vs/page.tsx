'use client';

import { GameMode } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';

export default function VsProperNoundlePage() {
  return <VsGame mode={GameMode.PROPERNOUNDLE} />;
}
