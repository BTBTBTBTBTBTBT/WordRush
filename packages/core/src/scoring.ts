import { GameStatus, ScoreBreakdown, MatchResult } from './types';

export function calculateScore(result: MatchResult): ScoreBreakdown {
  let winBonus = 0;
  let guessDiff = 0;
  let timeDiff = 0;
  let dnfPenalty = 0;

  if (result.playerStatus === GameStatus.WON && result.opponentStatus !== GameStatus.WON) {
    winBonus = 10;
  } else if (result.playerStatus !== GameStatus.WON && result.opponentStatus === GameStatus.WON) {
    winBonus = -10;
  }

  if (result.playerStatus === GameStatus.WON && result.opponentStatus === GameStatus.WON) {
    guessDiff = (result.opponentGuesses - result.playerGuesses) * 2;
  }

  if (result.playerStatus === GameStatus.WON && result.opponentStatus === GameStatus.WON) {
    const timeDiffSeconds = (result.opponentTime - result.playerTime) / 1000;
    const timeDiffPoints = Math.floor(timeDiffSeconds / 5);
    timeDiff = Math.max(-10, Math.min(10, timeDiffPoints));
  }

  if (result.playerStatus === GameStatus.LOST || result.playerStatus === GameStatus.ABANDONED) {
    dnfPenalty = -10;
  } else if (result.opponentStatus === GameStatus.LOST || result.opponentStatus === GameStatus.ABANDONED) {
    dnfPenalty = 10;
  }

  const total = winBonus + guessDiff + timeDiff + dnfPenalty;

  return {
    winBonus,
    guessDiff,
    timeDiff,
    dnfPenalty,
    total
  };
}
