'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Confetti, CONFETTI_PALETTES } from './confetti';
import { useCosmetics } from '@/lib/cosmetics/cosmetic-context';

interface VictoryAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
}

const VARIANT_MAP: Record<string, string> = {
  victory_fireworks: 'fireworks',
  victory_rainbow: 'rainbow',
};

export function VictoryAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution }: VictoryAnimationProps) {
  const { victoryAnimationId } = useCosmetics();
  const paletteKey = victoryAnimationId ? VARIANT_MAP[victoryAnimationId] : undefined;
  const confettiColors = paletteKey ? CONFETTI_PALETTES[paletteKey] : undefined;

  const [definition, setDefinition] = useState<{ partOfSpeech?: string; definition?: string; phonetic?: string } | null>(null);

  useEffect(() => {
    if (!solution) return;
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${solution.toLowerCase()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data[0]) {
          const entry = data[0];
          const phonetic = entry.phonetics?.find((p: any) => p.text)?.text || entry.phonetic || '';
          const meaning = entry.meanings?.[0];
          const partOfSpeech = meaning?.partOfSpeech || '';
          const def = meaning?.definitions?.[0]?.definition || '';
          setDefinition({ partOfSpeech, definition: def, phonetic });
        }
      })
      .catch(() => {});
  }, [solution]);

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onComplete}
    >
      <Confetti colors={confettiColors} />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative max-w-sm w-full"
      >
        <div
          className="relative rounded-3xl shadow-2xl p-6 text-center"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #f97316, #ec4899)' }}
        >
          {/* VICTORY header */}
          <h2
            className="text-5xl font-black text-white drop-shadow-lg mb-4"
          >
            VICTORY!
          </h2>

          {/* Word + Definition */}
          {solution && (
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-3 mb-4">
              <div className="text-3xl font-black text-white tracking-wider">{solution.toUpperCase()}</div>
              {definition?.phonetic && (
                <div className="text-sm text-white/70 font-medium mt-0.5">{definition.phonetic}</div>
              )}
              {definition?.definition && (
                <div className="mt-2">
                  {definition.partOfSpeech && (
                    <span className="text-xs font-bold text-white/60 uppercase tracking-wider">{definition.partOfSpeech}</span>
                  )}
                  <p className="text-sm text-white/90 font-medium mt-0.5 leading-snug">{definition.definition}</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {(guesses != null || timeSeconds != null || boardsSolved != null) && (
            <div className="flex justify-center gap-4 mb-3">
              {guesses != null && (
                <div className="text-center">
                  <div className="text-2xl font-black text-white">{guesses}{maxGuesses ? `/${maxGuesses}` : ''}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Guesses</div>
                </div>
              )}
              {boardsSolved != null && totalBoards != null && (
                <div className="text-center">
                  <div className="text-2xl font-black text-white">{boardsSolved}/{totalBoards}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Boards</div>
                </div>
              )}
              {timeSeconds != null && (
                <div className="text-center">
                  <div className="text-2xl font-black text-white">{formatTime(timeSeconds)}</div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Time</div>
                </div>
              )}
            </div>
          )}

          <p className="text-sm font-bold text-white/50">
            Tap anywhere to continue
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
