'use client';

import { useEffect } from 'react';
import { Confetti } from './confetti';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { haptic } from '@/lib/haptics';
import { playSuccess } from '@/lib/sounds';
import { victoryHost } from '@/lib/mascots';
import { Mascot } from '@/components/ui/mascot';
import { MomentArt } from '@/components/ui/art-title';
import { CandyButton } from '@/components/ui/candy-button';

interface VictoryAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
  solutions?: string[];
  /** Composite score of the run — a third stat on the card (founder,
   *  2026-09-22: the points are the number players care about). */
  points?: number;
  /** Label under the guess count: "Guesses" for word modes; mistake-scored
   *  modes pass "Mistakes". */
  guessLabel?: string;
  /** §242: shown as a "Play again" button on the card — pass ONLY on
   *  unlimited (non-daily) games where the caller's restart handler exists. */
  onPlayAgain?: () => void;
  /** Explicit choices in place of tap-anywhere (founder, 2026-09-28: Hubbub's
   *  "Keep playing" / "I'm done"). When supplied, the backdrop no longer
   *  dismisses and the "Tap anywhere" caption is hidden; every other game
   *  keeps the default behavior. */
  actions?: { label: string; onClick: () => void; primary?: boolean }[];
  /** The game's mode db key: its host pops in above VICTORY (docs/MASCOT_SPEC.md §5). */
  mode?: string;
}

export function VictoryAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions, points, guessLabel = 'Guesses', onPlayAgain, actions, mode }: VictoryAnimationProps) {
  useEffect(() => { haptic('heavy'); playSuccess(); }, []);
  const { definition } = useWordDefinition(solution || null);
  const hasActions = !!actions && actions.length > 0;

  // M:SS past a minute (founder, 2026-09-28: "35m 17s" wrapped inside the stat cell).
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 animate-fade-in"
      style={{ backgroundColor: 'rgba(24, 24, 46, 0.6)' }}
      onClick={hasActions ? undefined : onComplete}
    >
      <Confetti />

      <div className="relative max-w-sm w-full animate-fade-in-scale">
        {/* The game's host pops in above VICTORY, standing on the card's top edge
            so the card keeps its height (a mode without a host gets the day's
            cast member). */}
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: -66, zIndex: 2 }}>
          <Mascot id={victoryHost(mode, new Date().toDateString())} size={88} motion="pop" priority />
        </div>
        <div
          className="relative overflow-hidden text-center"
          style={{
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1.5"
            style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }}
          />

          <div className="px-5 pt-6 pb-4">
            {/* VICTORY! lettering (docs/ART_SPEC.md §6). */}
            <MomentArt moment="victory" />

            {/* Single solution word */}
            {solution && (
              <div className="mt-2 text-2xl font-black tracking-wider" style={{ color: 'var(--color-text)' }}>
                {solution.toUpperCase()}
              </div>
            )}

            {/* Definition (only shown when found) */}
            {solution && definition?.definition && (
              <div
                className="mt-3 px-4 py-3"
                style={{
                  background: 'var(--color-bg)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                }}
              >
                {definition.phonetic && (
                  <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    {definition.phonetic}
                  </div>
                )}
                {definition.partOfSpeech && (
                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-border)', color: '#a78bfa' }}
                  >
                    {definition.partOfSpeech}
                  </span>
                )}
                <p className="text-sm font-medium mt-1.5 leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                  {definition.definition}
                </p>
              </div>
            )}

            {/* Multiple solutions (multi-board games) */}
            {!solution && solutions && solutions.length > 0 && (
              <div
                className="mt-3 px-4 py-3"
                style={{
                  background: 'var(--color-bg)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className={solutions.length > 8
                  // 9+ solutions — tight 4-col grid so everything fits inside
                  // the modal without overflowing the viewport.
                  ? 'grid grid-cols-4 gap-x-2 gap-y-1 justify-items-center'
                  : solutions.length === 8
                  ? 'grid grid-cols-4 gap-x-3 gap-y-1.5 justify-items-center'
                  : solutions.length === 4
                  ? 'grid grid-cols-2 gap-x-4 gap-y-1.5 justify-items-center'
                  : `flex flex-wrap justify-center gap-2 ${solutions.length > 4 ? 'gap-x-3 gap-y-1.5' : 'gap-3'}`
                }>
                  {solutions.map((word, i) => (
                    <span
                      key={i}
                      className={`font-black tracking-wider ${
                        solutions.length > 8 ? 'text-xs' : solutions.length > 4 ? 'text-sm' : 'text-lg'
                      }`}
                      style={{ color: 'var(--color-text)' }}
                    >
                      {word.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {(guesses != null || timeSeconds != null || boardsSolved != null || points != null) && (
              <div className="flex justify-center gap-5 mt-4">
                {guesses != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                      {guesses}{maxGuesses ? `/${maxGuesses}` : ''}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{guessLabel}</div>
                  </div>
                )}
                {boardsSolved != null && totalBoards != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                      {boardsSolved}/{totalBoards}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Boards</div>
                  </div>
                )}
                {timeSeconds != null && (
                  <div className="text-center">
                    <div className={`font-black whitespace-nowrap ${formatTime(timeSeconds).length > 5 ? 'text-lg' : 'text-xl'}`} style={{ color: 'var(--color-text)' }}>
                      {formatTime(timeSeconds)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Time</div>
                  </div>
                )}
                {points != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>
                      {Math.round(points).toLocaleString()}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Points</div>
                  </div>
                )}
              </div>
            )}

            {/* §242 (founder: "go right into the next game without going
                back"): unlimited games offer the next puzzle on the card. */}
            {onPlayAgain && !hasActions && (
              <CandyButton size="md" color="purple" icon="replay" className="mt-4" onClick={(e) => { e.stopPropagation(); onPlayAgain(); }}>
                Play again
              </CandyButton>
            )}
            {hasActions ? (
              <div className="mt-4 flex justify-center gap-2 flex-wrap">
                {actions!.map((a) => (
                  <CandyButton
                    key={a.label}
                    size="md"
                    color={a.primary ? 'purple' : 'peach'}
                    onClick={(e) => { e.stopPropagation(); a.onClick(); }}
                  >
                    {a.label}
                  </CandyButton>
                ))}
              </div>
            ) : (
              <p className="text-xs font-bold mt-4" style={{ color: '#c4b5fd' }}>
                Tap anywhere to continue
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
