'use client';

import { useEffect } from 'react';
import { QuordleGame } from '@/components/quordle/quordle-game';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function QuordlePage() {
  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  return <QuordleGame />;
}
