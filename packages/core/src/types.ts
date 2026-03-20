export enum GameMode {
  DUEL = 'DUEL',
  MULTI_DUEL = 'MULTI_DUEL',
  GAUNTLET = 'GAUNTLET',
  QUORDLE = 'QUORDLE',
  OCTORDLE = 'OCTORDLE',
  SEQUENCE = 'SEQUENCE',
  RESCUE = 'RESCUE',
  TOURNAMENT = 'TOURNAMENT'
}

export enum TileState {
  CORRECT = 'CORRECT',
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  EMPTY = 'EMPTY'
}

export enum GameStatus {
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
  ABANDONED = 'ABANDONED'
}

export interface TileResult {
  letter: string;
  state: TileState;
}

export interface GuessResult {
  tiles: TileResult[];
  isCorrect: boolean;
}

export interface PrefilledGuess {
  word: string;
  evaluation: GuessResult;
}

export interface BoardState {
  solution: string;
  guesses: string[];
  maxGuesses: number;
  status: GameStatus;
  prefilledGuesses?: PrefilledGuess[];
}

export interface GauntletStageConfig {
  stageIndex: number;
  name: string;
  baseMode: GameMode;
  boardCount: number;
  maxGuesses: number;
  sequential: boolean;
  hasPrefill: boolean;
}

export interface GauntletStageResult {
  stageIndex: number;
  status: GameStatus;
  guesses: number;
  timeMs: number;
}

export interface GauntletProgress {
  currentStage: number;
  totalStages: number;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  stageStartTime: number;
  allSolutions: string[];
  blackoutCount: number;
}

export const GAUNTLET_STAGES: GauntletStageConfig[] = [
  { stageIndex: 0, name: 'The Opening',  baseMode: GameMode.DUEL,     boardCount: 1, maxGuesses: 6,  sequential: false, hasPrefill: false },
  { stageIndex: 1, name: 'The Quartet',  baseMode: GameMode.QUORDLE,  boardCount: 4, maxGuesses: 9,  sequential: false, hasPrefill: false },
  { stageIndex: 2, name: 'The Gauntlet', baseMode: GameMode.SEQUENCE, boardCount: 4, maxGuesses: 10, sequential: true,  hasPrefill: false },
  { stageIndex: 3, name: 'The Rescue',   baseMode: GameMode.RESCUE,   boardCount: 4, maxGuesses: 6,  sequential: false, hasPrefill: true  },
  { stageIndex: 4, name: 'The Finale',   baseMode: GameMode.OCTORDLE, boardCount: 8, maxGuesses: 13, sequential: false, hasPrefill: false },
];

export const GAUNTLET_TOTAL_SOLUTIONS = GAUNTLET_STAGES.reduce((sum, s) => sum + s.boardCount, 0);

export interface GameState {
  mode: GameMode;
  seed: string;
  startTime: number;
  boards: BoardState[];
  currentBoardIndex: number;
  status: GameStatus;
  gauntlet?: GauntletProgress;
}

export interface ScoreBreakdown {
  winBonus: number;
  guessDiff: number;
  timeDiff: number;
  dnfPenalty: number;
  total: number;
}

export interface MatchResult {
  playerWon: boolean;
  playerGuesses: number;
  opponentGuesses: number;
  playerTime: number;
  opponentTime: number;
  playerStatus: GameStatus;
  opponentStatus: GameStatus;
  score: ScoreBreakdown;
}

export type GameAction =
  | { type: 'SUBMIT_GUESS'; guess: string; boardIndex?: number }
  | { type: 'NEXT_BOARD' }
  | { type: 'NEXT_STAGE' }
  | { type: 'STEAL_GUESS' }
  | { type: 'BLACKOUT_RESTART'; boardIndex: number }
  | { type: 'ABANDON' }
  | { type: 'RESET'; seed: string; mode: GameMode };
