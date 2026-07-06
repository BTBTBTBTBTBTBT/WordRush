import { initDictionary, initDictionaryForLength } from '@wordle-duel/core';
import allowedWords from '../data/allowed.json';
import solutionWords from '../data/solutions.json';
import legacySolutionWords from '../data/solutions-legacy.json';
import allowed6 from '../data/allowed-6.json';
import solutions6 from '../data/solutions-6.json';
import allowed7 from '../data/allowed-7.json';
import solutions7 from '../data/solutions-7.json';

let initialized = false;

export function ensureDictionaryInitialized() {
  if (!initialized) {
    // legacy list feeds the pre-cutover answer pool (date-gated in core).
    initDictionary(allowedWords, solutionWords, legacySolutionWords);
    initDictionaryForLength(6, allowed6, solutions6);
    initDictionaryForLength(7, allowed7, solutions7);
    initialized = true;
  }
}
