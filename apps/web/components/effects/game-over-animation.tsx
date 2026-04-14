'use client';

import { motion } from 'framer-motion';

interface GameOverAnimationProps {
  onComplete?: () => void;
  guesses?: number;
  maxGuesses?: number;
  timeSeconds?: number;
  boardsSolved?: number;
  totalBoards?: number;
  solution?: string;
  solutions?: string[];
}

export function GameOverAnimation({ onComplete, guesses, maxGuesses, timeSeconds, boardsSolved, totalBoards, solution, solutions }: GameOverAnimationProps) {
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
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#9ca3af' }}>The answer was</div>
                <div className="text-2xl font-black tracking-wider" style={{ color: '#1a1a2e' }}>
                  {solution.toUpperCase()}
                </div>
              </div>
            )}

            {/* Multiple solutions (multi-board games) */}
            {!solution && solutions && solutions.length > 0 && (
              <div
                className="mt-3 px-4 py-3"
                style={{
                  background: '#fef2f2',
                  borderRadius: '12px',
                  border: '1px solid #fecaca',
                }}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>Solutions</div>
                <div className={solutions.length === 8
                  ? 'grid grid-cols-4 gap-x-3 gap-y-1.5 justify-items-center'
                  : solutions.length === 4
                  ? 'grid grid-cols-2 gap-x-4 gap-y-1.5 justify-items-center'
                  : `flex flex-wrap justify-center gap-2 ${solutions.length > 4 ? 'gap-x-3 gap-y-1.5' : 'gap-3'}`
                }>
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
                {boardsSolved != null && totalBoards != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {boardsSolved}/{totalBoards}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Boards Completed</div>
                  </div>
                )}
                {guesses != null && (
                  <div className="text-center">
                    <div className="text-xl font-black" style={{ color: '#1a1a2e' }}>
                      {guesses}{maxGuesses ? `/${maxGuesses}` : ''}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>Guesses</div>
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

            <p className="text-xs font-bold mt-4" style={{ color: '#fca5a5' }}>
              Tap anywhere to continue
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
