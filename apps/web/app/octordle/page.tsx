'use client';

import { useEffect } from 'react';
import { OctordleGame } from '@/components/octordle/octordle-game';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function OctordlePage() {
  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  return <OctordleGame />;
}
