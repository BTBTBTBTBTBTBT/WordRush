'use client';

import { useEffect } from 'react';
import { haptic } from '@/lib/haptics';
import { playGameOver } from '@/lib/sounds';
import { useWordDefinition } from '@/hooks/use-word-definition';
import { useWordDefinitions } from '@/hooks/use-word-definitions';

interface GameOverAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
  solutions?: string[];
  /** §242: "Try again" button on the card — unlimited games only. */
  onPlayAgain?: () => void;
}

export function GameOverAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions, onPlayAgain }: GameOverAnimationProps) {
  useEffect(() => { haptic('medium'); playGameOver(); }, []);
  const { definition: singleDef } = useWordDefinition(solution || null);
  const multiDefs = useWordDefinitions(solutions || []);
  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5 animate-fade-in"
      style={{ backgroundColor: 'rgba(24, 24, 46, 0.6)' }}
      onClick={onComplete}
    >
      <div className="relative max-w-sm w-full animate-fade-in-scale">
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
            style={{ background: 'linear-gradient(90deg, #f87171, #ef4444, #dc2626)' }}
          />

          <div className="px-5 pt-5 pb-4">
            {/* NICE TRY header */}
            <h2
              className="text-4xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #f87171, #ef4444, #b91c1c)' }}
            >
              NICE TRY!
            </h2>

            {/* Single solution word */}
            {solution && (
              <div className="mt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>The answer was</div>
                <div className="text-2xl font-black tracking-wider" style={{ color: '#1a1a2e' }}>
                  {solution.toUpperCase()}
                </div>
              </div>
            )}

            {/* Single solution definition */}
            {solution && singleDef?.definition && (
              <div
                className="mt-3 px-4 py-3"
                style={{ background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}
              >
                {singleDef.phonetic && (
                  <div className="text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>{singleDef.phonetic}</div>
                )}
                {singleDef.partOfSpeech && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#ef4444' }}>
                    {singleDef.partOfSpeech}
                  </span>
                )}
                <p className="text-sm font-medium mt-1.5 leading-snug" style={{ color: '#4a4a6a' }}>
                  {singleDef.definition}
                </p>
              </div>
            )}

            {/* Multiple solutions (multi-board games) */}
            {!solution && solutions && solutions.length > 0 && (
              <div
                className="mt-3 px-4 py-3 max-h-48 overflow-y-auto"
                style={{
                  background: '#fef2f2',
                  borderRadius: '12px',
                  border: '1px solid #fecaca',
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>Solutions</div>
                <div className="space-y-2">
                  {solutions.map((word, i) => {
                    const def = multiDefs.get(word.toLowerCase());
                    return (
                      <div key={i}>
                        <span className="font-black tracking-wider text-sm" style={{ color: '#1a1a2e' }}>
                          {word.toUpperCase()}
                        </span>
                        {def && (
                          <p className="text-[11px] font-medium leading-snug mt-0.5" style={{ color: '#4b5563' }}>
                            {def.partOfSpeech && <span className="italic">{def.partOfSpeech}. </span>}
                            {def.definition}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stats */}
            {(guesses != null || timeSeconds != null || boardsSolved != null) && (
              <div className="flex justify-center gap-5 mt-4">
                {boardsSolved != null && totalBoards != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {boardsSolved}/{totalBoards}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>Boards Completed</div>
                  </div>
                )}
                {guesses != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {guesses}{maxGuesses ? `/${maxGuesses}` : ''}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>Guesses</div>
                  </div>
                )}
                {timeSeconds != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {formatTime(timeSeconds)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6b7280' }}>Time</div>
                  </div>
                )}
              </div>
            )}

            {/* §242: unlimited games offer another run straight from the card. */}
            {onPlayAgain && (
              <button
                onClick={(e) => { e.stopPropagation(); onPlayAgain(); }}
                className="mt-4 px-7 py-2.5 rounded-full text-sm font-black text-white active:scale-95 transition-transform"
                style={{ background: '#f87171' }}
              >
                Try again
              </button>
            )}
            <p className="text-xs font-bold mt-4" style={{ color: '#fca5a5' }}>
              Tap anywhere to continue
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
