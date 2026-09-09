'use client';

import { Check, Zap } from 'lucide-react';
import { GauntletStageConfig } from '@wordle-duel/core';
import { useCallback, useEffect, useRef } from 'react';

interface StageTransitionProps {
  completedStage: GauntletStageConfig;
  nextStage: GauntletStageConfig | null;
  /** VS shortens the interstitial: the OPPONENT'S CLOCK DOES NOT PAUSE for it,
   *  so a 2.5s flourish per stage is a real handicap over a 5-stage run. */
  isVersus?: boolean;
  onComplete: () => void;
}

export function StageTransition({ completedStage, nextStage, isVersus = false, onComplete }: StageTransitionProps) {
  // onComplete dispatches NEXT_STAGE, so it must fire exactly once however the
  // overlay is dismissed — timer, tap, or key. A second call would skip a stage.
  const fired = useRef(false);
  const finish = useCallback(() => {
    if (fired.current) return;
    fired.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(finish, isVersus ? 1000 : 2500);
    return () => clearTimeout(timer);
  }, [finish, isVersus]);

  // §256 (founder: "when I hit enter on tap to continue, it does nothing").
  // The overlay was click-to-skip only; the game's own key listener ignores
  // every key while the transition shows, so Enter fell on the floor and the
  // player sat out the timer. Enter and Space now dismiss it — same as a tap.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finish]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={finish}
    >
      <div className="text-center space-y-8">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-violet-500/30 border-4 border-violet-400 animate-fade-in-scale"
        >
          <Check className="w-10 h-10 text-violet-300" />
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="text-violet-400 text-sm font-bold uppercase tracking-wider mb-1">
            Stage Complete
          </div>
          <div className="text-white/60 text-lg">
            {completedStage.name}
          </div>
        </div>

        {nextStage && (
          <div
            className="space-y-2 animate-fade-in-up"
            style={{ animationDelay: '0.8s' }}
          >
            <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm font-bold uppercase tracking-wider">
              <Zap className="w-4 h-4" fill="currentColor" />
              Next Up
              <Zap className="w-4 h-4" fill="currentColor" />
            </div>
            <div
              className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400"
            >
              {nextStage.name}
            </div>
            <div className="text-white/40 text-sm">
              {nextStage.boardCount} board{nextStage.boardCount > 1 ? 's' : ''} &middot; {nextStage.maxGuesses} guesses
              {nextStage.sequential ? ' · sequential' : ''}
              {nextStage.hasPrefill ? ' · pre-filled clues' : ''}
            </div>
            {/* The overlay has ALWAYS been click-to-skip, but nothing said so —
                mid-run it read as a cutscene you had to sit through. */}
            <div className="pt-1.5 text-white/50 text-xs font-black uppercase tracking-wide">
              Tap to continue
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
