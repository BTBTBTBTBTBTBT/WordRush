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
}

export interface Match {
  id: string;
  mode: GameMode;
  seed: string;
  player1: Player;
  player2: Player;
  solutions: string[];
  serverStartAt: number;
  player1State: {
    guesses: number;
    status: GameStatus;
    completedAt?: number;
  };
  player2State: {
    guesses: number;
    status: GameStatus;
    completedAt?: number;
  };
  rematchOffers: Set<string>;
}

export interface ClientToServerEvents {
  join_queue: (data: { mode: GameMode }) => void;
  leave_queue: () => void;
  submit_guess: (data: { guess: string; boardIndex?: number }) => void;
  abandon_match: () => void;
  offer_rematch: () => void;
  accept_rematch: () => void;
  decline_rematch: () => void;
}

export interface ServerToClientEvents {
  queue_status: (data: { position: number; mode: GameMode }) => void;
  match_found: (data: {
    matchId: string;
    mode: GameMode;
    serverStartAt: number;
    countdownSeconds: number;
  }) => void;
  match_start: (data: { seed: string; startTime: number }) => void;
  guess_result: (data: {
    boardIndex: number;
    isValid: boolean;
    isCorrect: boolean;
    reason?: string;
  }) => void;
  opponent_progress: (data: { attempts: number; solved: boolean }) => void;
  match_ended: (data: {
    winner: 'player' | 'opponent' | 'draw' | null;
    playerGuesses: number;
    opponentGuesses: number;
    playerTime: number;
    opponentTime: number;
  }) => void;
  rematch_offered: () => void;
  rematch_declined: () => void;
  rematch_start: (data: { matchId: string; seed: string }) => void;
  opponent_left: () => void;
  error: (data: { message: string }) => void;
}
