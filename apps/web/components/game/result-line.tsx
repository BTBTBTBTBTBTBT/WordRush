import type { ReactNode } from 'react';
import { Icon3D } from '@/components/ui/icon3d';
import { SoftNum } from '@/components/ui/soft-number';
import { CandyButton } from '@/components/ui/candy-button';
import { SOFT, SOFT_INK, cardBarStyle, softCard, softPill } from '@/lib/soft-surface';

// The finished game screen's result line (docs/FINISH_SPEC.md B6; mockup
// finishing-touches.html): no "Home" text link (the house at the top already
// does that); the result is two tinted pills — purple guesses, blue time —
// with 3D icons and soft numbers; Share is the 3D share icon. The old
// sentence ("Solved in 4 guesses · 0:48") stays for screen readers.
// No hooks: the games pass their own handlers.

/** The pill accents. */
export const RESULT_PILL = { guesses: '#7c3aed', time: '#2563eb' } as const;

/** A small glossy stopwatch in the 3D icon style (there is no clock in the icon set). */
export function ClockGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ filter: 'drop-shadow(0 2px 2px rgba(37, 99, 235, 0.25))', flex: 'none' }}>
      <defs>
        <linearGradient id="clk-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cb4ff" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="13" y="1.5" width="6" height="4" rx="1.6" fill="#1d4ed8" />
      <circle cx="16" cy="18" r="12.5" fill="url(#clk-ring)" />
      <circle cx="16" cy="18" r="9" fill="#ffffff" />
      <path d="M16 12.4V18l3.6 2.6" stroke="#1e3a8a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <ellipse cx="12.2" cy="11.6" rx="5" ry="2.4" fill="#ffffff" opacity="0.45" transform="rotate(-24 12.2 11.6)" />
    </svg>
  );
}

/** One tinted pill: an icon, a soft number and a small label. */
export function ResultPill({ accent, icon, value, label }: { accent: string; icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" style={{ ...softPill(accent), padding: '6px 12px 5px 6px' }}>
      <span className="inline-flex items-center justify-center" style={{ width: 24, height: 24 }}>{icon}</span>
      <SoftNum size={17}>{value}</SoftNum>
      <small className="font-extrabold" style={{ fontSize: 11, color: SOFT_INK.label }}>{label}</small>
    </span>
  );
}

/** The 3D share icon as the Share control (B6), 44 px tap area, with the icon squish. */
export function ShareGlyph({ onShare, copied = false }: { onShare: () => void; copied?: boolean }) {
  return (
    <button type="button" onClick={onShare} aria-label={copied ? 'Copied' : 'Share'} className="hdr-glyph relative" style={{ width: 44, height: 44 }}>
      <Icon3D name={copied ? 'badge-check' : 'share'} size={32} />
    </button>
  );
}

interface ResultLineProps {
  won: boolean;
  /** The guess count (or mistakes / misses…) shown in the purple pill. */
  guesses: ReactNode;
  /** The purple pill's label ("guesses", "mistakes", …). */
  guessLabel?: string;
  /** The time, already formatted (0:48). */
  time: string;
  /** The old result sentence, kept for screen readers. */
  srText: string;
  onShare?: () => void;
  copied?: boolean;
  /** Extras after the share icon (the daily rank badge, Play again). */
  children?: ReactNode;
  className?: string;
}

export function ResultLine({ won, guesses, guessLabel = 'guesses', time, srText, onShare, copied, children, className = '' }: ResultLineProps) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <span className="sr-only">{srText}</span>
      <ResultPill accent={RESULT_PILL.guesses} icon={<Icon3D name={won ? 'badge-check' : 'badge-l'} size={24} />} value={guesses} label={guessLabel} />
      <ResultPill accent={RESULT_PILL.time} icon={<ClockGlyph size={22} />} value={time} label="time" />
      {onShare && <ShareGlyph onShare={onShare} copied={copied} />}
      {children}
    </div>
  );
}

/** Pro's Unlimited "Play again" / "Try again" as a small candy button (A8). */
export function PlayAgainButton({ onClick, won }: { onClick: () => void; won: boolean }) {
  return (
    <CandyButton size="sm" color="amber" icon="replay" onClick={onClick}>
      {won ? 'Play again' : 'Try again'}
    </CandyButton>
  );
}

/**
 * The More games' result card (WHITE_AUDIT lever 5: was `bg-white rounded-xl
 * p-3`): a tinted card in the game's accent with the game-card top bar.
 */
export function ResultCard({ accent, children, className = '' }: { accent: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} style={softCard(accent, { radius: 16 })}>
      <div aria-hidden="true" style={cardBarStyle(accent, SOFT.bar)} />
      <div className="flex items-center gap-3 p-3">{children}</div>
    </div>
  );
}
