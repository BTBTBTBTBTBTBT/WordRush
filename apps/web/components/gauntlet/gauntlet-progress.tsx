'use client';

import { motion } from 'framer-motion';
import { Check, Play } from 'lucide-react';
import { GauntletStageConfig } from '@wordle-duel/core';

interface GauntletProgressProps {
  stages: GauntletStageConfig[];
  currentStage: number;
  stageResults: { stageIndex: number; status: string }[];
}

export function GauntletProgress({ stages, currentStage, stageResults }: GauntletProgressProps) {
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-3">
      {stages.map((stage, i) => {
        const isCompleted = stageResults.some(r => r.stageIndex === i);
        const isActive = i === currentStage;
        const isUpcoming = i > currentStage;

        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-6 h-0.5 mx-0.5 transition-colors duration-300 ${
                  isCompleted ? 'bg-green-400' : isActive ? 'bg-white/40' : 'bg-gray-100'
                }`}
              />
            )}
            <motion.div
              animate={isActive ? { scale: [1, 1.1, 1] } : {}}
              transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
              className={`
                relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                transition-all duration-300 border-2
                ${isCompleted
                  ? 'bg-green-500/30 border-green-400 text-green-300'
                  : isActive
                    ? 'bg-gray-200 border-white/60 text-white shadow-lg shadow-white/10'
                    : 'bg-gray-50 border-gray-200 text-white/30'
                }
              `}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" />
              ) : isActive ? (
                <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
              ) : (
                <span>{i + 1}</span>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}

export function GauntletStageHeader({ stage }: { stage: GauntletStageConfig }) {
  return (
    <div className="text-center py-2">
      <div className="text-white/50 text-xs font-medium uppercase tracking-wider">
        Stage {stage.stageIndex + 1} of 5
      </div>
      <h2 className="text-2xl font-black text-white mt-1">
        {stage.name}
      </h2>
    </div>
  );
}
