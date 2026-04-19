'use client';

import { Trophy, Sparkles } from 'lucide-react';

interface Props {
  /** Total dailies completed today (W + L combined). */
  completed: number;
  /** Dailies won today. */
  wins: number;
  /** Total daily modes available. */
  total: number;
}

/**
 * Celebratory banner shown on both /profile and / (home) once the user
 * has played all N dailies today. Two variants:
 *
 * - Flawless Victory (wins === total): gold gradient + trophy.
 * - Daily Sweep      (completed === total but with losses): purple/pink
 *   wordmark gradient + sparkles.
 *
 * Returns null when dailies aren't all complete — callers can
 * unconditionally render it.
 */
export function DailySweepBanner({ completed, wins, total }: Props) {
  if (completed < total) return null;

  const flawless = wins === total;

  if (flawless) {
    return (
      <div
        className="w-full flex flex-col items-center py-3 px-4"
        style={{
          background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: '1.5px solid #f59e0b',
          borderRadius: '14px',
        }}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
          <span
            className="text-lg font-black text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #d97706, #b45309)' }}
          >
            Flawless Victory!
          </span>
          <Trophy className="w-5 h-5" style={{ color: '#b45309' }} fill="currentColor" />
        </div>
        <div className="text-[11px] font-extrabold mt-0.5" style={{ color: '#b45309' }}>
          All {total} dailies won today · +600 XP earned
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full flex flex-col items-center py-3 px-4"
      style={{
        background: 'linear-gradient(135deg, #f5f3ff, #fce7f3)',
        border: '1.5px solid #c4b5fd',
        borderRadius: '14px',
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />
        <span
          className="text-base font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
        >
          Daily Sweep!
        </span>
        <Sparkles className="w-4 h-4" style={{ color: '#ec4899' }} />
      </div>
      <div className="text-[11px] font-extrabold mt-0.5" style={{ color: '#6d28d9' }}>
        All {total} dailies completed · +200 XP earned
      </div>
    </div>
  );
}
