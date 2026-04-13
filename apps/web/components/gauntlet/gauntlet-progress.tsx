'use client';

import { motion } from 'framer-motion';
import { Check, Play, Clock, Trophy } from 'lucide-react';
import { GauntletStageConfig } from '@wordle-duel/core';

interface GauntletProgressProps {
  stages: GauntletStageConfig[];
  currentStage: number;
  stageResults: { stageIndex: number; status: string }[];
}

export function GauntletProgress({ stages, currentStage, stageResults }: GauntletProgressProps) {
  return (
    <div className="flex items-center justify-center gap-1 px-4 py-2">
      {stages.map((stage, i) => {
        const isCompleted = stageResults.some(r => r.stageIndex === i);
        const isActive = i === currentStage;
        const isUpcoming = i > currentStage;

        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-6 h-0.5 mx-0.5 transition-colors duration-300 ${
                  isCompleted ? 'bg-green-400' : isActive ? 'bg-purple-300' : 'bg-gray-200'
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
                  ? 'bg-green-100 border-green-400 text-green-600'
                  : isActive
                    ? 'bg-purple-100 border-purple-400 text-purple-600 shadow-lg shadow-purple-200'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
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

const STAGE_DESCRIPTIONS: Record<string, string> = {
  'The Opening': 'Classic — 1 word, 6 tries',
  'QuadWord': 'QuadWord — 4 words at once',
  'Succession': 'Succession — 4 words, one by one',
  'Deliverance': 'Deliverance — 4 boards, prefilled',
  'OctoWord': 'OctoWord — 8 boards, 13 tries',
};

const STAGE_GRADIENTS: Record<string, string> = {
  'The Opening': 'bg-gradient-to-r from-purple-400 to-pink-400',
  'QuadWord': 'bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400',
  'Succession': 'bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400',
  'Deliverance': 'bg-gradient-to-r from-indigo-400 via-purple-400 to-fuchsia-400',
  'OctoWord': 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400',
};

interface GauntletStageHeaderProps {
  stage: GauntletStageConfig;
  elapsedTime?: number;
  boardsSolved?: number;
  totalBoards?: number;
  guessesUsed?: number;
  maxGuesses?: number;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

export function GauntletStageHeader({ stage, elapsedTime, boardsSolved, totalBoards, guessesUsed, maxGuesses }: GauntletStageHeaderProps) {
  const gradient = STAGE_GRADIENTS[stage.name] || 'bg-gradient-to-r from-purple-400 to-pink-400';

  return (
    <div className="text-center py-1">
      <div className="text-gray-400 text-[10px] font-medium uppercase tracking-wider">
        Stage {stage.stageIndex + 1} of 5
      </div>
      <h2 className={`text-xl font-black text-transparent bg-clip-text ${gradient}`}>
        {stage.name}
      </h2>
      <div className="flex justify-center gap-3 mt-0.5">
        {totalBoards != null && totalBoards > 1 && (
          <span className="text-gray-400 text-[10px] font-bold"><Trophy className="w-3 h-3 inline mr-0.5 text-amber-600" />{boardsSolved ?? 0}/{totalBoards}</span>
        )}
        {guessesUsed != null && maxGuesses != null && (
          <span className="text-gray-400 text-[10px] font-bold">{guessesUsed}/{maxGuesses} guesses</span>
        )}
        {elapsedTime != null && (
          <span className="text-gray-400 text-[10px] font-bold"><Clock className="w-3 h-3 inline mr-0.5 text-blue-400" />{formatTime(elapsedTime)}</span>
        )}
      </div>
    </div>
  );
}
