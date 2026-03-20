'use client';

import { useEffect } from 'react';
import { GameMode, initDictionary } from '@wordle-duel/core';
import { VsGame } from '@/components/vs/vs-game';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function VsClassicPage() {
  useEffect(() => { initDictionary(allowedWords, solutionWords); }, []);
  return <VsGame mode={GameMode.DUEL} />;
}
