'use client';

import { Infinity as InfinityIcon, Star, Swords } from 'lucide-react';

export type PlayMode = 'daily' | 'unlimited';

interface Props {
  value: PlayMode;
  onChange: (next: PlayMode) => void;
}

/**
 * Pro-only pill at the top of the home screen. Flips the whole home-
 * screen into "Unlimited" mode: mode cards route to non-daily URLs,
 * the Daily Challenge hero swaps to an Unlimited hero, and cards
 * never show the daily-limit lock (Pro bypasses caps anyway, but the
 * URL difference matters so each tap lands on a fresh-seeded puzzle).
 */
export function PlayModeToggle({ value, onChange }: Props) {
  return (
    <div
      className="flex items-center p-0.5 rounded-full mb-1"
      style={{
        background: '#f3f0ff',
        border: '1.5px solid #ede9f6',
      }}
    >
      <button
        onClick={() => onChange('daily')}
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-extrabold transition-colors"
        style={{
          background: value === 'daily' ? '#ffffff' : 'transparent',
          color: value === 'daily' ? '#7c3aed' : '#9ca3af',
          boxShadow: value === 'daily' ? '0 1px 3px rgba(124,58,237,0.12)' : undefined,
        }}
      >
        <Star className="w-3.5 h-3.5" fill={value === 'daily' ? 'currentColor' : 'none'} />
        Daily
      </button>
      <button
        onClick={() => onChange('unlimited')}
        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-extrabold transition-colors"
        style={{
          background: value === 'unlimited' ? '#ffffff' : 'transparent',
          color: value === 'unlimited' ? '#7c3aed' : '#9ca3af',
          boxShadow: value === 'unlimited' ? '0 1px 3px rgba(124,58,237,0.12)' : undefined,
        }}
      >
        <InfinityIcon className="w-3.5 h-3.5" />
        Unlimited
      </button>
    </div>
  );
}

/**
 * Static hero shown under the toggle when Unlimited mode is active.
 * Replaces the Daily Challenge CTA + countdown. No action — the mode
 * cards below are the entry point into each Unlimited game.
 */
export function UnlimitedHero() {
  return (
    <div
      className="w-full flex flex-col items-center py-2.5 relative"
      style={{
        background: 'linear-gradient(135deg, #fce7f3, #ede9fe)',
        border: '1.5px solid #c4b5fd',
        borderRadius: '14px',
      }}
    >
      <div className="flex items-center gap-2">
        <InfinityIcon className="w-5 h-5" style={{ color: '#7c3aed' }} />
        <span
          className="text-lg font-black text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
        >
          Unlimited Play
        </span>
        <InfinityIcon className="w-5 h-5" style={{ color: '#ec4899' }} />
      </div>
      <div className="text-[10px] font-bold mt-0.5" style={{ color: '#7c3aed' }}>
        Infinite puzzles · All stats count
      </div>
      <div className="text-[10px] font-bold mt-0.5 inline-flex items-center gap-1" style={{ color: '#7c3aed' }}>
        Tap
        <Swords className="w-3 h-3" />
        on any game for VS
      </div>
    </div>
  );
}
