'use client';

import { useEffect } from 'react';
import { PracticeGame } from '@/components/practice/practice-game';
import { initDictionary, GameMode } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function PracticePage() {
  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  return <PracticeGame mode={GameMode.DUEL} onBack={() => window.location.href = '/'} />;
}
