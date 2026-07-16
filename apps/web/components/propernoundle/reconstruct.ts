import { normalizeString, evaluateGuess } from './game-logic';
import type { Guess, TileState } from './types';

/** A recorded ProperNoundle hint-row placeholder: iOS pads with spaces, the
 *  web with underscores. */
export const PN_PLACEHOLDER = /[ _]/;

/**
 * Rebuild ONE recorded ProperNoundle row for the cross-device completed card.
 *
 * Hint rows are recorded POSITIONALLY so the revealed letter sits at its real
 * index — iOS writes "     i  " (space-padded, ProperNoundleView.reveal), the
 * web writes "_____i__" (underscore-padded, use-hints). Feeding either through
 * normalizeString()/evaluateGuess() destroys that: normalizeString trims and
 * strips whitespace, collapsing the iOS shape to a bare "i", and evaluateGuess
 * then compares length 1 against the 8-letter answer and returns a single
 * `absent` tile — so the letter rendered at slot 0 in gray instead of at its
 * real slot in purple. Hint rows are rebuilt from their own positions here and
 * never re-evaluated; only real guesses go through the evaluator.
 */
export function rebuildPNRow(recordedWord: string, answer: string): Guess {
  const answerLen = normalizeString(answer).length;
  const raw = recordedWord.toLowerCase();
  const revealed = raw.replace(/[ _]/g, '');

  // Clue hint: consumes a row without revealing any letter (iOS stores "").
  if (revealed.length === 0) {
    return { word: ' '.repeat(answerLen), tiles: Array(answerLen).fill('hint-used') as TileState[] };
  }
  // Vowel/consonant hint: placeholders around the revealed letter(s).
  if (raw.length === answerLen && PN_PLACEHOLDER.test(raw)) {
    return {
      word: [...raw].map(c => (PN_PLACEHOLDER.test(c) ? ' ' : c)).join(''),
      tiles: [...raw].map(c => (PN_PLACEHOLDER.test(c) ? 'hint-used' : 'correct')) as TileState[],
    };
  }
  return { word: normalizeString(recordedWord), tiles: evaluateGuess(recordedWord, answer) };
}
