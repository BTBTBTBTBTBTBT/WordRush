import { GameState, GameAction, GameMode, GameStatus, BoardState } from './types';
import { generateSolutionsFromSeed } from './seed';
import { evaluateGuess } from './evaluator';
import { isValidWord, getAllowedWords } from './dictionary';
import { generatePrefillGuesses } from './prefill';

export function initializeGame(seed: string, mode: GameMode): GameState {
  return createInitialState(seed, mode);
}

function createBoardState(solution: string, maxGuesses: number = 6): BoardState {
  return {
    solution,
    guesses: [],
    maxGuesses,
    status: GameStatus.PLAYING
  };
}

export function createInitialState(seed: string, mode: GameMode): GameState {
  let boardCount = 1;
  let maxGuesses = 6;

  switch (mode) {
    case GameMode.DUEL:
      boardCount = 1;
      maxGuesses = 6;
      break;
    case GameMode.MULTI_DUEL:
      boardCount = 2;
      maxGuesses = 6;
      break;
    case GameMode.GAUNTLET:
      boardCount = 3;
      maxGuesses = 6;
      break;
    case GameMode.QUORDLE:
      boardCount = 4;
      maxGuesses = 9;
      break;
    case GameMode.OCTORDLE:
      boardCount = 8;
      maxGuesses = 13;
      break;
    case GameMode.SEQUENCE:
      boardCount = 5;
      maxGuesses = 6;
      break;
    case GameMode.RESCUE:
      boardCount = 4;
      maxGuesses = 6;
      break;
    case GameMode.TOURNAMENT:
      boardCount = 5;
      maxGuesses = 6;
      break;
  }

  const solutions = generateSolutionsFromSeed(seed, boardCount);
  const boards = solutions.map(sol => createBoardState(sol, maxGuesses));

  if (mode === GameMode.RESCUE) {
    const allowedWords = getAllowedWords();
    boards.forEach((board, i) => {
      board.prefilledGuesses = generatePrefillGuesses(seed, board.solution, i, allowedWords);
    });
  }

  const state: GameState = {
    mode,
    seed,
    startTime: Date.now(),
    boards,
    currentBoardIndex: 0,
    status: GameStatus.PLAYING
  };

  if (mode === GameMode.GAUNTLET) {
    state.gauntlet = {
      currentRound: 0,
      totalRounds: 3,
      boards
    };
  }

  return state;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SUBMIT_GUESS': {
      const { guess, boardIndex = state.currentBoardIndex } = action;

      if (state.status !== GameStatus.PLAYING) {
        return state;
      }

      if (guess.length !== 5) {
        return state;
      }

      if (!isValidWord(guess)) {
        return state;
      }

      const board = state.boards[boardIndex];
      if (board.status !== GameStatus.PLAYING) {
        return state;
      }

      const result = evaluateGuess(board.solution, guess);
      const newGuesses = [...board.guesses, guess.toUpperCase()];

      let newStatus: GameStatus = board.status;
      if (result.isCorrect) {
        newStatus = GameStatus.WON;
      } else if (newGuesses.length >= board.maxGuesses) {
        newStatus = GameStatus.LOST;
      }

      const newBoards = [...state.boards];
      newBoards[boardIndex] = {
        ...board,
        guesses: newGuesses,
        status: newStatus
      };

      let gameStatus: GameStatus = state.status;

      if (state.mode === GameMode.DUEL) {
        gameStatus = newStatus;
      } else if (state.mode === GameMode.MULTI_DUEL) {
        const allComplete = newBoards.every(b => b.status !== GameStatus.PLAYING);
        if (allComplete) {
          const anyWon = newBoards.some(b => b.status === GameStatus.WON);
          gameStatus = anyWon ? GameStatus.WON : GameStatus.LOST;
        }
      } else if (state.mode === GameMode.GAUNTLET) {
        if (newStatus === GameStatus.LOST) {
          gameStatus = GameStatus.LOST;
        } else if (newStatus === GameStatus.WON && state.gauntlet) {
          if (state.gauntlet.currentRound === state.gauntlet.totalRounds - 1) {
            gameStatus = GameStatus.WON;
          }
        }
      } else if (state.mode === GameMode.QUORDLE || state.mode === GameMode.OCTORDLE) {
        const allComplete = newBoards.every(b => b.status !== GameStatus.PLAYING);
        if (allComplete) {
          const allWon = newBoards.every(b => b.status === GameStatus.WON);
          gameStatus = allWon ? GameStatus.WON : GameStatus.LOST;
        }
      } else if (state.mode === GameMode.SEQUENCE || state.mode === GameMode.RESCUE || state.mode === GameMode.TOURNAMENT) {
        if (newStatus === GameStatus.LOST) {
          gameStatus = GameStatus.LOST;
        } else if (newStatus === GameStatus.WON) {
          const allWon = newBoards.every(b => b.status === GameStatus.WON);
          if (allWon) {
            gameStatus = GameStatus.WON;
          }
        }
      }

      return {
        ...state,
        boards: newBoards,
        status: gameStatus
      };
    }

    case 'NEXT_BOARD': {
      if (state.mode !== GameMode.GAUNTLET || !state.gauntlet) {
        return state;
      }

      const currentBoard = state.boards[state.currentBoardIndex];
      if (currentBoard.status !== GameStatus.WON) {
        return state;
      }

      const nextRound = state.gauntlet.currentRound + 1;
      if (nextRound >= state.gauntlet.totalRounds) {
        return state;
      }

      return {
        ...state,
        currentBoardIndex: nextRound,
        gauntlet: {
          ...state.gauntlet,
          currentRound: nextRound
        }
      };
    }

    case 'ABANDON': {
      return {
        ...state,
        status: GameStatus.ABANDONED
      };
    }

    case 'RESET': {
      return createInitialState(action.seed, action.mode);
    }

    default:
      return state;
  }
}
