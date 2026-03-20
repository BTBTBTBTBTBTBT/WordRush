import { GameState, GameAction, GameMode, GameStatus, BoardState, GauntletStageConfig, GAUNTLET_STAGES, GAUNTLET_TOTAL_SOLUTIONS } from './types';
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

function createStageBoardsFromSolutions(
  seed: string,
  stage: GauntletStageConfig,
  solutions: string[]
): BoardState[] {
  const boards = solutions.map(sol => createBoardState(sol, stage.maxGuesses));

  if (stage.hasPrefill) {
    const allowedWords = getAllowedWords();
    boards.forEach((board, i) => {
      board.prefilledGuesses = generatePrefillGuesses(seed, board.solution, i, allowedWords);
    });
  }

  return boards;
}

function getStageSolutionSlice(allSolutions: string[], stageIndex: number): string[] {
  let offset = 0;
  for (let i = 0; i < stageIndex; i++) {
    offset += GAUNTLET_STAGES[i].boardCount;
  }
  return allSolutions.slice(offset, offset + GAUNTLET_STAGES[stageIndex].boardCount);
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
    case GameMode.GAUNTLET: {
      const allSolutions = generateSolutionsFromSeed(seed, GAUNTLET_TOTAL_SOLUTIONS);
      const firstStage = GAUNTLET_STAGES[0];
      const firstStageSolutions = getStageSolutionSlice(allSolutions, 0);
      const gauntletBoards = createStageBoardsFromSolutions(seed, firstStage, firstStageSolutions);

      return {
        mode,
        seed,
        startTime: Date.now(),
        boards: gauntletBoards,
        currentBoardIndex: 0,
        status: GameStatus.PLAYING,
        gauntlet: {
          currentStage: 0,
          totalStages: GAUNTLET_STAGES.length,
          stages: GAUNTLET_STAGES,
          stageResults: [],
          stageStartTime: Date.now(),
          allSolutions
        }
      };
    }
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
      } else if (state.mode === GameMode.GAUNTLET && state.gauntlet) {
        const stage = state.gauntlet.stages[state.gauntlet.currentStage];

        if (stage.sequential) {
          // Sequential stage (like SEQUENCE): losing any board = gauntlet lost
          if (newStatus === GameStatus.LOST) {
            gameStatus = GameStatus.LOST;
          }
          // Winning handled by NEXT_BOARD (within stage) or NEXT_STAGE (between stages)
        } else {
          // Simultaneous stage (like QUORDLE/OCTORDLE/RESCUE)
          const allComplete = newBoards.every(b => b.status !== GameStatus.PLAYING);
          if (allComplete) {
            const allWon = newBoards.every(b => b.status === GameStatus.WON);
            if (!allWon) {
              gameStatus = GameStatus.LOST;
            }
            // If allWon: stage is complete, UI will dispatch NEXT_STAGE
            // Last stage completion is handled in NEXT_STAGE
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
      // For sequential modes: advance to the next board within the current stage/game
      const currentBoard = state.boards[state.currentBoardIndex];
      if (currentBoard.status !== GameStatus.WON) {
        return state;
      }

      const nextIndex = state.currentBoardIndex + 1;
      if (nextIndex >= state.boards.length) {
        return state;
      }

      return {
        ...state,
        currentBoardIndex: nextIndex
      };
    }

    case 'NEXT_STAGE': {
      if (state.mode !== GameMode.GAUNTLET || !state.gauntlet) {
        return state;
      }

      const gauntlet = state.gauntlet;
      const currentStageConfig = gauntlet.stages[gauntlet.currentStage];

      // Verify current stage is complete (all boards won)
      const stageComplete = state.boards.every(b => b.status === GameStatus.WON);
      if (!stageComplete) {
        return state;
      }

      // Record stage result
      const stageResult = {
        stageIndex: gauntlet.currentStage,
        status: GameStatus.WON,
        guesses: state.boards.reduce((sum, b) => sum + b.guesses.length, 0),
        timeMs: Date.now() - gauntlet.stageStartTime
      };

      const newStageResults = [...gauntlet.stageResults, stageResult];
      const nextStageIndex = gauntlet.currentStage + 1;

      // If that was the last stage, the whole gauntlet is won
      if (nextStageIndex >= gauntlet.totalStages) {
        return {
          ...state,
          status: GameStatus.WON,
          gauntlet: {
            ...gauntlet,
            stageResults: newStageResults
          }
        };
      }

      // Load next stage
      const nextStage = gauntlet.stages[nextStageIndex];
      const nextSolutions = getStageSolutionSlice(gauntlet.allSolutions, nextStageIndex);
      const nextBoards = createStageBoardsFromSolutions(state.seed, nextStage, nextSolutions);

      return {
        ...state,
        boards: nextBoards,
        currentBoardIndex: 0,
        gauntlet: {
          ...gauntlet,
          currentStage: nextStageIndex,
          stageResults: newStageResults,
          stageStartTime: Date.now()
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
