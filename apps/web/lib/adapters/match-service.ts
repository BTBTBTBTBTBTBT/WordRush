import { GameMode } from '@wordle-duel/core';
import { Socket, io } from 'socket.io-client';

/** Per-board, per-row guess words revealed only at match end. */
export interface OpponentGuessLogEntry {
  boardIndex: number;
  guess: string;
}

export interface MatchEndedData {
  winner: 'player' | 'opponent' | 'draw' | null;
  playerGuesses: number;
  opponentGuesses: number;
  playerTime: number;
  opponentTime: number;
  playerScore: number;
  opponentScore: number;
  opponentId: string | null;
  recordMatch: boolean;
  /** Opponent's full ordered guess words — revealed at match end only. */
  opponentGuessLog?: OpponentGuessLogEntry[];
  /** Match solutions so the result screen can render both final boards. */
  solutions?: string[];
}

export interface IMatchService {
  connect(presenceId?: string): void;
  disconnect(): void;
  joinQueue(mode: GameMode, dailySeed?: string, inviteCode?: string): void;
  leaveQueue(): void;
  submitGuess(guess: string, boardIndex?: number): void;
  abandonMatch(): void;
  offerRematch(): void;
  declineRematch(): void;
  reportBoardSolved(boardIndex: number): void;
  reportCompletion(status: string, totalGuesses: number, timeMs: number): void;
  reportStageCompleted(stageIndex: number): void;
  /** Throttled "I have letters in my row" ping — relayed to the opponent. */
  emitTyping(): void;
  onQueueStatus(callback: (data: { position: number; mode: GameMode; queueSize?: number; dailySeed?: string | null }) => void): void;
  onMatchFound(callback: (data: { matchId: string; mode: GameMode; serverStartAt: number; countdownSeconds: number; opponentUserId?: string | null }) => void): void;
  onMatchStart(callback: (data: { seed: string; startTime: number; puzzleMetadata?: { display: string; category: string; answerLength: number; themeCategory?: string } }) => void): void;
  onGuessResult(callback: (data: { boardIndex: number; isValid: boolean; isCorrect: boolean; reason?: string }) => void): void;
  onOpponentProgress(callback: (data: { attempts: number; solved: boolean; boardsSolved: number; totalBoards: number; latestGuess?: { boardIndex: number; tiles: string[] } }) => void): void;
  onOpponentTyping(callback: () => void): void;
  onMatchEnded(callback: (data: MatchEndedData) => void): void;
  onOpponentStageCompleted(callback: (data: { stageIndex: number }) => void): void;
  onRematchOffered(callback: () => void): void;
  onRematchDeclined(callback: () => void): void;
  onRematchStart(callback: (data: { matchId: string; seed: string; puzzleMetadata?: { display: string; category: string; answerLength: number; themeCategory?: string } }) => void): void;
  onOpponentLeft(callback: () => void): void;
  onError(callback: (data: { message: string }) => void): void;
}

export class SocketIOMatchService implements IMatchService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  connect(presenceId?: string): void {
    // Pass presenceId in auth so the server's /presence count dedupes this
    // socket against any other socket from the same user/tab (notably the
    // SitePresenceProvider's socket that's already open in this tab).
    this.socket = io(this.serverUrl, presenceId ? { auth: { presenceId } } : undefined);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinQueue(mode: GameMode, dailySeed?: string, inviteCode?: string): void {
    this.socket?.emit('join_queue', { mode, dailySeed, inviteCode });
  }

  leaveQueue(): void {
    this.socket?.emit('leave_queue');
  }

  submitGuess(guess: string, boardIndex?: number): void {
    this.socket?.emit('submit_guess', { guess, boardIndex });
  }

  abandonMatch(): void {
    this.socket?.emit('abandon_match');
  }

  offerRematch(): void {
    this.socket?.emit('offer_rematch');
  }

  declineRematch(): void {
    this.socket?.emit('decline_rematch');
  }

  reportBoardSolved(boardIndex: number): void {
    this.socket?.emit('board_solved', { boardIndex });
  }

  reportCompletion(status: string, totalGuesses: number, timeMs: number): void {
    this.socket?.emit('player_completed', { status, totalGuesses, timeMs });
  }

  reportStageCompleted(stageIndex: number): void {
    this.socket?.emit('stage_completed', { stageIndex });
  }

  emitTyping(): void {
    this.socket?.emit('typing');
  }

  onQueueStatus(callback: (data: { position: number; mode: GameMode; queueSize?: number; dailySeed?: string | null }) => void): void {
    this.socket?.on('queue_status', callback);
  }

  onMatchFound(callback: (data: { matchId: string; mode: GameMode; serverStartAt: number; countdownSeconds: number; opponentUserId?: string | null }) => void): void {
    this.socket?.on('match_found', callback);
  }

  onMatchStart(callback: (data: { seed: string; startTime: number; puzzleMetadata?: { display: string; category: string; answerLength: number; themeCategory?: string } }) => void): void {
    this.socket?.on('match_start', callback);
  }

  onGuessResult(callback: (data: { boardIndex: number; isValid: boolean; isCorrect: boolean; reason?: string }) => void): void {
    this.socket?.on('guess_result', callback);
  }

  onOpponentProgress(callback: (data: { attempts: number; solved: boolean; boardsSolved: number; totalBoards: number; latestGuess?: { boardIndex: number; tiles: string[] } }) => void): void {
    this.socket?.on('opponent_progress', callback);
  }

  onMatchEnded(callback: (data: MatchEndedData) => void): void {
    this.socket?.on('match_ended', callback);
  }

  onOpponentTyping(callback: () => void): void {
    this.socket?.on('opponent_typing', callback);
  }

  onOpponentStageCompleted(callback: (data: { stageIndex: number }) => void): void {
    this.socket?.on('opponent_stage_completed', callback);
  }

  onRematchOffered(callback: () => void): void {
    this.socket?.on('rematch_offered', callback);
  }

  onRematchDeclined(callback: () => void): void {
    this.socket?.on('rematch_declined', callback);
  }

  onRematchStart(callback: (data: { matchId: string; seed: string; puzzleMetadata?: { display: string; category: string; answerLength: number; themeCategory?: string } }) => void): void {
    this.socket?.on('rematch_start', callback);
  }

  onOpponentLeft(callback: () => void): void {
    this.socket?.on('opponent_left', callback);
  }

  onError(callback: (data: { message: string }) => void): void {
    this.socket?.on('error', callback);
  }
}
