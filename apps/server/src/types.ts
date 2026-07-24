import { GameMode, GameStatus } from '@wordle-duel/core';

export interface Player {
  id: string;
  socketId: string;
  rating: number;
  /** Stable per-person presence id from the handshake (`u:<userId>` signed-in,
   *  `a:<uuid>` anonymous), when the client sent one. Matchmaking uses it so
   *  two sockets belonging to the same person are never paired together. */
  presence?: string;
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
  /** Board indices this player has already solved (from board_solved). Used to
   *  skip solved boards when fanning out an applyToAll guess to the opponent. */
  solvedBoardSet?: Set<number>;
  /** Board indices whose solution the SERVER saw this player guess correctly
   *  (its own submit_guess evaluation) — ground truth for validating the
   *  client's player_completed "won" claim. solvedBoardSet is client-reported
   *  (board_solved events) so it can't serve that purpose. */
  serverSolvedSet?: Set<number>;
}

export interface Match {
  id: string;
  mode: GameMode;
  seed: string;
  player1: Player;
  player2: Player;
  /** Supabase user ids (from each handshake presenceId `u:<id>`), resolved at
   *  createMatch time while BOTH sockets are still connected. endMatch used to
   *  re-resolve from the live socket, which returns null once a forfeiter's
   *  socket is gone — so forfeit matches lost the opponent id and clients
   *  skipped the shared matches insert. */
  player1UserId: string | null;
  player2UserId: string | null;
  solutions: string[];
  serverStartAt: number;
  player1State: PlayerMatchState;
  player2State: PlayerMatchState;
  rematchOffers: Set<string>;
  /** Set once endMatch has run — makes endMatch idempotent (the final guess
   *  and player_completed can both trigger it) and lets /vs/counts skip
   *  finished matches kept alive only for a possible rematch. */
  ended?: boolean;
  /** 30s no-answer timer on a pending rematch offer (REMATCH_TIMEOUT). */
  rematchTimer?: ReturnType<typeof setTimeout>;
  /** Hard cap: the match resolves by current standing MATCH_MAX_DURATION_MS
   *  after its start, no matter what. Armed at create/rematch time. */
  capTimer?: ReturnType<typeof setTimeout>;
  /** Slow-finisher clock: armed when the FIRST player finishes — the other
   *  has FINISH_TIMEOUT_MS to complete or the match resolves by standing. */
  finishTimer?: ReturnType<typeof setTimeout>;
  /** Held-over forfeit timers keyed by the REBOUND playerId. A mid-match
   *  reconnect re-binds the slot but does NOT prove the player is back — the
   *  always-on presence socket shares the same `u:<userId>` handshake id and
   *  can claim the slot without having any match handlers. The forfeit stays
   *  armed until the original grace deadline; only the rebound socket's first
   *  in-match event (confirmResume) clears it. */
  resumePending?: Map<string, ReturnType<typeof setTimeout>>;
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
    /** applyToAll modes (quordle/octordle/rescue): the guess evaluated against
     *  every still-unsolved board, so the opponent's per-board mini-boards all
     *  populate. Single-board / sequence keep using `latestGuess`. */
    latestGuesses?: { boardIndex: number; tiles: string[] }[];
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
  /** Opponent left for good (explicit abandon, or their reconnect grace expired). */
  opponent_left: () => void;
  /** Opponent dropped mid-match but is within the reconnect grace window.
   *  `graceSeconds` = how long the window lasts, for a countdown banner. */
  opponent_disconnected: (data: { graceSeconds: number }) => void;
  /** A previously-disconnected opponent re-bound their socket and resumed
   *  (fires on their first in-match event, not on the mere rebind). */
  opponent_reconnected: (data: Record<string, never>) => void;
  /** Sent to a reconnecting player whose match was held open and re-bound. */
  match_resumed: (data: { matchId: string }) => void;
  error: (data: { message: string }) => void;
}
