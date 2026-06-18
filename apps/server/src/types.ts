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
  /**
   * Optional private-match token. Two clients arriving with the same
   * inviteCode get paired directly, skipping the public queue. Populated
   * from a match_invites.invite_code row on either side.
   */
  inviteCode?: string;
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
  join_queue: (data: { mode: GameMode; dailySeed?: string; inviteCode?: string }) => void;
  leave_queue: () => void;
  submit_guess: (data: { guess: string; boardIndex?: number }) => void;
  abandon_match: () => void;
  offer_rematch: () => void;
  accept_rematch: () => void;
  decline_rematch: () => void;
  board_solved: (data: { boardIndex: number }) => void;
  player_completed: (data: { status: string; totalGuesses: number; timeMs: number }) => void;
  stage_completed: (data: { stageIndex: number }) => void;
  /** Throttled "I have letters in my row" activity ping — relayed to the opponent. */
  typing: () => void;
}

export interface ServerToClientEvents {
  queue_status: (data: { position: number; mode: GameMode; queueSize?: number; dailySeed?: string | null }) => void;
  match_found: (data: {
    matchId: string;
    mode: GameMode;
    serverStartAt: number;
    countdownSeconds: number;
    /** Opponent's Supabase user id (from presenceId `u:<id>`), or null if anonymous. */
    opponentUserId?: string | null;
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
    /**
     * Opponent's Supabase user id (from their handshake presenceId `u:<id>`),
     * or null if anonymous. Lets the client write a match-history row so VS
     * shows up in Recent Matches.
     */
    opponentId: string | null;
    /**
     * True for exactly ONE of the two players (player1, when identifiable) —
     * the designated client that should INSERT the single shared matches row.
     * Avoids duplicate rows without a server-side DB write.
     */
    recordMatch: boolean;
    /** True when the match ended by the opponent disconnecting/abandoning (forfeit win). */
    forfeit?: boolean;
    /** Opponent's full ordered guess words (+ board index) — letters are only revealed at match end. */
    opponentGuessLog?: { boardIndex: number; guess: string }[];
    /** The match solutions, so the result screen can render both final boards. */
    solutions?: string[];
  }) => void;
  opponent_stage_completed: (data: { stageIndex: number }) => void;
  /** Opponent activity ping (no letters) — drives the "typing…" indicator. */
  opponent_typing: (data: Record<string, never>) => void;
  rematch_offered: () => void;
  rematch_declined: () => void;
  rematch_start: (data: { matchId: string; seed: string; puzzleMetadata?: any }) => void;
  opponent_left: () => void;
  error: (data: { message: string }) => void;
}
