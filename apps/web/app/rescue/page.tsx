'use client';

import { useState, useEffect } from 'react';
import { RescueGame } from '@/components/rescue/rescue-game';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function RescuePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    setReady(true);
  }, []);

  if (!ready) return null;

  return <RescueGame />;
}
