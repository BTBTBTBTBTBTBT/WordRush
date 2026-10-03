'use client';

import { useEffect, useState, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { BoardState, evaluateGuess, GameStatus, GauntletStageConfig, GauntletStageResult, TileState } from '@wordle-duel/core';
import { recordGauntletGame } from '@/lib/gauntlet-stats';
import { feedback } from '@/lib/sound-events';
import { shareResult } from '@/lib/share-utils';
import { DailyRankBadge } from '@/components/game/daily-rank-badge';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { FinishedDock } from '@/components/game/finished-kit';
import { FinishedScreen } from '@/components/game/finished-screen';
import { ClockGlyph } from '@/components/game/result-line';
import { LetterTile, tileLook } from '@/components/game/letter-tile';
import { miniBoardFrame } from '@/components/game/multi-board';
import { modeTrayAccent } from '@/lib/tray-fit';
import { SoftNum } from '@/components/ui/soft-number';
import { accentInk, alphaHex, cardBarStyle, darken, softCard, softPill } from '@/lib/soft-surface';
import { GameTray } from '@/components/ui/game-tray';
import { Confetti } from '@/components/effects/confetti';
import { ART_SIZE, artSrc } from '@/lib/art';
import { GAUNTLET_ACCENT, GAUNTLET_LOST_POSES, starRow } from '@/lib/gauntlet-look';

const CHAMPION = 'art-scene-gauntlet-champion' as const;

/** Q: one gold star of the 5-star row (filled gold, or soft gray), popping in 90 ms apart. */
function Star({ on, index, size = 30 }: { on: boolean; index: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="star-pop"
      style={{ ['--star-d' as string]: `${index * 90}ms`, filter: on ? 'drop-shadow(0 2px 2px rgba(162, 75, 14, 0.35))' : undefined } as React.CSSProperties}
    >
      <defs>
        <linearGradient id={`gstar-${on ? 'on' : 'off'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={on ? '#ffe08a' : '#e6e2ee'} />
          <stop offset="1" stopColor={on ? '#f5a524' : '#c9c3d6'} />
        </linearGradient>
      </defs>
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z" fill={`url(#gstar-${on ? 'on' : 'off'})`} stroke={on ? '#b4690e' : '#b9b2c8'} strokeWidth={1} strokeLinejoin="round" />
    </svg>
  );
}

interface GauntletResultsProps {
  won: boolean;
  stages: GauntletStageConfig[];
  stageResults: GauntletStageResult[];
  totalTimeMs: number;
  onPlayAgain: () => void;
  /** Kept for callers. R2: the dock (Next daily / Leaderboard) and the tab bar now carry the way out, so the old "Play again tomorrow" Home candy is gone. */
  onHome: () => void;
  showPlayAgain?: boolean;
  isDaily?: boolean;
  /** Whether to record this run into local gauntlet-stats on mount. False when
   *  showing a cross-device revisit (the run wasn't played on this device, so
   *  re-recording would inflate the local games-played count). */
  recordOnMount?: boolean;
  /** The daily puzzle's day (YYYY-MM-DD) — picks the scoring formula on the
   *  breakdown card (pre-cutover days render with the frozen V1 formula). */
  day?: string;
}

/** A stat tile's label in its accent's ink (legible on the dark card too). */
function StatLabel({ accent, ink, children }: { accent: string; ink: string; children: React.ReactNode }) {
  const c = accentInk(accent, ink);
  return <div className={`text-[10px] font-black uppercase mt-1 ${c.className}`} style={{ letterSpacing: '0.12em', ...c.style }}>{children}</div>;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function GauntletResults({
  won,
  stages,
  stageResults,
  totalTimeMs,
  onPlayAgain,
  showPlayAgain = true,
  isDaily,
  recordOnMount = true,
  day,
}: GauntletResultsProps) {
  const totalGuesses = stageResults.reduce((sum, r) => sum + r.guesses, 0);
  const stagesCompleted = stageResults.filter(r => r.status === GameStatus.WON).length;
  // Same cross-stage tally that gauntlet-game.tsx passes to
  // recordGameResult, so the breakdown card's composite score matches
  // the leaderboard value exactly.
  const cumulativeBoardsSolved = stageResults.reduce((sum, r) => {
    const stage = stages[r.stageIndex];
    if (!stage) return sum;
    if (r.status === GameStatus.WON) return sum + stage.boardCount;
    return sum + (r.boardsSnapshot?.filter(b => b.status === GameStatus.WON).length ?? 0);
  }, 0);
  const cumulativeTotalBoards = stages.reduce((sum, s) => sum + s.boardCount, 0) || 21;
  // Q (LOST): the failed stage's unsolved answers, revealed on glossy tiles.
  const failedResult = stageResults.find((r) => r.status === GameStatus.LOST);
  const failedAnswers = (failedResult?.boardsSnapshot ?? [])
    .filter((b) => b.status !== GameStatus.WON)
    .map((b) => b.solution.toUpperCase())
    .slice(0, 4);
  const [copied, setCopied] = useState(false);
  // Stage index currently being reviewed in the modal — null = closed.
  // Drives the "Review" modal that surfaces each stage's final board
  // state so a losing player can see exactly what word(s) they missed,
  // and a winning player can re-check the answers.
  const [reviewStageIndex, setReviewStageIndex] = useState<number | null>(null);
  const reviewStage = reviewStageIndex !== null ? stages[reviewStageIndex] : null;
  const reviewResult = reviewStageIndex !== null ? stageResults.find(r => r.stageIndex === reviewStageIndex) : null;

  const handleShare = useCallback(async () => {
    // Map each stage config to a stageResult if one exists; stages the
    // player never reached render as "unplayed" (treated as LOST in the
    // image so they visually distinguish from the cleared ones).
    const stagesForImage = stages.map((stage, i) => {
      const result = stageResults.find(r => r.stageIndex === i);
      // A cleared stage trivially solved every board. A failed stage
      // may still have partial credit — e.g. QuadWord where the player
      // solved 3 of 4 before running out of guesses. Read the exact
      // count from the snapshot we capture at stage end instead of
      // falling back to 0, which misrepresented the run and showed
      // "0/4 boards" on a stage where the player actually beat 3.
      // The leaderboard score mirrors this: a Gauntlet loss earns a
      // stage-depth ladder for each fully-cleared stage plus a small
      // per-board credit for boards solved in the failed stage
      // (see computeScoreBreakdown in lib/daily-service.ts).
      const boardsSolved = result?.status === GameStatus.WON
        ? stage.boardCount
        : result?.boardsSnapshot?.filter(b => b.status === GameStatus.WON).length ?? 0;
      return {
        name: stage.name,
        status: result?.status ?? GameStatus.LOST,
        guesses: result?.guesses ?? 0,
        boardsSolved,
        totalBoards: stage.boardCount,
      };
    });
    const out = await shareResult({
      layout: 'gauntlet',
      mode: 'Gauntlet',
      won,
      guesses: totalGuesses,
      maxGuesses: totalGuesses,
      timeSeconds: Math.floor(totalTimeMs / 1000),
      stages: stagesForImage,
      stagesCompleted,
      totalStages: stages.length,
    });
    if (out.via !== 'failed') { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }, [won, totalGuesses, totalTimeMs, stages, stageResults, stagesCompleted]);

  // Record this game on mount so the Records menu has the data — the
  // all-time stats live there now rather than cluttering this results screen.
  // Skipped on a cross-device revisit (recordOnMount=false) so we don't
  // re-count a run that wasn't played on this device.
  useEffect(() => {
    if (recordOnMount) recordGauntletGame(won, totalGuesses, totalTimeMs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // FINISH_SPEC U: Gauntlet champion = `celebrate` (with the champion scene + confetti).
  useEffect(() => { if (won) feedback('celebrate'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Q's hero scene fills the card's width at most; on a short phone it gives
  // up height first (flex-shrink), so the card + dock fit one screen (R2).
  const [cw, ch] = ART_SIZE[CHAMPION];
  // Founder 10-02: capped at 280 px and 45% of the viewport height, so the
  // hero, stars, pills and the dock fit one screen, balanced.
  const sceneMax = `min(280px, 45vh, calc((min(100vw - 24px, 512px) - 32px) * ${(ch / cw).toFixed(4)}))`;

  return (
    <div
      className="h-screen-stable flex flex-col"
      style={{
        backgroundColor: 'var(--color-bg)',
        paddingTop: 'max(12px, env(safe-area-inset-top, 0px))',
        // R2: the column ends above the docked tab bar (BottomNav publishes its room).
        paddingBottom: 'var(--bottom-nav-h, calc(env(safe-area-inset-bottom, 0px) + 76px))',
      }}
    >
      {won && <Confetti />}
      {/* FINISH_SPEC R2: one screen — Q's amber hero card sized to the room
          left, the daily rank, then the dock (Share results · Next daily /
          Leaderboard · the Unlimited card; Pro unlimited runs get NEW PUZZLE).
          The score breakdown + the per-stage rows sit under "More". */}
      <FinishedScreen
        fit="self"
        strip={null}
        sub={isDaily ? <DailyRankBadge gameMode="GAUNTLET" /> : undefined}
        board={
          // FINISH_SPEC Q: the amber hero card. WON: the champion scene springs
          // in, then bobs gently, with one confetti burst; LOST: R with cocoa +
          // I's good game (kind, never sad) and the failed stage's answer on
          // glossy tiles. Then the headline, the 5-star row and the stat pills.
          <div
            className="relative overflow-hidden text-center w-full max-w-lg max-h-full flex flex-col animate-fade-in-scale"
            style={{ ...softCard(GAUNTLET_ACCENT, { radius: 24 }), ...(won ? null : { background: `linear-gradient(${alphaHex(GAUNTLET_ACCENT, 0.07)}, ${alphaHex(GAUNTLET_ACCENT, 0.07)}), var(--color-card-base, #ffffff)` }) }}
          >
            <div aria-hidden="true" className="shrink-0" style={cardBarStyle(GAUNTLET_ACCENT)} />
            <div className="flex-1 min-h-0 flex flex-col items-center gap-2 px-4 pt-2.5 pb-3">
              {won ? (
                <div className="relative w-full min-h-0" style={{ height: sceneMax, flex: '0 1 auto' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artSrc(CHAMPION)} alt="" aria-hidden="true" width={cw} height={ch}
                    className="champ-in absolute inset-0 w-full h-full object-contain" />
                </div>
              ) : (
                <div className="relative w-full min-h-0" style={{ height: 124, flex: '0 1 auto' }}>
                  <div className="absolute inset-0 flex items-end justify-center gap-2">
                    {GAUNTLET_LOST_POSES.map((pose, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={pose} src={artSrc(pose)} alt="" aria-hidden="true" width={320} height={320}
                        className="intro-pop h-full w-auto max-h-[124px] object-contain" style={{ aspectRatio: '1 / 1', animationDelay: `${i * 120}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <h1 className="m-0 shrink-0 animate-fade-in-up">
                <SoftNum size={28} as="div" className="soft-num-auto" style={{ letterSpacing: '0.02em' }}>{won ? 'GAUNTLET CLEARED!' : 'SO CLOSE!'}</SoftNum>
              </h1>
              {/* The 5-star row: one per cleared stage (filled gold), the rest soft gray. */}
              <div className="shrink-0 flex items-center justify-center gap-1" role="img" aria-label={`${stagesCompleted} of ${stages.length || 5} stages cleared`}>
                {starRow(stages.length || 5, stagesCompleted).map((on, i) => <Star key={i} on={on} index={i} size={26} />)}
              </div>
              {/* A1 + A2: three tinted stat pills with 3D icons and soft numbers. */}
              <div className="shrink-0 grid grid-cols-3 gap-2 w-full">
                <div className="text-center" style={{ ...softPill('#f5a524', { radius: 14 }), padding: '8px 4px 6px' }}>
                  <Icon3D name="trophy" size={18} className="mx-auto mb-0.5" />
                  <SoftNum size={20} as="div" className="soft-num-auto">{stagesCompleted}/{stages.length || 5}</SoftNum>
                  <StatLabel accent="#f5a524" ink="#a2560c">Stages</StatLabel>
                </div>
                <div className="text-center" style={{ ...softPill('#2563eb', { radius: 14 }), padding: '8px 4px 6px' }}>
                  <span className="flex justify-center mb-0.5"><ClockGlyph size={18} /></span>
                  <SoftNum size={20} as="div" className="soft-num-auto">{formatTime(totalTimeMs)}</SoftNum>
                  <StatLabel accent="#2563eb" ink="#2456a8">Time</StatLabel>
                </div>
                <div className="text-center" style={{ ...softPill('#7c3aed', { radius: 14 }), padding: '8px 4px 6px' }}>
                  <Icon3D name="badge-check" size={18} className="mx-auto mb-0.5" />
                  <SoftNum size={20} as="div" className="soft-num-auto">{totalGuesses}</SoftNum>
                  <StatLabel accent="#7c3aed" ink="#6d28d9">Guesses</StatLabel>
                </div>
              </div>
              {/* LOST: the failed stage's answer(s) revealed on glossy tiles (two columns past one word). */}
              {!won && failedAnswers.length > 0 && (
                <div className="shrink-0 flex flex-col items-center gap-1 w-full" aria-label={`The answer${failedAnswers.length === 1 ? ' was' : 's were'} ${failedAnswers.join(', ')}`}>
                  <div className="text-[10px] font-black uppercase" style={{ color: darken(GAUNTLET_ACCENT, 0.35), letterSpacing: '0.12em' }}>
                    {failedAnswers.length === 1 ? 'The answer' : 'The answers'}
                  </div>
                  <div className={failedAnswers.length === 1 ? 'flex justify-center' : 'grid grid-cols-2 gap-x-3 gap-y-1 justify-items-center'}>
                    {failedAnswers.map((word) => {
                      const t = failedAnswers.length === 1 ? 30 : 24;
                      return (
                        <div key={word} className="flex gap-1" aria-hidden="true">
                          {word.split('').map((ch, k) => (
                            <LetterTile key={k} letter={ch} look="correct" pop={false} style={{ width: t, height: t, ['--gt-font' as string]: `${Math.round(t / 2)}px` } as React.CSSProperties} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        }
        dock={
          // Actions (founder 10-02: the Share results candy + countdown, then the primary candy, the Unlimited card).
          <FinishedDock
            currentMode="GAUNTLET"
            isDaily={!!isDaily}
            onShare={handleShare}
            copied={copied}
            onNewPuzzle={showPlayAgain ? onPlayAgain : undefined}
          />
        }
        moreLabel="Stages + score"
        moreAccent={GAUNTLET_ACCENT}
        more={
          <div className="flex flex-col gap-3">
            {/* Composite-score breakdown — same formula as the leaderboard. */}
            <ScoreBreakdownCard
              gameMode="GAUNTLET"
              completed={won}
              guessCount={totalGuesses}
              timeSeconds={Math.floor(totalTimeMs / 1000)}
              boardsSolved={cumulativeBoardsSolved}
              totalBoards={cumulativeTotalBoards}
              stagesCompleted={stagesCompleted}
              day={day}
            />
              {/* Per-Stage Breakdown */}
              {/* L: the per-stage rows sit on the shared game tray, each with its W / L badge. */}
              <GameTray accent={GAUNTLET_ACCENT} state={won ? 'won' : 'lost'} className="space-y-2">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Stage Breakdown</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tap a stage to see results</span>
                </div>
                {stages.map((stage, i) => {
                  const result = stageResults.find(r => r.stageIndex === i);
                  const isCompleted = result?.status === GameStatus.WON;
                  const isFailed = result?.status === GameStatus.LOST;
                  // Only offer Review when we actually captured the final
                  // boards. Older saved sessions that completed before the
                  // snapshot landed still show the summary row, just not
                  // tappable (no ">" chevron on rows, ART_SPEC §21.4).
                  const canReview = !!result?.boardsSnapshot?.length;

                  const rowContent = (
                    <>
                      <div className="flex items-center gap-3">
                        {isCompleted || isFailed ? (
                          <Icon3D name={isCompleted ? 'badge-w' : 'badge-l'} size={22} label={isCompleted ? `Stage ${i + 1} won` : `Stage ${i + 1} lost`} />
                        ) : (
                          <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-xs font-black" style={{ background: alphaHex(GAUNTLET_ACCENT, 0.12), color: 'var(--color-text-muted)' }}>
                            {i + 1}
                          </div>
                        )}
                        <span className={`font-bold ${
                          isCompleted ? 'text-violet-600' :
                          isFailed ? 'text-red-500' :
                          'text-gray-300'
                        }`}>
                          {stage.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        {result ? (
                          <>
                            <span className="text-gray-400">
                              {result.guesses} guess{result.guesses !== 1 ? 'es' : ''}
                            </span>
                            <span className="text-gray-400">
                              {formatTime(result.timeMs)}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                    </>
                  );

                  const className = `flex items-center justify-between p-3 rounded-lg w-full text-left transition-colors ${
                    isCompleted
                      ? 'bg-violet-500/10 border border-violet-400/20' + (canReview ? ' hover:bg-violet-500/20 active:bg-violet-500/20' : '')
                      : isFailed
                        ? 'bg-red-500/10 border border-red-400/20' + (canReview ? ' hover:bg-red-500/20 active:bg-red-500/20' : '')
                        : 'bg-slate-500/10 border border-slate-400/20'
                  }`;

                  return (
                    <div
                      key={i}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${0.9 + i * 0.1}s` }}
                    >
                      {canReview ? (
                        <button
                          type="button"
                          onClick={() => setReviewStageIndex(i)}
                          className={className}
                          aria-label={`Review ${stage.name}`}
                        >
                          {rowContent}
                        </button>
                      ) : (
                        <div className={className}>{rowContent}</div>
                      )}
                    </div>
                  );
                })}
              </GameTray>
          </div>
        }
      />

      {reviewStage && reviewResult?.boardsSnapshot?.length && (
          <StageReviewModal
            stage={reviewStage}
            result={reviewResult}
            onClose={() => setReviewStageIndex(null)}
          />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Stage review modal — renders the stage's final boards so a losing
// player can see which puzzle(s) ended the run plus the revealed
// solution(s). The in-app boards and MultiBoard live in a tree wired to
// the *active* game state; this component is a lightweight static
// renderer that reads directly from the snapshot captured by the reducer
// when the stage ended.
// ────────────────────────────────────────────────────────────────────────

function StageReviewModal({
  stage,
  result,
  onClose,
}: {
  stage: GauntletStageConfig;
  result: GauntletStageResult;
  onClose: () => void;
}) {
  const boards = result.boardsSnapshot ?? [];
  const won = result.status === GameStatus.WON;
  const n = boards.length;
  // Match the in-app multi-board layout: 1 board centered, 2–4 boards
  // in a 2-col grid, 8 boards in a 4-col grid. Keeps the Review visually
  // consistent with how the player saw the stage during play.
  const gridCols = n === 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-2' : 'grid-cols-4';
  const solutionsLabel = boards.length === 1 ? 'Answer' : 'Answers';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 overflow-y-auto animate-modal-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative rounded-2xl shadow-2xl w-full max-w-md h-[90vh] overflow-hidden p-5 flex flex-col animate-modal-content"
        style={{ background: 'var(--color-surface)' }}
      >
        <HeaderBack kind="close" onClick={onClose} size={32} className="absolute top-3 right-3" />

        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Stage {stage.stageIndex + 1}
          </span>
        </div>
        <h2 className={`text-2xl font-black mb-1 ${won ? 'text-violet-600' : 'text-red-400'}`}>
          {stage.name}
        </h2>
        <div className="text-xs font-bold text-gray-500 mb-4">
          {won ? 'Cleared' : 'Failed'} · {result.guesses} guess{result.guesses !== 1 ? 'es' : ''} · {formatTime(result.timeMs)}
        </div>

        {/* Solutions reveal — the whole point of this modal: show the
            words so a losing player immediately sees what they missed.
            Layout mirrors the VictoryAnimation / GameOverAnimation
            solutions grid used by the standalone multi-board modes:
            4 boards → 2×2, 8 boards → 4×2, single board → centered.
            Aligning the pill position to each board's slot in the
            MiniBoard grid below makes it trivial to eyeball "this is
            the board I failed" without reading the colors. */}
        <div className="rounded-xl px-3 py-2 mb-4" style={{ background: 'linear-gradient(#7c3aed10, #7c3aed10), var(--color-card-base, #ffffff)', border: '1.5px solid rgba(124, 58, 237, 0.18)' }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            {solutionsLabel}
          </div>
          <div
            className={
              n === 1
                ? 'flex justify-center'
                : n <= 4
                  ? 'grid grid-cols-2 gap-x-3 gap-y-1.5 justify-items-center'
                  : 'grid grid-cols-4 gap-x-3 gap-y-1.5 justify-items-center'
            }
          >
            {boards.map((b, i) => {
              const boardWon = b.status === GameStatus.WON;
              const boardFailed = !won && !boardWon;
              return (
                <span
                  key={i}
                  className={`text-xs font-black px-2 py-0.5 rounded ${
                    boardWon
                      ? 'bg-violet-100 text-violet-700'
                      : boardFailed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.solution.toUpperCase()}
                </span>
              );
            })}
          </div>
        </div>

        {/* Final board state — mirrors MiniBoard's tile rendering so the
            review looks like a paused version of the in-app stage view.
            `flex-1 min-h-0 auto-rows-fr` lets the boards shrink to fit
            the modal's remaining height instead of forcing a scrollbar
            on Wordle (1 board) and Quordle (2×2) reviews. */}
        <div className={`grid ${gridCols} gap-2 flex-1 min-h-0 auto-rows-fr`}>
          {boards.map((board, i) => (
            <StageReviewBoard key={i} board={board} stageWon={won} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageReviewBoard({ board, stageWon }: { board: BoardState; stageWon: boolean }) {
  const prefills = board.prefilledGuesses ?? [];
  const prefillCount = prefills.length;
  const totalRows = prefillCount + board.maxGuesses;
  const width = board.solution.length;
  const won = board.status === GameStatus.WON;
  const lost = !stageWon && !won;

  // Pad an empty row for any slot the player never filled, so boards at
  // the same stage render at a consistent height regardless of how far
  // each individual board got (mirrors boardToGrid's pad logic used by
  // the share image).
  const rows: Array<{ kind: 'prefill' | 'guess' | 'empty'; tiles: Array<{ letter: string; state: TileState }> }> = [];
  for (const p of prefills) {
    rows.push({ kind: 'prefill', tiles: p.evaluation.tiles.map(t => ({ letter: t.letter, state: t.state })) });
  }
  for (const guess of board.guesses) {
    const ev = evaluateGuess(board.solution, guess);
    rows.push({ kind: 'guess', tiles: ev.tiles.map(t => ({ letter: t.letter, state: t.state })) });
  }
  while (rows.length < totalRows) {
    rows.push({
      kind: 'empty',
      tiles: Array.from({ length: width }, () => ({ letter: '', state: TileState.EMPTY })),
    });
  }

  // Layout mirrors MiniBoard: the board fills its grid cell and rows
  // distribute the available height via `gridTemplateRows: 1fr`. Tiles
  // drop `aspect-square` so the row's height — not the column width —
  // determines tile height; combined with min-h-0/min-w-0 this lets the
  // whole stack shrink to fit the modal's flex-1 boards container so
  // Wordle and Quordle reviews fit on screen without scrolling.
  return (
    <div
      className="h-full min-h-0 min-w-0 flex flex-col"
      style={{ ...miniBoardFrame(won ? 'WON' : lost ? 'LOST' : 'PLAYING', modeTrayAccent('GAUNTLET'), { padding: 6 }), ['--gt-font' as string]: '11px' }}
    >
      <div
        className="grid gap-[2px] flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
      >
        {rows.map((row, rIdx) => (
          <div
            key={rIdx}
            className={`grid gap-[2px] min-h-0 ${row.kind === 'prefill' ? 'opacity-75' : ''}`}
            style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
          >
            {row.tiles.map((t, tIdx) => (
              <LetterTile
                key={tIdx}
                letter={t.letter ? t.letter.toUpperCase() : ''}
                look={tileLook(t.state, t.letter)}
                pop={false}
                className="min-h-0 min-w-0"
                style={{ aspectRatio: 'auto' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
