let allowedWords: Set<string> = new Set();
let allowedWordsArray: string[] = [];
let solutionWords: string[] = [];

// Multi-length dictionaries (for 6-letter, 7-letter, etc.)
const lengthDictionaries: Map<number, { allowed: Set<string>, allowedArray: string[], solutions: string[] }> = new Map();

export function initDictionary(allowed: string[], solutions: string[]): void {
  allowedWords = new Set(allowed.map(w => w.toUpperCase()));
  allowedWordsArray = allowed.map(w => w.toUpperCase());
  solutionWords = solutions.map(w => w.toUpperCase());
}

export function initDictionaryForLength(length: number, allowed: string[], solutions: string[]): void {
  const allowedArray = allowed.map(w => w.toUpperCase());
  lengthDictionaries.set(length, {
    allowed: new Set(allowedArray),
    allowedArray,
    solutions: solutions.map(w => w.toUpperCase()),
  });
}

export function getAllowedWords(): string[] {
  return allowedWordsArray;
}

/**
 * Full allowed list for a word length. Uses the length-keyed dictionary
 * (initDictionaryForLength — the real 6/7-letter lists) when one is loaded;
 * otherwise filters the default dictionary. The default allowed list is
 * ~9.3k FIVE-letter words plus a couple of stray 6/7-letter entries, so
 * callers needing 6/7-letter words MUST use this, not getAllowedWords().
 */
export function getAllowedWordsForLength(length: number): string[] {
  const dict = lengthDictionaries.get(length);
  if (dict) return dict.allowedArray;
  return allowedWordsArray.filter(w => w.length === length);
}

export function isValidWord(word: string): boolean {
  const upper = word.toUpperCase();
  // Check length-specific dictionary first
  const lengthDict = lengthDictionaries.get(upper.length);
  if (lengthDict) {
    return lengthDict.allowed.has(upper);
  }
  // Fall back to default (5-letter) dictionary
  return allowedWords.has(upper);
}

export function isWordValid(word: string): boolean {
  return isValidWord(word);
}

export function getSolutionWord(index: number): string {
  if (solutionWords.length === 0) {
    throw new Error('Dictionary not initialized');
  }
  return solutionWords[index % solutionWords.length];
}

export function getSolutionCount(): number {
  return solutionWords.length;
}

export function getSolutionWordForLength(length: number, index: number): string {
  const dict = lengthDictionaries.get(length);
  if (!dict || dict.solutions.length === 0) {
    throw new Error(`Dictionary not initialized for ${length}-letter words`);
  }
  return dict.solutions[index % dict.solutions.length];
}

export function getSolutionCountForLength(length: number): number {
  const dict = lengthDictionaries.get(length);
  return dict ? dict.solutions.length : 0;
}
