import { GameMode, GameStatus } from '@wordle-duel/core';

export interface Player {
  id: string;
  socketId: string;
  rating: number;
}

export interface QueueEntry {
  player: Player;
  mode: GameMode;
  joinedAt: number;
  /**
   * Optional deterministic seed the client wants the match to use.
   * When present, the server uses this as the match seed instead of
   * calling `generateMatchSeed()`. Used by the daily-VS flow so that
   * everyone playing their free daily VS match on the same day shares
   * the same puzzle word.
   */
  dailySeed?: string;
}

export interface PlayerMatchState {
  guesses: number;
  status: GameStatus;
  completedAt?: number;
  boardsSolved: number;
  totalBoards: number;
  currentStage?: number;
}

export interface Match {
  id: string;
  mode: GameMode;
  seed: string;
  player1: Player;
  player2: Player;
  solutions: string[];
  serverStartAt: number;
  player1State: PlayerMatchState;
  player2State: PlayerMatchState;
  rematchOffers: Set<string>;
}

export interface ClientToServerEvents {
  join_queue: (data: { mode: GameMode; dailySeed?: string }) => void;
  leave_queue: () => void;
  submit_guess: (data: { guess: string; boardIndex?: number }) => void;
  abandon_match: () => void;
  offer_rematch: () => void;
  accept_rematch: () => void;
  decline_rematch: () => void;
  board_solved: (data: { boardIndex: number }) => void;
  player_completed: (data: { status: string; totalGuesses: number; timeMs: number }) => void;
  stage_completed: (data: { stageIndex: number }) => void;
}

export interface ServerToClientEvents {
  queue_status: (data: { position: number; mode: GameMode }) => void;
  match_found: (data: {
    matchId: string;
    mode: GameMode;
    serverStartAt: number;
    countdownSeconds: number;
  }) => void;
  match_start: (data: { seed: string; startTime: number; puzzleMetadata?: any }) => void;
  guess_result: (data: {
    boardIndex: number;
    isValid: boolean;
    isCorrect: boolean;
    reason?: string;
  }) => void;
  opponent_progress: (data: {
    attempts: number;
    solved: boolean;
    boardsSolved: number;
    totalBoards: number;
    latestGuess?: { boardIndex: number; tiles: string[] };
  }) => void;
  match_ended: (data: {
    winner: 'player' | 'opponent' | 'draw' | null;
    playerGuesses: number;
    opponentGuesses: number;
    playerTime: number;
    opponentTime: number;
    playerScore: number;
    opponentScore: number;
  }) => void;
  opponent_stage_completed: (data: { stageIndex: number }) => void;
  rematch_offered: () => void;
  rematch_declined: () => void;
  rematch_start: (data: { matchId: string; seed: string; puzzleMetadata?: any }) => void;
  opponent_left: () => void;
  error: (data: { message: string }) => void;
}
