import { TileState } from './types';

export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\w'-]/g, '');
}

export function evaluateGuess(guess: string, answer: string): TileState[] {
  const normalizedGuess = normalizeString(guess);
  const normalizedAnswer = normalizeString(answer);

  if (normalizedGuess.length !== normalizedAnswer.length) {
    return Array(normalizedGuess.length).fill('absent');
  }

  const result: TileState[] = Array(normalizedGuess.length).fill('absent');
  const answerChars = normalizedAnswer.split('');
  const answerUsed = Array(answerChars.length).fill(false);

  for (let i = 0; i < normalizedGuess.length; i++) {
    if (normalizedGuess[i] === answerChars[i]) {
      result[i] = 'correct';
      answerUsed[i] = true;
    }
  }

  for (let i = 0; i < normalizedGuess.length; i++) {
    if (result[i] === 'correct') continue;
    const char = normalizedGuess[i];
    for (let j = 0; j < answerChars.length; j++) {
      if (!answerUsed[j] && answerChars[j] === char) {
        result[i] = 'present';
        answerUsed[j] = true;
        break;
      }
    }
  }

  return result;
}

export function checkWin(tileStates: TileState[]): boolean {
  return tileStates.every(state => state === 'correct');
}
