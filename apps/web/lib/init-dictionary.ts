import { initDictionary } from '@wordle-duel/core';
import allowedWords from '../data/allowed.json';
import solutionWords from '../data/solutions.json';

let initialized = false;

export function ensureDictionaryInitialized() {
  if (!initialized) {
    initDictionary(allowedWords, solutionWords);
    initialized = true;
  }
}
