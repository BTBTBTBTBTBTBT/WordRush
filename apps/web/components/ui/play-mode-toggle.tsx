'use client';

import { Star } from 'lucide-react';
import { ProPill, UnlimitedLoopArt, UNLIMITED_PEACH } from '@/components/game/finished-kit';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { softBackground, softBorder, softShadow } from '@/lib/soft-surface';

export type PlayMode = 'daily' | 'unlimited';

interface Props {
  value: PlayMode;
  onChange: (next: PlayMode) => void;
  /** R3: free players / guests see Unlimited with a PRO pill; tapping it opens the Go Pro popup. */
  isPro?: boolean;
}

/**
 * Pro-only pill at the top of the home screen. Flips the whole home-
 * screen into "Unlimited" mode: mode cards route to non-daily URLs,
 * the Daily Challenge hero swaps to an Unlimited hero, and cards
 * never show the daily-limit lock (Pro bypasses caps anyway, but the
 * URL difference matters so each tap lands on a fresh-seeded puzzle).
 */
export function PlayModeToggle({ value, onChange, isPro = true }: Props) {
  // FINISH_SPEC Y: no infinity glyph. Z: two equal fixed-width segments, one
  // font weight in both states; only the sliding thumb moves.
  return (
    <div
      className="relative flex items-center p-0.5 rounded-full mb-1"
      // FINISH_SPEC R3 / A1: a tinted segment (no plain surface).
      style={{
        background: softBackground('#7c3aed', 0.1),
        border: softBorder('#7c3aed', 0.1),
      }}
    >
      <span
        aria-hidden="true"
        className="mode-switch-thumb absolute top-0.5 bottom-0.5 left-0.5 rounded-full"
        style={{
          width: 'calc(50% - 2px)',
          transform: value === 'unlimited' ? 'translateX(100%)' : 'translateX(0)',
          background: softBackground(value === 'unlimited' ? UNLIMITED_PEACH : '#7c3aed', 0.24),
          boxShadow: '0 1px 3px rgba(124,58,237,0.12)',
        }}
      />
      <button
        onClick={() => onChange('daily')}
        aria-pressed={value === 'daily'}
        className="relative flex-1 basis-0 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap"
        style={{ color: value === 'daily' ? '#7c3aed' : '#9ca3af' }}
      >
        <Star className="w-3.5 h-3.5" fill={value === 'daily' ? 'currentColor' : 'none'} />
        Daily
      </button>
      <button
        onClick={() => (isPro ? onChange('unlimited') : openGoProPopup({ reason: 'Unlimited play' }))}
        aria-pressed={value === 'unlimited'}
        className="relative flex-1 basis-0 flex items-center justify-center gap-1 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap"
        style={{ color: value === 'unlimited' ? '#7c3aed' : '#9ca3af' }}
      >
        Unlimited
        {!isPro && <ProPill />}
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
  // FINISH_SPEC R3: the Unlimited card language — peach wash, U's candy-tile loop.
  return (
    <div
      className="w-full h-full flex items-center justify-center gap-3 py-2 px-3 relative"
      style={{ background: softBackground(UNLIMITED_PEACH, 0.14), border: softBorder(UNLIMITED_PEACH, 0.14), borderRadius: 16, boxShadow: `inset 0 4px 0 ${UNLIMITED_PEACH}, ${softShadow(UNLIMITED_PEACH, 0.14)}` }}
    >
      <UnlimitedLoopArt size={52} />
      <div className="text-left">
        <div className="flex items-center gap-1.5 text-lg font-black" style={{ color: 'var(--color-text)' }}>
          Unlimited Play
        </div>
        <div className="text-[11px] font-bold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          Fresh puzzles, no waiting · All stats count
        </div>
      </div>
    </div>
  );
}
