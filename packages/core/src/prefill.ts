import { PrefilledGuess } from './types';
import { evaluateGuess } from './evaluator';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generatePrefillGuesses(
  seed: string,
  solution: string,
  boardIndex: number,
  allowedWords: string[]
): PrefilledGuess[] {
  const prefills: PrefilledGuess[] = [];
  const solutionUpper = solution.toUpperCase();

  for (let i = 0; i < 3; i++) {
    let attempt = 0;
    let word: string;

    do {
      const hashKey = `${seed}-prefill-${boardIndex}-${i}-${attempt}`;
      const hash = simpleHash(hashKey);
      const index = hash % allowedWords.length;
      word = allowedWords[index];
      attempt++;
    } while (word === solutionUpper && attempt < 100);

    const evaluation = evaluateGuess(solutionUpper, word);
    prefills.push({ word, evaluation });
  }

  return prefills;
}
