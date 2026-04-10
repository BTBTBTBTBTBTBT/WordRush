import { GameMode } from '@wordle-duel/core';
import { Socket, io } from 'socket.io-client';

export interface IMatchService {
  connect(): void;
  disconnect(): void;
  joinQueue(mode: GameMode): void;
  leaveQueue(): void;
  submitGuess(guess: string, boardIndex?: number): void;
  abandonMatch(): void;
  offerRematch(): void;
  declineRematch(): void;
  reportBoardSolved(boardIndex: number): void;
  reportCompletion(status: string, totalGuesses: number, timeMs: number): void;
  reportStageCompleted(stageIndex: number): void;
  onQueueStatus(callback: (data: { position: number; mode: GameMode }) => void): void;
  onMatchFound(callback: (data: { matchId: string; mode: GameMode; serverStartAt: number; countdownSeconds: number }) => void): void;
  onMatchStart(callback: (data: { seed: string; startTime: number; puzzleMetadata?: { display: string; category: string; answerLength: number; themeCategory?: string } }) => void): void;
  onGuessResult(callback: (data: { boardIndex: number; isValid: boolean; isCorrect: boolean; reason?: string }) => void): void;
  onOpponentProgress(callback: (data: { attempts: number; solved: boolean; boardsSolved: number; totalBoards: number; latestGuess?: { boardIndex: number; tiles: string[] } }) => void): void;
  onMatchEnded(callback: (data: { winner: 'player' | 'opponent' | 'draw' | null; playerGuesses: number; opponentGuesses: number; playerTime: number; opponentTime: number; playerScore: number; opponentScore: number }) => void): void;
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

  connect(): void {
    this.socket = io(this.serverUrl);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinQueue(mode: GameMode): void {
    this.socket?.emit('join_queue', { mode });
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

  onQueueStatus(callback: (data: { position: number; mode: GameMode }) => void): void {
    this.socket?.on('queue_status', callback);
  }

  onMatchFound(callback: (data: { matchId: string; mode: GameMode; serverStartAt: number; countdownSeconds: number }) => void): void {
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

  onMatchEnded(callback: (data: { winner: 'player' | 'opponent' | 'draw' | null; playerGuesses: number; opponentGuesses: number; playerTime: number; opponentTime: number; playerScore: number; opponentScore: number }) => void): void {
    this.socket?.on('match_ended', callback);
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
