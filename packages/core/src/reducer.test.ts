import { describe, it, expect, beforeAll } from 'vitest';
import { createInitialState, gameReducer } from './reducer';
import { BoardState, GameMode, GameState, GameStatus, GAUNTLET_STAGES } from './types';
import { initDictionary } from './dictionary';

describe('game reducer', () => {
  beforeAll(() => {
    const solutions = ['APPLE', 'BREAD', 'CRANE', 'DELTA', 'EARTH', 'PANDA', 'PURDY'];
    const allowed = [...solutions, 'WRONG', 'TESTS', 'WORDS'];
    initDictionary(allowed, solutions);
  });

  describe('DUEL mode', () => {
    it('should create initial state with one board', () => {
      const state = createInitialState('test', GameMode.DUEL);
      expect(state.boards).toHaveLength(1);
      expect(state.mode).toBe(GameMode.DUEL);
      expect(state.status).toBe(GameStatus.PLAYING);
    });

    it('should accept valid guess', () => {
      const state = createInitialState('test', GameMode.DUEL);
      const solution = state.boards[0].solution;
      const newState = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'WRONG' });
      expect(newState.boards[0].guesses).toHaveLength(1);
    });

    it('should win on correct guess', () => {
      const state = createInitialState('test', GameMode.DUEL);
      const solution = state.boards[0].solution;
      const newState = gameReducer(state, { type: 'SUBMIT_GUESS', guess: solution });
      expect(newState.boards[0].status).toBe(GameStatus.WON);
      expect(newState.status).toBe(GameStatus.WON);
    });

    it('should lose after max guesses', () => {
      let state = createInitialState('test', GameMode.DUEL);
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'WRONG' });
      }
      expect(state.boards[0].status).toBe(GameStatus.LOST);
      expect(state.status).toBe(GameStatus.LOST);
    });
  });

  describe('MULTI_DUEL mode', () => {
    it('should create initial state with two boards', () => {
      const state = createInitialState('test', GameMode.MULTI_DUEL);
      expect(state.boards).toHaveLength(2);
      expect(state.mode).toBe(GameMode.MULTI_DUEL);
    });

    it('should allow guessing on different boards', () => {
      let state = createInitialState('test', GameMode.MULTI_DUEL);
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'WRONG', boardIndex: 0 });
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'TESTS', boardIndex: 1 });
      expect(state.boards[0].guesses).toHaveLength(1);
      expect(state.boards[1].guesses).toHaveLength(1);
    });

    it('should win if any board is won', () => {
      let state = createInitialState('test', GameMode.MULTI_DUEL);
      const solution = state.boards[0].solution;
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: solution, boardIndex: 0 });
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'WRONG', boardIndex: 1 });
      }
      expect(state.status).toBe(GameStatus.WON);
    });
  });

  describe('GAUNTLET mode', () => {
    it('should create initial state with the first stage board set', () => {
      const state = createInitialState('test', GameMode.GAUNTLET);
      // Stage 0 ("The Opening") is a single board; the full run spans
      // GAUNTLET_STAGES (5 stages, 21 boards total).
      expect(state.boards).toHaveLength(GAUNTLET_STAGES[0].boardCount);
      expect(state.mode).toBe(GameMode.GAUNTLET);
      expect(state.gauntlet).toBeDefined();
      expect(state.gauntlet?.currentStage).toBe(0);
      expect(state.gauntlet?.totalStages).toBe(GAUNTLET_STAGES.length);
      expect(state.gauntlet?.allSolutions).toHaveLength(
        GAUNTLET_STAGES.reduce((sum, s) => sum + s.boardCount, 0)
      );
    });

    it('should progress to next stage on win', () => {
      let state = createInitialState('test', GameMode.GAUNTLET);
      const solution = state.boards[0].solution;
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: solution });
      state = gameReducer(state, { type: 'NEXT_STAGE' });
      expect(state.gauntlet?.currentStage).toBe(1);
      expect(state.boards).toHaveLength(GAUNTLET_STAGES[1].boardCount);
      expect(state.currentBoardIndex).toBe(0);
      expect(state.status).toBe(GameStatus.PLAYING);
      expect(state.gauntlet?.stageResults).toHaveLength(1);
      expect(state.gauntlet?.stageResults[0].status).toBe(GameStatus.WON);
    });

    it('should lose immediately on any board loss', () => {
      let state = createInitialState('test', GameMode.GAUNTLET);
      for (let i = 0; i < 6; i++) {
        state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'WRONG' });
      }
      expect(state.status).toBe(GameStatus.LOST);
    });

    it('should win after completing all stages', () => {
      let state = createInitialState('test', GameMode.GAUNTLET);

      for (let stageIdx = 0; stageIdx < GAUNTLET_STAGES.length; stageIdx++) {
        // Win every board in the current stage by guessing its solution.
        for (let boardIdx = 0; boardIdx < state.boards.length; boardIdx++) {
          const solution = state.boards[boardIdx].solution;
          state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: solution, boardIndex: boardIdx });
        }
        expect(state.boards.every(b => b.status === GameStatus.WON)).toBe(true);
        // NEXT_STAGE loads the next stage, or marks the run WON after the last.
        state = gameReducer(state, { type: 'NEXT_STAGE' });
      }

      expect(state.status).toBe(GameStatus.WON);
      expect(state.gauntlet?.stageResults).toHaveLength(GAUNTLET_STAGES.length);
      expect(state.gauntlet?.stageResults.every(r => r.status === GameStatus.WON)).toBe(true);
    });
  });

  describe('multi-board atomic submit', () => {
    it('records the sibling-board win in a failed Gauntlet stage snapshot when the same guess simultaneously busts another board', () => {
      // Reproduces the Deliverance bug: a guess that wins one board
      // (PURDY) and busts another (PANDA) on the same submission must
      // mark both boards in the stage snapshot. Previously the snapshot
      // was frozen as soon as PANDA flipped LOST, before PURDY's board
      // was updated, leaving the results screen reporting 2/4 instead
      // of 3/4 even though the live tiles rendered PURDY all-green.
      const stageBoards: BoardState[] = [
        { solution: 'PANDA', guesses: ['CRANE', 'BREAD', 'DELTA', 'EARTH', 'WORDS'], maxGuesses: 6, status: GameStatus.PLAYING },
        { solution: 'APPLE', guesses: ['APPLE'], maxGuesses: 6, status: GameStatus.WON },
        { solution: 'PURDY', guesses: ['CRANE', 'BREAD', 'DELTA', 'EARTH', 'WORDS'], maxGuesses: 6, status: GameStatus.PLAYING },
        { solution: 'BREAD', guesses: ['BREAD'], maxGuesses: 6, status: GameStatus.WON },
      ];

      const state: GameState = {
        mode: GameMode.GAUNTLET,
        seed: 'test',
        startTime: 0,
        currentBoardIndex: 0,
        status: GameStatus.PLAYING,
        boards: stageBoards,
        gauntlet: {
          currentStage: 3,
          totalStages: GAUNTLET_STAGES.length,
          stages: GAUNTLET_STAGES,
          stageResults: [],
          stageStartTime: Date.now(),
          allSolutions: [],
          blackoutCount: 0,
        },
      };

      const newState = gameReducer(state, { type: 'SUBMIT_GUESS', guess: 'PURDY', applyToAll: true });

      expect(newState.boards[0].status).toBe(GameStatus.LOST);
      expect(newState.boards[2].status).toBe(GameStatus.WON);
      expect(newState.status).toBe(GameStatus.LOST);

      const failedStage = newState.gauntlet?.stageResults[0];
      expect(failedStage?.status).toBe(GameStatus.LOST);
      expect(failedStage?.boardsSnapshot?.[0].status).toBe(GameStatus.LOST);
      expect(failedStage?.boardsSnapshot?.[1].status).toBe(GameStatus.WON);
      expect(failedStage?.boardsSnapshot?.[2].status).toBe(GameStatus.WON);
      expect(failedStage?.boardsSnapshot?.[3].status).toBe(GameStatus.WON);
    });
  });

  describe('abandonment', () => {
    it('should abandon game', () => {
      const state = createInitialState('test', GameMode.DUEL);
      const newState = gameReducer(state, { type: 'ABANDON' });
      expect(newState.status).toBe(GameStatus.ABANDONED);
    });
  });
});
