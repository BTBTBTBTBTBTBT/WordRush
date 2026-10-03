'use client';

import { Clock } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { GauntletStageConfig } from '@wordle-duel/core';
import { artSrc } from '@/lib/art';
import { GAUNTLET_HEADER, gauntletHeaderLabel, medalBox, medalStates } from '@/lib/gauntlet-header';

interface GauntletProgressProps {
  stages: GauntletStageConfig[];
  currentStage: number;
  stageResults: { stageIndex: number; status: string }[];
}

/**
 * The Gauntlet header (night art 10-03; was a row of code-drawn 20 px dots): the GAUNTLET
 * lettering over its gold track, a medallion in each socket — cleared (gold + star), current
 * (orange, white stage numeral) and locked (silver, slate numeral) — so "stage 3 of 5" reads at
 * a glance. 52 px tall: it takes the old stepper row + stage-title row, so the boards don't move
 * (the stage name rides the status line, GauntletStageHeader). The current medallion scales in
 * once per stage (transform only); nothing loops.
 */
export function GauntletProgress({ stages, currentStage, stageResults }: GauntletProgressProps) {
  const states = medalStates(stages.length, currentStage, stageResults.map((r) => r.stageIndex));
  const h = GAUNTLET_HEADER.height;
  const w = Math.round(h * GAUNTLET_HEADER.aspect);
  const name = stages[Math.min(currentStage, stages.length - 1)]?.name ?? '';
  return (
    <div className="flex justify-center px-4 pt-1">
      <div className="relative shrink-0" style={{ width: w, height: h }} role="img" aria-label={gauntletHeaderLabel(currentStage, stages.length, name)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc('art-gauntlet-header')} alt="" width={w} height={h} decoding="async" draggable={false} className="block w-full h-full select-none pointer-events-none" />
        {states.slice(0, GAUNTLET_HEADER.slots.length).map((state, i) => {
          const b = medalBox(i);
          const px = b.w * w;
          return (
            <div
              key={state === 'current' ? `c${i}` : `${state}${i}`}
              aria-hidden="true"
              className={`absolute flex items-center justify-center ${state === 'current' ? 'gauntlet-medal-in' : ''}`}
              style={{ left: `${(b.cx - b.w / 2) * 100}%`, top: `${(b.cy - b.h / 2) * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artSrc(`art-gauntlet-medal-${state}`)} alt="" decoding="async" draggable={false} className="absolute inset-0 w-full h-full select-none pointer-events-none" />
              {state !== 'cleared' && (
                <span
                  className="relative font-black leading-none tabular-nums"
                  style={{
                    fontSize: Math.round(px * GAUNTLET_HEADER.numeralScale),
                    color: state === 'current' ? '#ffffff' : '#64748b',
                    textShadow: state === 'current' ? '0 1px 2px rgba(194, 65, 12, 0.75)' : '0 1px 0 rgba(255, 255, 255, 0.6)',
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
          );
        })}
      </div>
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

  // The art header carries the GAUNTLET title + the stage medallions; the stage's own name leads
  // the one status line under it (it was an 18 px title row of its own).
  return (
    <div className="flex justify-center items-baseline gap-3 pb-0.5">
      <h2 className={`text-[13px] leading-tight font-black text-transparent bg-clip-text ${gradient}`}>
        {stage.name}
      </h2>
      {totalBoards != null && totalBoards > 1 && (
        <span className="text-gray-400 text-[10px] font-bold"><Icon3D name="trophy" size={14} inline className="mr-0.5" />{boardsSolved ?? 0}/{totalBoards}</span>
      )}
      {guessesUsed != null && maxGuesses != null && (
        <span className="text-gray-400 text-[10px] font-bold">{guessesUsed}/{maxGuesses} guesses</span>
      )}
      {elapsedTime != null && (
        <span className="text-gray-400 text-[10px] font-bold"><Clock className="w-3 h-3 inline mr-0.5 text-blue-400" />{formatTime(elapsedTime)}</span>
      )}
    </div>
  );
}
