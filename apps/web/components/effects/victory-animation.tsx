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
  solutions?: string[];
}

const VARIANT_MAP: Record<string, string> = {
  victory_fireworks: 'fireworks',
  victory_rainbow: 'rainbow',
};

export function VictoryAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions }: VictoryAnimationProps) {
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
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ backgroundColor: 'rgba(24, 24, 46, 0.6)' }}
      onClick={onComplete}
    >
      <Confetti colors={confettiColors} />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative max-w-sm w-full"
      >
        <div
          className="relative overflow-hidden text-center"
          style={{
            background: '#ffffff',
            border: '1.5px solid #ede9f6',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}
        >
          {/* Top accent bar */}
          <div
            className="h-1.5"
            style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }}
          />

          <div className="px-5 pt-5 pb-4">
            {/* VICTORY header */}
            <h2
              className="text-4xl font-black text-transparent bg-clip-text"
              style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899, #fbbf24)' }}
            >
              VICTORY!
            </h2>

            {/* Single solution word */}
            {solution && (
              <div className="mt-2 text-2xl font-black tracking-wider" style={{ color: '#1a1a2e' }}>
                {solution.toUpperCase()}
              </div>
            )}

            {/* Definition (only shown when found) */}
            {solution && definition?.definition && (
              <div
                className="mt-3 px-4 py-3"
                style={{
                  background: '#f8f7ff',
                  borderRadius: '12px',
                  border: '1px solid #ede9f6',
                }}
              >
                {definition.phonetic && (
                  <div className="text-xs font-medium mb-1.5" style={{ color: '#9ca3af' }}>
                    {definition.phonetic}
                  </div>
                )}
                {definition.partOfSpeech && (
                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: '#ede9f6', color: '#a78bfa' }}
                  >
                    {definition.partOfSpeech}
                  </span>
                )}
                <p className="text-sm font-medium mt-1.5 leading-snug" style={{ color: '#4a4a6a' }}>
                  {definition.definition}
                </p>
              </div>
            )}

            {/* Multiple solutions (multi-board games) */}
            {!solution && solutions && solutions.length > 0 && (
              <div
                className="mt-3 px-4 py-3"
                style={{
                  background: '#f8f7ff',
                  borderRadius: '12px',
                  border: '1px solid #ede9f6',
                }}
              >
                <div className={`flex flex-wrap justify-center gap-2 ${solutions.length > 4 ? 'gap-x-3 gap-y-1.5' : 'gap-3'}`}>
                  {solutions.map((word, i) => (
                    <span
                      key={i}
                      className={`font-black tracking-wider ${solutions.length > 4 ? 'text-sm' : 'text-lg'}`}
                      style={{ color: '#1a1a2e' }}
                    >
                      {word.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            {(guesses != null || timeSeconds != null || boardsSolved != null) && (
              <div className="flex justify-center gap-5 mt-4">
                {guesses != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {guesses}{maxGuesses ? `/${maxGuesses}` : ''}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Guesses</div>
                  </div>
                )}
                {boardsSolved != null && totalBoards != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {boardsSolved}/{totalBoards}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Boards</div>
                  </div>
                )}
                {timeSeconds != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {formatTime(timeSeconds)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Time</div>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs font-bold mt-4" style={{ color: '#c4b5fd' }}>
              Tap anywhere to continue
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
