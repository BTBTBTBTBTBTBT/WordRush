'use client';

import Image from 'next/image';
import { ART_SIZE, artSrc } from '@/lib/art';
import { softBackground, softBorder, softShadow } from '@/lib/soft-surface';

interface Props {
  /** Total dailies completed today (W + L combined). */
  completed: number;
  /** Dailies won today. */
  wins: number;
  /** Total daily modes available. */
  total: number;
}

/** G4 looks: gold for a Sweep, pink for a Flawless, each with its wide cast art. */
const LOOK = {
  flawless: {
    accent: '#ec4899',
    bar: 'linear-gradient(90deg, #f9a8d4, #ec4899 55%, #c026d3)',
    art: 'art-scene-banner-flawless' as const,
    title: 'FLAWLESS VICTORY!',
    ink: '#be185d',
  },
  sweep: {
    accent: '#f5a524',
    bar: 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)',
    art: 'art-scene-banner-sweep' as const,
    title: 'DAILY SWEEP!',
    ink: '#b45309',
  },
};

/**
 * Celebratory banner once the user has played all N dailies today
 * (docs/FINISH_SPEC.md G4): a tinted banner card with its own top bar (gold
 * for a Daily Sweep, pink for a Flawless Victory) and the wide celebration
 * art beside the headline, the whole group visible.
 *
 * - Flawless Victory (wins === total).
 * - Daily Sweep      (completed === total but with losses).
 *
 * Returns null when dailies aren't all complete — callers can
 * unconditionally render it.
 */
export function DailySweepBanner({ completed, wins, total }: Props) {
  if (completed < total) return null;

  const flawless = wins === total;
  const look = flawless ? LOOK.flawless : LOOK.sweep;
  const [w, h] = ART_SIZE[look.art];

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: softBackground(look.accent, 0.14),
        border: softBorder(look.accent, 0.14),
        borderRadius: 18,
        boxShadow: softShadow(look.accent, 0.16),
      }}
    >
      <div aria-hidden="true" style={{ height: 10, background: look.bar }} />
      <div className="flex items-center gap-2 py-2 pl-4 pr-2">
        <div className="flex-1 min-w-0">
          <div className="text-lg font-black leading-tight tint-ink" style={{ color: look.ink }}>
            {look.title}
          </div>
          <div className="text-[11px] font-extrabold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {flawless
              ? <>All {total} dailies won today · +600 XP earned</>
              : <>All {total} dailies completed · +200 XP earned</>}
          </div>
        </div>
        <Image
          src={artSrc(look.art)}
          alt=""
          aria-hidden="true"
          width={w}
          height={h}
          draggable={false}
          sizes="140px"
          className="shrink-0 select-none pointer-events-none"
          style={{ height: 86, width: 'auto', maxWidth: '48%', objectFit: 'contain' }}
        />
      </div>
    </div>
  );
}
