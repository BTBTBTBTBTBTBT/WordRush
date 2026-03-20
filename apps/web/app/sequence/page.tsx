'use client';

import { useState, useEffect } from 'react';
import { SequenceGame } from '@/components/sequence/sequence-game';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function SequencePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
    setReady(true);
  }, []);

  if (!ready) return null;

  return <SequenceGame />;
}
