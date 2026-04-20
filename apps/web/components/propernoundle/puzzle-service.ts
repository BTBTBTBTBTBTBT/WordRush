import puzzles from '@/data/propernoundle-puzzles.json';
import { Puzzle, ThemeCategory } from './types';
import { getTodayLocal } from '@/lib/daily-service';

// ISO date-only strings parse as UTC midnight, so epoch and target both sit
// on UTC midnight and their difference is a clean multiple of 86400000 ms.
// The resulting integer is a stable "day index" regardless of viewer TZ.
const EPOCH_DATE_STRING = '2024-01-01';

const allPuzzles: Puzzle[] = puzzles as Puzzle[];

function getDaysSinceEpoch(dateString: string): number {
  const target = new Date(dateString).getTime();
  const epoch = new Date(EPOCH_DATE_STRING).getTime();
  return Math.floor((target - epoch) / 86400000);
}

export function getDailyPuzzle(dateString?: string): Puzzle {
  const date = dateString || getTodayLocal();
  const dayNumber = getDaysSinceEpoch(date);
  const index = dayNumber % allPuzzles.length;
  return allPuzzles[index];
}

export function getDailyPuzzleNumber(dateString?: string): number {
  return getDaysSinceEpoch(dateString || getTodayLocal()) + 1;
}

export function getRandomPuzzle(excludeIds: string[] = []): Puzzle {
  const available = allPuzzles.filter(p => !excludeIds.includes(p.id));
  const randomIndex = Math.floor(Math.random() * available.length);
  return available[randomIndex];
}

export function getPuzzleById(id: string): Puzzle | null {
  return allPuzzles.find(p => p.id === id) ?? null;
}

export function getPuzzlesByCategory(themeCategory: ThemeCategory): Puzzle[] {
  return allPuzzles.filter(p => p.themeCategory === themeCategory);
}

export function getAllCategories(): ThemeCategory[] {
  const cats = new Set<ThemeCategory>();
  allPuzzles.forEach(p => {
    if (p.themeCategory) cats.add(p.themeCategory);
  });
  return Array.from(cats);
}
