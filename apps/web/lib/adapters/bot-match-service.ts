import { GameMode, generateMatchSeed } from '@wordle-duel/core';
import type { IMatchService, MatchEndedData } from './match-service';
import { buildBotPlan, type BotPlan, type AdaptiveHint } from '@/lib/bot/bot-engine';
import { BOT_PERSONAS, type BotDifficulty, type BotTier } from '@/lib/bot/bot-personas';
import type { GhostRun } from '@/lib/bot/ghost-service';

/** Every way to pick a CPU opponent from the chooser. */
export type CpuKind = BotTier | 'adaptive' | 'ghost' | 'daily';

/** Opponent id sentinel encoding the chosen kind, e.g. "cpu:ghost". */
export function cpuOpponentIdForKind(kind: CpuKind): string {
  return `${CPU_OPPONENT_PREFIX}${kind}`;
}

/** Display identity + underlying tier for any cpu opponent id. */
export function cpuIdentity(oppId: string): { name: string; avatar: string; color: string; tier: BotTier } {
  const raw = oppId.slice(CPU_OPPONENT_PREFIX.length);
  if (raw === 'ghost') return { name: 'Your Ghost', avatar: '👻', color: '#64748b', tier: 'hard' };
  if (raw === 'daily') return { name: 'Daily Bot', avatar: '📅', color: '#f59e0b', tier: 'medium' };
  if (raw === 'adaptive') return { name: 'Adapt', avatar: '⚖️', color: '#7c3aed', tier: 'medium' };
  const p = BOT_PERSONAS[(raw as BotTier)] ?? BOT_PERSONAS.medium;
  return { name: p.name, avatar: p.avatar, color: p.color, tier: p.tier };
}

/** Extra config for special opponents (ghost pace / daily fixed seed). */
export interface BotConfig {
  adaptive?: AdaptiveHint;
  ghost?: GhostRun;
  /** Fixed puzzle seed (Bot of the Day) instead of a random one. */
  fixedSeed?: string;
  /** Opponent id sentinel — defaults to cpu:<difficulty>. */
  opponentId?: string;
}

/** The on* handler names — stored so a swap can re-register them on a new transport. */
const HANDLER_KEYS = [
  'onQueueStatus', 'onMatchFound', 'onMatchStart', 'onGuessResult', 'onOpponentProgress',
  'onOpponentTyping', 'onMatchEnded', 'onOpponentStageCompleted', 'onRematchOffered',
  'onRematchDeclined', 'onRematchStart', 'onOpponentLeft', 'onError',
] as const;

/**
 * Stable-identity facade over an `IMatchService`. vs-game registers its handlers
 * and calls connect/joinQueue on THIS object once at mount; internally it
 * forwards to a socket transport by default and can hot-swap to a
 * `LocalBotMatchService` (or back) without the component re-registering
 * anything. Swapping disconnects the old transport, re-wires the stored
 * handlers onto the new one, then connects + (re)joins.
 */
export class SwappableMatchService implements IMatchService {
  private delegate: IMatchService;
  private handlers: Record<string, (...a: any[]) => void> = {};
  private lastPresenceId?: string;
  private lastJoin?: { mode: GameMode; dailySeed?: string; inviteCode?: string };

  constructor(initial: IMatchService) {
    this.delegate = initial;
  }

  /** True while the active transport is the CPU bot. */
  get isBot(): boolean {
    return this.delegate instanceof LocalBotMatchService;
  }

  /** Replace the transport, re-registering handlers and (re)joining. */
  swap(next: IMatchService, join?: { mode: GameMode; dailySeed?: string; inviteCode?: string }): void {
    this.delegate.disconnect();
    this.delegate = next;
    for (const k of HANDLER_KEYS) {
      const cb = this.handlers[k];
      if (cb) (next as any)[k](cb);
    }
    next.connect(this.lastPresenceId);
    const j = join ?? this.lastJoin;
    if (j) next.joinQueue(j.mode, j.dailySeed, j.inviteCode);
  }

  // ── forwarded actions ──
  connect(presenceId?: string): void { this.lastPresenceId = presenceId; this.delegate.connect(presenceId); }
  disconnect(): void { this.delegate.disconnect(); }
  joinQueue(mode: GameMode, dailySeed?: string, inviteCode?: string): void {
    this.lastJoin = { mode, dailySeed, inviteCode };
    this.delegate.joinQueue(mode, dailySeed, inviteCode);
  }
  leaveQueue(): void { this.delegate.leaveQueue(); }
  submitGuess(guess: string, boardIndex?: number): void { this.delegate.submitGuess(guess, boardIndex); }
  abandonMatch(): void { this.delegate.abandonMatch(); }
  offerRematch(): void { this.delegate.offerRematch(); }
  declineRematch(): void { this.delegate.declineRematch(); }
  reportBoardSolved(boardIndex: number): void { this.delegate.reportBoardSolved(boardIndex); }
  reportCompletion(status: string, totalGuesses: number, timeMs: number): void { this.delegate.reportCompletion(status, totalGuesses, timeMs); }
  reportStageCompleted(stageIndex: number): void { this.delegate.reportStageCompleted(stageIndex); }
  emitTyping(): void { this.delegate.emitTyping(); }

  // ── stored + forwarded handlers (exact IMatchService callback types) ──
  onQueueStatus(cb: Parameters<IMatchService['onQueueStatus']>[0]): void { this.handlers.onQueueStatus = cb; this.delegate.onQueueStatus(cb); }
  onMatchFound(cb: Parameters<IMatchService['onMatchFound']>[0]): void { this.handlers.onMatchFound = cb; this.delegate.onMatchFound(cb); }
  onMatchStart(cb: Parameters<IMatchService['onMatchStart']>[0]): void { this.handlers.onMatchStart = cb; this.delegate.onMatchStart(cb); }
  onGuessResult(cb: Parameters<IMatchService['onGuessResult']>[0]): void { this.handlers.onGuessResult = cb; this.delegate.onGuessResult(cb); }
  onOpponentProgress(cb: Parameters<IMatchService['onOpponentProgress']>[0]): void { this.handlers.onOpponentProgress = cb; this.delegate.onOpponentProgress(cb); }
  onOpponentTyping(cb: Parameters<IMatchService['onOpponentTyping']>[0]): void { this.handlers.onOpponentTyping = cb; this.delegate.onOpponentTyping(cb); }
  onMatchEnded(cb: Parameters<IMatchService['onMatchEnded']>[0]): void { this.handlers.onMatchEnded = cb; this.delegate.onMatchEnded(cb); }
  onOpponentStageCompleted(cb: Parameters<IMatchService['onOpponentStageCompleted']>[0]): void { this.handlers.onOpponentStageCompleted = cb; this.delegate.onOpponentStageCompleted(cb); }
  onRematchOffered(cb: Parameters<IMatchService['onRematchOffered']>[0]): void { this.handlers.onRematchOffered = cb; this.delegate.onRematchOffered(cb); }
  onRematchDeclined(cb: Parameters<IMatchService['onRematchDeclined']>[0]): void { this.handlers.onRematchDeclined = cb; this.delegate.onRematchDeclined(cb); }
  onRematchStart(cb: Parameters<IMatchService['onRematchStart']>[0]): void { this.handlers.onRematchStart = cb; this.delegate.onRematchStart(cb); }
  onOpponentLeft(cb: Parameters<IMatchService['onOpponentLeft']>[0]): void { this.handlers.onOpponentLeft = cb; this.delegate.onOpponentLeft(cb); }
  onError(cb: Parameters<IMatchService['onError']>[0]): void { this.handlers.onError = cb; this.delegate.onError(cb); }
}

/** Sentinel opponentUserId prefix so vs-game can detect a CPU match. */
export const CPU_OPPONENT_PREFIX = 'cpu:';

/** e.g. "cpu:hard" — encodes the difficulty in the opponent id. */
export function cpuOpponentId(difficulty: BotDifficulty): string {
  return `${CPU_OPPONENT_PREFIX}${difficulty}`;
}

/** Parse the tier out of a cpu opponent id (adaptive maps to medium persona). */
export function tierFromCpuId(id: string): BotTier {
  const raw = id.slice(CPU_OPPONENT_PREFIX.length) as BotDifficulty;
  return raw === 'adaptive' ? 'medium' : raw;
}

const MATCH_COUNTDOWN_MS = 3000; // mirror server MATCH_COUNTDOWN

/**
 * A fully client-side opponent that satisfies `IMatchService` without any
 * socket. It builds a `BotPlan` from the seed/mode/difficulty and replays it on
 * timers, driving the identical `onMatchFound` / `onMatchStart` /
 * `onOpponentProgress` / `onMatchEnded` callbacks a real socket opponent would.
 * The whole VS UI is reused unchanged. Nothing is ever recorded here — vs-game
 * routes CPU results to the separate `vs_cpu` bucket.
 */
export class LocalBotMatchService implements IMatchService {
  private difficulty: BotDifficulty;
  private adaptive?: AdaptiveHint;
  private mode: GameMode = GameMode.DUEL;
  private seed = '';
  private plan: BotPlan | null = null;

  private timers: ReturnType<typeof setTimeout>[] = [];
  private serverStartAt = 0;
  private ended = false;

  private botDone = false;
  private botTimeMs = 0;
  private playerDone = false;
  private playerBoardsSolved = 0;
  private playerResult: { status: string; guesses: number; timeMs: number } | null = null;

  // Registered callbacks
  private cbMatchFound?: (d: { matchId: string; mode: GameMode; serverStartAt: number; countdownSeconds: number; opponentUserId?: string | null }) => void;
  private cbMatchStart?: (d: { seed: string; startTime: number }) => void;
  private cbOpponentProgress?: (d: any) => void;
  private cbOpponentStageCompleted?: (d: { stageIndex: number }) => void;
  private cbOpponentTyping?: () => void;
  private cbMatchEnded?: (d: MatchEndedData) => void;
  private cbRematchStart?: (d: { matchId: string; seed: string }) => void;

  private config: BotConfig;

  constructor(difficulty: BotDifficulty, config: BotConfig = {}) {
    this.difficulty = difficulty;
    this.adaptive = config.adaptive;
    this.config = config;
  }

  private planOpts() {
    return {
      adaptive: this.adaptive,
      targetGuesses: this.config.ghost?.guessCount,
      targetSolveMs: this.config.ghost?.timeMs,
      forceSolve: this.config.ghost ? true : undefined,
    };
  }

  private schedule(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, Math.max(0, ms)));
  }
  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  connect(): void {
    /* no socket to open */
  }

  disconnect(): void {
    this.clearTimers();
  }

  joinQueue(mode: GameMode, _dailySeed?: string, _inviteCode?: string): void {
    this.mode = mode;
    // Short "searching…" beat so the transition feels natural, then found.
    this.schedule(() => this.startMatch(this.config.fixedSeed ?? generateMatchSeed()), 900);
  }

  private startMatch(seed: string) {
    if (this.ended) return;
    this.seed = seed;
    this.serverStartAt = Date.now() + MATCH_COUNTDOWN_MS;
    this.plan = buildBotPlan(seed, this.mode, this.difficulty, this.planOpts());
    this.botDone = false;
    this.playerDone = false;
    this.playerBoardsSolved = 0;
    this.playerResult = null;

    this.cbMatchFound?.({
      matchId: `bot-${this.serverStartAt}`,
      mode: this.mode,
      serverStartAt: this.serverStartAt,
      countdownSeconds: MATCH_COUNTDOWN_MS / 1000,
      opponentUserId: this.config.opponentId ?? cpuOpponentId(this.difficulty),
    });

    // After the countdown, the board goes live and the bot starts playing.
    this.schedule(() => {
      if (this.ended) return;
      this.cbMatchStart?.({ seed, startTime: this.serverStartAt });
      this.runPlan();
    }, MATCH_COUNTDOWN_MS);
  }

  private runPlan() {
    const plan = this.plan;
    if (!plan) return;
    for (const ev of plan.events) {
      this.schedule(() => {
        if (this.ended) return;
        if (ev.typing) this.cbOpponentTyping?.();
        else if (ev.progress) this.cbOpponentProgress?.(ev.progress);
      }, ev.atMs);
    }
    // Gauntlet: advance the opponent's 5-node stepper at each stage clear.
    for (const se of plan.stageEvents) {
      this.schedule(() => {
        if (this.ended) return;
        this.cbOpponentStageCompleted?.({ stageIndex: se.stageIndex });
      }, se.atMs);
    }
    // Bot finishes at the end of its plan.
    this.schedule(() => {
      if (this.ended) return;
      this.botDone = true;
      this.botTimeMs = plan.finishAtMs;
      this.maybeEnd();
    }, plan.finishAtMs);
  }

  private maybeEnd() {
    if (this.ended || !this.plan) return;
    if (!this.botDone || !this.playerDone || !this.playerResult) return;
    this.ended = true;
    this.clearTimers();

    const plan = this.plan;
    const p = this.playerResult;
    const playerWon = p.status === 'won';
    const botWon = plan.solved;
    const playerBoards = playerWon ? plan.totalBoards : this.playerBoardsSolved;
    const botBoards = plan.boardsSolved;
    const playerScore = p.guesses + p.timeMs / 1000 / 45;
    const botScore = plan.totalGuesses + this.botTimeMs / 1000 / 45;

    let winner: MatchEndedData['winner'] = null;
    if (playerWon && !botWon) winner = 'player';
    else if (botWon && !playerWon) winner = 'opponent';
    else if (playerWon && botWon) {
      if (playerBoards > botBoards) winner = 'player';
      else if (botBoards > playerBoards) winner = 'opponent';
      else if (Math.abs(playerScore - botScore) < 0.01) winner = 'draw';
      else winner = playerScore < botScore ? 'player' : 'opponent';
    }

    this.cbMatchEnded?.({
      winner,
      playerGuesses: p.guesses,
      opponentGuesses: plan.totalGuesses,
      playerTime: p.timeMs,
      opponentTime: this.botTimeMs,
      playerScore,
      opponentScore: botScore,
      opponentId: null, // never a real user → skips recordMatch / head-to-head
      recordMatch: false,
      opponentGuessLog: plan.guessLog,
      solutions: plan.solutions,
    });
  }

  // ── player-driven inputs ───────────────────────────────────────────────────
  submitGuess(_guess: string, _boardIndex?: number): void {
    /* bot doesn't need the human's words; local component renders them */
  }
  reportBoardSolved(_boardIndex: number): void {
    this.playerBoardsSolved += 1;
  }
  reportCompletion(status: string, totalGuesses: number, timeMs: number): void {
    this.playerResult = { status, guesses: totalGuesses, timeMs };
    this.playerDone = true;
    this.maybeEnd();
  }
  reportStageCompleted(_stageIndex: number): void {
    /* gauntlet CPU is a later phase */
  }
  emitTyping(): void {
    /* no relay needed */
  }

  leaveQueue(): void {
    this.clearTimers();
  }
  abandonMatch(): void {
    this.ended = true;
    this.clearTimers();
  }

  offerRematch(): void {
    // Unlimited local rematch: re-seed and replay immediately. Bot-of-the-Day
    // keeps its fixed seed; everything else re-seeds fresh.
    this.ended = false;
    this.clearTimers();
    const seed = this.config.fixedSeed ?? generateMatchSeed();
    // Start the bot's clock after the 3s rematch countdown so its guesses land
    // relative to the same start the player sees (parity with the initial match).
    this.serverStartAt = Date.now() + MATCH_COUNTDOWN_MS;
    this.plan = buildBotPlan(seed, this.mode, this.difficulty, this.planOpts());
    this.botDone = false;
    this.playerDone = false;
    this.playerBoardsSolved = 0;
    this.playerResult = null;
    this.cbRematchStart?.({ matchId: `bot-${Date.now()}`, seed });
    this.schedule(() => this.runPlan(), MATCH_COUNTDOWN_MS);
  }
  declineRematch(): void {
    /* no-op for CPU */
  }

  // ── callback registration ──────────────────────────────────────────────────
  onQueueStatus(): void {
    /* CPU never queues */
  }
  onMatchFound(cb: (d: any) => void): void {
    this.cbMatchFound = cb;
  }
  onMatchStart(cb: (d: any) => void): void {
    this.cbMatchStart = cb;
  }
  onGuessResult(): void {
    /* local component validates */
  }
  onOpponentProgress(cb: (d: any) => void): void {
    this.cbOpponentProgress = cb;
  }
  onOpponentTyping(cb: () => void): void {
    this.cbOpponentTyping = cb;
  }
  onMatchEnded(cb: (d: MatchEndedData) => void): void {
    this.cbMatchEnded = cb;
  }
  onOpponentStageCompleted(cb: (d: { stageIndex: number }) => void): void {
    this.cbOpponentStageCompleted = cb;
  }
  onRematchOffered(): void {
    /* CPU rematch is immediate */
  }
  onRematchDeclined(): void {
    /* n/a */
  }
  onRematchStart(cb: (d: any) => void): void {
    this.cbRematchStart = cb;
  }
  onOpponentLeft(): void {
    /* a bot never leaves */
  }
  onError(): void {
    /* n/a */
  }
}
