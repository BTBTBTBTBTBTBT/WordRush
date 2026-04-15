import puzzles from '@/data/propernoundle-puzzles.json';
import { Puzzle, ThemeCategory } from './types';

const EPOCH_DATE = new Date('2024-01-01');

const allPuzzles: Puzzle[] = puzzles as Puzzle[];

function getDaysSinceEpoch(dateString?: string): number {
  const targetDate = dateString ? new Date(dateString) : new Date();
  const timeDiff = targetDate.getTime() - EPOCH_DATE.getTime();
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
}

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDailyPuzzle(dateString?: string): Puzzle {
  const date = dateString || getTodayString();
  const dayNumber = getDaysSinceEpoch(date);
  const index = dayNumber % allPuzzles.length;
  return allPuzzles[index];
}

export function getDailyPuzzleNumber(dateString?: string): number {
  return getDaysSinceEpoch(dateString) + 1;
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
