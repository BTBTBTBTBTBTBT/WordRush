'use client';

import { useWordDefinition } from '@/hooks/use-word-definition';
import { Home, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface PostGameSummaryProps {
  solution: string;
  won: boolean;
  guessCount: number;
  maxGuesses: number;
  timeSeconds: number;
  isDaily?: boolean;
  isPro?: boolean;
  onShare: () => void;
  onReset?: () => void;
  copied: boolean;
}

export function PostGameSummary({
  solution,
  won,
  guessCount,
  maxGuesses,
  timeSeconds,
  isDaily,
  isPro,
  onShare,
  onReset,
  copied,
}: PostGameSummaryProps) {
  const definition = useWordDefinition(solution);

  const formatTime = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div
      className="w-full max-w-[400px] mx-auto mt-2 px-4 py-3"
      style={{
        background: '#ffffff',
        border: '1.5px solid #ede9f6',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(124, 58, 237, 0.06)',
      }}
    >
      {/* Result + Solution */}
      <div className="text-center">
        {won ? (
          <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#22c55e' }}>
            Solved
          </div>
        ) : (
          <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            The word was
          </div>
        )}
        <div className="text-2xl font-black tracking-wider mt-0.5" style={{ color: '#1a1a2e' }}>
          {solution.toUpperCase()}
        </div>
      </div>

      {/* Definition */}
      {definition && (
        <div
          className="mt-2.5 px-3 py-2.5"
          style={{
            background: '#f8f7ff',
            borderRadius: '12px',
            border: '1px solid #ede9f6',
          }}
        >
          {definition.phonetic && (
            <div className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>
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

      {/* Stats */}
      <div className="flex justify-center gap-5 mt-3">
        <div className="text-center">
          <div className="text-lg font-black" style={{ color: '#1a1a2e' }}>
            {guessCount}/{maxGuesses}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            Guesses
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-black" style={{ color: '#1a1a2e' }}>
            {formatTime(timeSeconds)}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>
            Time
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 mt-3">
        <Link
          href="/"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{ color: '#9ca3af' }}
        >
          <Home className="w-3 h-3" /> Home
        </Link>
        <button
          onClick={onShare}
          className="px-4 py-1.5 rounded-lg text-xs font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow: '0 2px 0 #4c1d95',
          }}
        >
          {copied ? 'Copied!' : 'Share'}
        </button>
        {!isDaily && isPro && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
            style={{ color: '#9ca3af' }}
          >
            <RotateCcw className="w-3 h-3" /> {won ? 'Play Again' : 'Try Again'}
          </button>
        )}
      </div>
    </div>
  );
}
