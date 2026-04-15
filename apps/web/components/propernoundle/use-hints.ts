import { useState, useCallback } from 'react';
import { Guess, TileState, Puzzle } from './types';
import { normalizeString } from './game-logic';
import { fetchWikipediaHint } from './wikipedia';

export interface HintState {
  hint: string | null;
  hintUsed: boolean;
  loadingHint: boolean;
  vowelRevealed: string | null;
  vowelUsed: boolean;
  consonantRevealed: string | null;
  consonantUsed: boolean;
}

const initialHintState: HintState = {
  hint: null,
  hintUsed: false,
  loadingHint: false,
  vowelRevealed: null,
  vowelUsed: false,
  consonantRevealed: null,
  consonantUsed: false,
};

/**
 * Persistable slice of the hint state — excludes transient loading flag
 * since any in-flight Wikipedia fetch is abandoned when the component
 * unmounts, so the hook should always restart with loadingHint: false.
 */
export type PersistedHintState = Omit<HintState, 'loadingHint'>;

export function useHints() {
  const [state, setState] = useState<HintState>(initialHintState);

  const resetHints = useCallback(() => {
    setState(initialHintState);
  }, []);

  // Restore a previously saved hint state — used when the game component
  // rehydrates from localStorage so the clue text, revealed vowel/consonant,
  // and used-flags survive navigation. loadingHint is forced to false since
  // any in-flight fetch was abandoned on unmount.
  const restoreHints = useCallback((saved: PersistedHintState) => {
    setState({ ...saved, loadingHint: false });
  }, []);

  const fetchClue = useCallback(async (
    puzzle: Puzzle,
    answerLength: number,
  ): Promise<Guess | null> => {
    if (state.hintUsed) return null;

    setState(prev => ({ ...prev, loadingHint: true }));

    try {
      const hintText = await fetchWikipediaHint(puzzle.display, puzzle.wikiTitle);

      setState(prev => ({
        ...prev,
        hint: hintText,
        hintUsed: true,
        loadingHint: false,
      }));

      return {
        word: '',
        tiles: Array(answerLength).fill('hint-used' as TileState),
      };
    } catch {
      const fallback = puzzle.hint || 'No hint available for this puzzle.';
      setState(prev => ({
        ...prev,
        hint: fallback,
        hintUsed: true,
        loadingHint: false,
      }));

      return {
        word: '',
        tiles: Array(answerLength).fill('hint-used' as TileState),
      };
    }
  }, [state.hintUsed]);

  const revealVowel = useCallback((
    puzzle: Puzzle,
  ): Guess | null => {
    if (state.vowelUsed) return null;

    const normalizedAnswer = normalizeString(puzzle.answer);
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const vowelsInAnswer = [...normalizedAnswer.toUpperCase()].filter(c => vowels.includes(c));

    if (vowelsInAnswer.length === 0) {
      setState(prev => ({ ...prev, vowelRevealed: 'None', vowelUsed: true }));
      return null;
    }

    const uniqueVowels = Array.from(new Set(vowelsInAnswer));
    const randomVowel = uniqueVowels[Math.floor(Math.random() * uniqueVowels.length)];

    setState(prev => ({ ...prev, vowelRevealed: randomVowel, vowelUsed: true }));

    const revealedWord = normalizedAnswer
      .split('')
      .map(c => (c.toUpperCase() === randomVowel ? c : '_'))
      .join('');

    const tiles: TileState[] = normalizedAnswer
      .split('')
      .map(c => (c.toUpperCase() === randomVowel ? 'correct' : 'hint-used'));

    return { word: revealedWord, tiles };
  }, [state.vowelUsed]);

  const revealConsonant = useCallback((
    puzzle: Puzzle,
  ): Guess | null => {
    if (state.consonantUsed) return null;

    const normalizedAnswer = normalizeString(puzzle.answer);
    const vowels = ['A', 'E', 'I', 'O', 'U'];
    const consonantsInAnswer = [...normalizedAnswer.toUpperCase()].filter(
      c => c >= 'A' && c <= 'Z' && !vowels.includes(c)
    );

    if (consonantsInAnswer.length === 0) {
      setState(prev => ({ ...prev, consonantRevealed: 'None', consonantUsed: true }));
      return null;
    }

    const uniqueConsonants = Array.from(new Set(consonantsInAnswer));
    const randomConsonant = uniqueConsonants[Math.floor(Math.random() * uniqueConsonants.length)];

    setState(prev => ({ ...prev, consonantRevealed: randomConsonant, consonantUsed: true }));

    const revealedWord = normalizedAnswer
      .split('')
      .map(c => (c.toUpperCase() === randomConsonant ? c : '_'))
      .join('');

    const tiles: TileState[] = normalizedAnswer
      .split('')
      .map(c => (c.toUpperCase() === randomConsonant ? 'correct' : 'hint-used'));

    return { word: revealedWord, tiles };
  }, [state.consonantUsed]);

  return {
    ...state,
    resetHints,
    restoreHints,
    fetchClue,
    revealVowel,
    revealConsonant,
  };
}
