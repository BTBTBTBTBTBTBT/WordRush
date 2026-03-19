import { describe, it, expect, beforeAll } from 'vitest';
import { generateSolutionsFromSeed } from './seed';
import { initDictionary } from './dictionary';

describe('seed generation', () => {
  beforeAll(() => {
    const solutions = ['APPLE', 'BREAD', 'CRANE', 'DELTA', 'EARTH'];
    initDictionary(solutions, solutions);
  });

  it('should generate deterministic solutions from same seed', () => {
    const seed = 'test-seed-123';
    const solutions1 = generateSolutionsFromSeed(seed, 3);
    const solutions2 = generateSolutionsFromSeed(seed, 3);
    expect(solutions1).toEqual(solutions2);
  });

  it('should generate different solutions from different seeds', () => {
    const solutions1 = generateSolutionsFromSeed('seed1', 3);
    const solutions2 = generateSolutionsFromSeed('seed2', 3);
    expect(solutions1).not.toEqual(solutions2);
  });

  it('should generate requested number of solutions', () => {
    const solutions = generateSolutionsFromSeed('test', 3);
    expect(solutions).toHaveLength(3);
  });

  it('should generate valid solution words', () => {
    const solutions = generateSolutionsFromSeed('test', 2);
    solutions.forEach(sol => {
      expect(sol).toHaveLength(5);
      expect(sol).toMatch(/^[A-Z]+$/);
    });
  });
});
