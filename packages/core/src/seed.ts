import { getSolutionWord, getSolutionCount } from './dictionary';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateSolutionsFromSeed(seed: string, count: number): string[] {
  const solutions: string[] = [];
  const solutionCount = getSolutionCount();
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const seedWithIndex = `${seed}-${i}`;
    let hash = simpleHash(seedWithIndex);
    let attempts = 0;

    while (used.has(hash % solutionCount) && attempts < solutionCount) {
      hash = simpleHash(`${seedWithIndex}-${attempts}`);
      attempts++;
    }

    const index = hash % solutionCount;
    used.add(index);
    solutions.push(getSolutionWord(index));
  }

  return solutions;
}

export function generateMatchSeed(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a deterministic daily seed for a given date and game mode.
 * Everyone playing the same mode on the same day gets the same seed.
 */
export function generateDailySeed(date: string, gameMode: string): string {
  return `daily-${date}-${gameMode}`;
}

/**
 * Check if a seed is a daily seed.
 */
export function isDailySeed(seed: string): boolean {
  return seed.startsWith('daily-');
}

/**
 * Extract the date from a daily seed string.
 */
export function getDailySeedDate(seed: string): string | null {
  if (!isDailySeed(seed)) return null;
  const parts = seed.split('-');
  // daily-YYYY-MM-DD-MODE → date is parts[1]-parts[2]-parts[3]
  if (parts.length >= 4) {
    return `${parts[1]}-${parts[2]}-${parts[3]}`;
  }
  return null;
}
