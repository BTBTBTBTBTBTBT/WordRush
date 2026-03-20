'use client';

import { useState, useEffect } from 'react';
import { PracticeGame } from '@/components/practice/practice-game';
import { initDictionary, GameMode } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function PracticePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    setReady(true);
  }, []);

  if (!ready) return null;

  return <PracticeGame mode={GameMode.DUEL} onBack={() => window.location.href = '/'} />;
}
