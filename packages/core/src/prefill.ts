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

/**
 * Pick the 3 shared prefill words for a given seed.
 * Every board in a Rescue game uses the same words,
 * just evaluated against its own solution.
 *
 * Filters to 5-letter words only — allowedWords contains a small number of
 * non-5-letter dictionary entries (legacy artifacts), and picking one crashes
 * evaluateGuess when it's measured against a 5-letter solution.
 */
export function generatePrefillWords(
  seed: string,
  solutions: string[],
  allowedWords: string[]
): string[] {
  const solutionSet = new Set(solutions.map(s => s.toUpperCase()));
  const fiveLetterWords = allowedWords.filter(w => w.length === 5);
  const pool = fiveLetterWords.length > 0 ? fiveLetterWords : allowedWords;
  const words: string[] = [];

  for (let i = 0; i < 3; i++) {
    let attempt = 0;
    let word: string;

    do {
      const hashKey = `${seed}-prefill-${i}-${attempt}`;
      const hash = simpleHash(hashKey);
      const index = hash % pool.length;
      word = pool[index];
      attempt++;
    } while (solutionSet.has(word) && attempt < 100);

    words.push(word);
  }

  return words;
}

/**
 * Generate prefill guesses for a single board using shared words.
 */
export function generatePrefillGuesses(
  words: string[],
  solution: string
): PrefilledGuess[] {
  const solutionUpper = solution.toUpperCase();
  return words.map(word => ({
    word,
    evaluation: evaluateGuess(solutionUpper, word),
  }));
}
