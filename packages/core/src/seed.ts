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
