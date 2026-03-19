import { TileState, TileResult, GuessResult } from './types';

export function evaluateGuess(solution: string, guess: string): GuessResult {
  const solutionUpper = solution.toUpperCase();
  const guessUpper = guess.toUpperCase();

  if (guessUpper.length !== solutionUpper.length) {
    throw new Error(`Guess length ${guessUpper.length} does not match solution length ${solutionUpper.length}`);
  }

  const tiles: TileResult[] = [];
  const solutionChars = solutionUpper.split('');
  const guessChars = guessUpper.split('');
  const used: boolean[] = new Array(solutionChars.length).fill(false);

  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === solutionChars[i]) {
      tiles.push({ letter: guessChars[i], state: TileState.CORRECT });
      used[i] = true;
    } else {
      tiles.push({ letter: guessChars[i], state: TileState.ABSENT });
    }
  }

  for (let i = 0; i < guessChars.length; i++) {
    if (tiles[i].state === TileState.CORRECT) continue;

    for (let j = 0; j < solutionChars.length; j++) {
      if (!used[j] && guessChars[i] === solutionChars[j]) {
        tiles[i].state = TileState.PRESENT;
        used[j] = true;
        break;
      }
    }
  }

  const isCorrect = tiles.every(t => t.state === TileState.CORRECT);
  return { tiles, isCorrect };
}
