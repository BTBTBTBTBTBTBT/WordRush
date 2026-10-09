'use client';

import { Star } from 'lucide-react';
import { ProPill, UnlimitedLoopArt, UNLIMITED_PEACH } from '@/components/game/finished-kit';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { CandySegment } from '@/components/ui/candy-segment';
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
  // FINISH_SPEC Y: no infinity glyph. Z: two equal fixed-width segments, one font weight in both states.
  // 2.8 item 23: the family candy segment (the same sliding thumb as every other segmented control).
  return (
    <CandySegment<PlayMode>
      label="Play mode"
      value={value}
      className="mb-1"
      onChange={(next) => (next === 'unlimited' && !isPro ? openGoProPopup({ reason: 'Unlimited play' }) : onChange(next))}
      options={[
        { key: 'daily', label: (<><Star className="w-3.5 h-3.5" fill={value === 'daily' ? 'currentColor' : 'none'} />Daily</>) },
        { key: 'unlimited', label: (<>Unlimited{!isPro && <ProPill />}</>) },
      ]}
    />
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
