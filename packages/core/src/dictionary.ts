let allowedWords: Set<string> = new Set();
let allowedWordsArray: string[] = [];
let solutionWords: string[] = [];

export function initDictionary(allowed: string[], solutions: string[]): void {
  allowedWords = new Set(allowed.map(w => w.toUpperCase()));
  allowedWordsArray = allowed.map(w => w.toUpperCase());
  solutionWords = solutions.map(w => w.toUpperCase());
}

export function getAllowedWords(): string[] {
  return allowedWordsArray;
}

export function isValidWord(word: string): boolean {
  return allowedWords.has(word.toUpperCase());
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
