'use client';

import { useEffect } from 'react';
import { SequenceGame } from '@/components/sequence/sequence-game';
import { initDictionary } from '@wordle-duel/core';
import allowedWords from '@/data/allowed.json';
import solutionWords from '@/data/solutions.json';

export default function SequencePage() {
  useEffect(() => {
    initDictionary(allowedWords, solutionWords);
  }, []);

  return <SequenceGame />;
}
