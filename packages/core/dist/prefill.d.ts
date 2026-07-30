import { PrefilledGuess } from './types';
/**
 * Pick the 3 shared prefill words for a given seed.
 * Every board in a Rescue game uses the same words,
 * just evaluated against its own solution.
 *
 * Filters to 5-letter words only — allowedWords contains a small number of
 * non-5-letter dictionary entries (legacy artifacts), and picking one crashes
 * evaluateGuess when it's measured against a 5-letter solution.
 */
export declare function generatePrefillWords(seed: string, solutions: string[], allowedWords: string[]): string[];
/**
 * Generate prefill guesses for a single board using shared words.
 */
export declare function generatePrefillGuesses(words: string[], solution: string): PrefilledGuess[];
//# sourceMappingURL=prefill.d.ts.map