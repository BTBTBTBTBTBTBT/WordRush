'use client';

import { Check, Zap } from 'lucide-react';
import { GauntletStageConfig } from '@wordle-duel/core';
import { useEffect } from 'react';

interface StageTransitionProps {
  completedStage: GauntletStageConfig;
  nextStage: GauntletStageConfig | null;
  onComplete: () => void;
}

export function StageTransition({ completedStage, nextStage, onComplete }: StageTransitionProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onComplete}
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
          </div>
        )}
      </div>
    </div>
  );
}
