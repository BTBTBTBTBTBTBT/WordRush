import { GameState, GameAction, GameMode, GameStatus, BoardState, GauntletStageConfig, GauntletStageResult, GAUNTLET_STAGES, GAUNTLET_TOTAL_SOLUTIONS } from './types';
import { generateSolutionsFromSeed } from './seed';
import { evaluateGuess } from './evaluator';
import { isValidWord, getAllowedWords } from './dictionary';
import { generatePrefillGuesses, generatePrefillWords } from './prefill';

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
    const prefillWords = generatePrefillWords(seed, solutions, allowedWords);
    boards.forEach((board) => {
      board.prefilledGuesses = generatePrefillGuesses(prefillWords, board.solution);
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
          stageStartElapsedMs: 0,
          allSolutions,
          blackoutCount: 0
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
      boardCount = 4;
      maxGuesses = 10;
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
    const prefillWords = generatePrefillWords(seed, solutions, allowedWords);
    boards.forEach((board) => {
      board.prefilledGuesses = generatePrefillGuesses(prefillWords, board.solution);
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

      // NOTE: we deliberately do NOT gate on state.status here. Multi-
      // board modes (Rescue, Quordle, Octordle, Sequence, Gauntlet
      // stages) submit the same user guess as one dispatch per playing
      // board. A previous iteration of this reducer rejected any guess
      // whose first sibling-dispatch had already tipped the game into
      // LOST (e.g. the losing-guess also happened to be the answer on
      // another board — it got dropped). The per-board check below is
      // the authoritative gate; the game-status update at the bottom
      // still winds up correct either way.

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
        // A failed board ends the run immediately — same semantics as
        // every other solo mode: you ran out of guesses on a stage, you
        // are done. The previous version of this branch kept the game
        // PLAYING and let the UI trigger a Letter Blackout second-chance
        // mechanic, but that was a VS-style catch-up that didn't belong
        // in single-player and was reported as a bug (losing OctoWord
        // in the daily gauntlet would silently restart the failed board
        // instead of ending the run). VS Gauntlet still routes loss
        // accounting through state.status === LOST downstream, so it
        // picks up the new timing without any VS-specific wiring.
        const anyLost = newBoards.some(b => b.status === GameStatus.LOST);
        if (anyLost) {
          // Push the failed stage into stageResults so GauntletResults
          // renders a red "failed here" row for the stage that killed
          // the run. NEXT_STAGE only appends on successful completion,
          // so without this the failed stage would be invisible in the
          // per-stage breakdown.
          const stageGuesses = newBoards.reduce((max, b) => Math.max(max, b.guesses.length), 0);
          const stageTimeMs = Date.now() - state.gauntlet.stageStartTime;
          const failedStageResult: GauntletStageResult = {
            stageIndex: state.gauntlet.currentStage,
            status: GameStatus.LOST,
            guesses: stageGuesses,
            timeMs: stageTimeMs,
          };
          return {
            ...state,
            boards: newBoards,
            status: GameStatus.LOST,
            gauntlet: {
              ...state.gauntlet,
              stageResults: [...state.gauntlet.stageResults, failedStageResult],
            },
          };
        }
      } else if (state.mode === GameMode.QUORDLE || state.mode === GameMode.OCTORDLE || state.mode === GameMode.SEQUENCE) {
        // All these modes: every guess goes to all boards, win when all solved, lose when out of guesses
        const allComplete = newBoards.every(b => b.status !== GameStatus.PLAYING);
        if (allComplete) {
          const allWon = newBoards.every(b => b.status === GameStatus.WON);
          gameStatus = allWon ? GameStatus.WON : GameStatus.LOST;
        }
      } else if (state.mode === GameMode.RESCUE || state.mode === GameMode.TOURNAMENT) {
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

      // Stage duration preference order:
      // 1. elapsedMs from the caller (active-play clock from the solo
      //    gauntlet's useActivePlayTimer) minus stageStartElapsedMs. This
      //    excludes any time the tab was hidden.
      // 2. Wall-clock Date.now() - stageStartTime. VS gauntlet uses this
      //    path so the opponent's and our clocks agree.
      const stageTimeMs =
        action.elapsedMs !== undefined && gauntlet.stageStartElapsedMs !== undefined
          ? Math.max(0, action.elapsedMs - gauntlet.stageStartElapsedMs)
          : Date.now() - gauntlet.stageStartTime;

      // Record stage result.
      // Every guess is dispatched to all PLAYING boards simultaneously, so the
      // board that took the longest to solve always holds every guess typed
      // during this stage. Using sum would multi-count each guess per board.
      const stageResult = {
        stageIndex: gauntlet.currentStage,
        status: GameStatus.WON,
        guesses: state.boards.reduce((max, b) => Math.max(max, b.guesses.length), 0),
        timeMs: stageTimeMs
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
          stageStartTime: Date.now(),
          stageStartElapsedMs: action.elapsedMs ?? gauntlet.stageStartElapsedMs
        }
      };
    }

    case 'STEAL_GUESS': {
      // Opponent completed a stage ahead — reduce maxGuesses by 1 on all PLAYING boards
      if (state.mode !== GameMode.GAUNTLET || !state.gauntlet) return state;
      if (state.status !== GameStatus.PLAYING) return state;

      const stolenBoards = state.boards.map(b => {
        if (b.status !== GameStatus.PLAYING) return b;
        const newMax = Math.max(b.guesses.length + 1, b.maxGuesses - 1);
        return { ...b, maxGuesses: newMax };
      });

      return { ...state, boards: stolenBoards };
    }

    case 'BLACKOUT_RESTART': {
      // After Letter Blackout timer expires: reset the failed board with a new word
      if (state.mode !== GameMode.GAUNTLET || !state.gauntlet) return state;
      if (state.status !== GameStatus.PLAYING) return state;

      const { boardIndex } = action;
      const failedBoard = state.boards[boardIndex];
      if (!failedBoard || failedBoard.status !== GameStatus.LOST) return state;

      const gauntlet = state.gauntlet;
      const blackoutNum = gauntlet.blackoutCount + 1;
      const replacementSeed = `${state.seed}-blackout-${blackoutNum}`;
      const [newSolution] = generateSolutionsFromSeed(replacementSeed, 1);

      const stageConfig = gauntlet.stages[gauntlet.currentStage];
      const newBoard = createBoardState(newSolution, stageConfig.maxGuesses);

      if (stageConfig.hasPrefill) {
        const allowedWords = getAllowedWords();
        const prefillWords = generatePrefillWords(replacementSeed, [newSolution], allowedWords);
        newBoard.prefilledGuesses = generatePrefillGuesses(prefillWords, newSolution);
      }

      const newBoards = [...state.boards];
      newBoards[boardIndex] = newBoard;

      return {
        ...state,
        boards: newBoards,
        gauntlet: { ...gauntlet, blackoutCount: blackoutNum }
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

    case 'RESTORE_STATE': {
      // Replace entire state wholesale with a previously saved snapshot.
      // Used by persistence layers to resume mid-game after a remount.
      return action.state;
    }

    default:
      return state;
  }
}
