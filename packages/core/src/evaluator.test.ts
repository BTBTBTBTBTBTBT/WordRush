import { describe, it, expect } from 'vitest';
import { evaluateGuess } from './evaluator';
import { TileState } from './types';

describe('evaluateGuess', () => {
  it('should mark all correct letters as CORRECT', () => {
    const result = evaluateGuess('HELLO', 'HELLO');
    expect(result.isCorrect).toBe(true);
    expect(result.tiles.every(t => t.state === TileState.CORRECT)).toBe(true);
  });

  it('should mark correct position letters as CORRECT', () => {
    const result = evaluateGuess('HELLO', 'HXXXX');
    expect(result.tiles[0].state).toBe(TileState.CORRECT);
    expect(result.tiles[0].letter).toBe('H');
  });

  it('should mark present letters as PRESENT', () => {
    const result = evaluateGuess('HELLO', 'OXXXX');
    expect(result.tiles[0].state).toBe(TileState.PRESENT);
  });

  it('should mark absent letters as ABSENT', () => {
    const result = evaluateGuess('HELLO', 'AXXXX');
    expect(result.tiles[0].state).toBe(TileState.ABSENT);
  });

  it('should handle duplicate letters correctly - both in solution', () => {
    const result = evaluateGuess('SPEED', 'EEXXX');
    expect(result.tiles[0].state).toBe(TileState.PRESENT);
    expect(result.tiles[1].state).toBe(TileState.CORRECT);
  });

  it('should handle duplicate letters correctly - one correct, one wrong', () => {
    const result = evaluateGuess('HELLO', 'LXLXX');
    expect(result.tiles[0].state).toBe(TileState.PRESENT);
    expect(result.tiles[2].state).toBe(TileState.CORRECT);
  });

  it('should handle duplicate letters correctly - more in guess than solution', () => {
    const result = evaluateGuess('HELLO', 'LLLXX');
    const presentCount = result.tiles.filter(t => t.state === TileState.PRESENT || t.state === TileState.CORRECT).length;
    expect(presentCount).toBe(2);
  });

  it('should handle all absent guess', () => {
    const result = evaluateGuess('HELLO', 'TRAPS');
    expect(result.isCorrect).toBe(false);
    expect(result.tiles.every(t => t.state === TileState.ABSENT)).toBe(true);
  });

  it('should be case insensitive', () => {
    const result1 = evaluateGuess('HELLO', 'hello');
    const result2 = evaluateGuess('hello', 'HELLO');
    expect(result1.isCorrect).toBe(true);
    expect(result2.isCorrect).toBe(true);
  });

  it('should throw error for mismatched length', () => {
    expect(() => evaluateGuess('HELLO', 'HI')).toThrow();
  });
});
