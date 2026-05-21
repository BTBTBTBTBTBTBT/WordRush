import { useState, useCallback } from 'react';
import { TileState, GuessResult, TileResult } from '@wordle-duel/core';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export interface ClassicHintState {
  vowelUsed: boolean;
  consonantUsed: boolean;
  /** The letter that was revealed (for display on the button after use). */
  vowelRevealed: string | null;
  consonantRevealed: string | null;
}

export type PersistedClassicHintState = ClassicHintState;

const initialState: ClassicHintState = {
  vowelUsed: false,
  consonantUsed: false,
  vowelRevealed: null,
  consonantRevealed: null,
};

/**
 * Build the set of letters the player has already used in their guesses
 * (regardless of whether the letter was correct, present, or absent).
 */
function getGuessedLetters(guesses: string[]): Set<string> {
  const letters = new Set<string>();
  for (const g of guesses) {
    for (const ch of g) {
      if (ch >= 'A' && ch <= 'Z') letters.add(ch);
    }
  }
  return letters;
}

/**
 * Build a hint evaluation: revealed positions get CORRECT, others HINT_USED.
 * Returns the "hint word" (letters at revealed positions, spaces elsewhere)
 * and the GuessResult for the board.
 */
function buildHintRow(
  solution: string,
  revealedLetter: string,
): { hintWord: string; hintEvaluation: GuessResult } {
  const upper = solution.toUpperCase();
  const tiles: TileResult[] = [];
  let word = '';

  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === revealedLetter) {
      tiles.push({ letter: revealedLetter, state: TileState.CORRECT });
      word += revealedLetter;
    } else {
      tiles.push({ letter: ' ', state: TileState.HINT_USED });
      word += ' ';
    }
  }

  return {
    hintWord: word,
    hintEvaluation: { tiles, isCorrect: false },
  };
}

export function useClassicHints() {
  const [state, setState] = useState<ClassicHintState>(initialState);

  const resetHints = useCallback(() => setState(initialState), []);

  const restoreHints = useCallback((saved: PersistedClassicHintState) => {
    setState(saved);
  }, []);

  /**
   * Reveal a random vowel from the solution that the player hasn't guessed yet.
   * Returns null if already used or no un-guessed vowels remain.
   */
  const revealVowel = useCallback((
    solution: string,
    guesses: string[],
  ): { hintWord: string; hintEvaluation: GuessResult } | null => {
    if (state.vowelUsed) return null;

    const upper = solution.toUpperCase();
    const guessedLetters = getGuessedLetters(guesses);

    // Find unique vowels in the solution that haven't been guessed
    const candidates = Array.from(
      new Set([...upper].filter(c => VOWELS.has(c) && !guessedLetters.has(c)))
    );

    if (candidates.length === 0) {
      // All vowels already guessed — still mark as used
      setState(prev => ({ ...prev, vowelUsed: true, vowelRevealed: '—' }));
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    setState(prev => ({ ...prev, vowelUsed: true, vowelRevealed: chosen }));

    return buildHintRow(solution, chosen);
  }, [state.vowelUsed]);

  /**
   * Reveal a random consonant from the solution that the player hasn't guessed yet.
   */
  const revealConsonant = useCallback((
    solution: string,
    guesses: string[],
  ): { hintWord: string; hintEvaluation: GuessResult } | null => {
    if (state.consonantUsed) return null;

    const upper = solution.toUpperCase();
    const guessedLetters = getGuessedLetters(guesses);

    const candidates = Array.from(
      new Set([...upper].filter(c => c >= 'A' && c <= 'Z' && !VOWELS.has(c) && !guessedLetters.has(c)))
    );

    if (candidates.length === 0) {
      setState(prev => ({ ...prev, consonantUsed: true, consonantRevealed: '—' }));
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    setState(prev => ({ ...prev, consonantUsed: true, consonantRevealed: chosen }));

    return buildHintRow(solution, chosen);
  }, [state.consonantUsed]);

  return {
    ...state,
    resetHints,
    restoreHints,
    revealVowel,
    revealConsonant,
  };
}
