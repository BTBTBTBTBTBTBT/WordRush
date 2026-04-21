'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

interface GameHomeButtonProps {
  /**
   * Per-mode accent color (hex). Border + icon pick this up so the
   * button reads as part of the mode's visual identity. Fallback is
   * the Wordocious brand purple.
   */
  accentColor?: string;
  /**
   * Optional click handler. When provided, used instead of plain navigation
   * (VS pages hook this up to handleForfeit so leaving mid-match tells the
   * server the player abandoned, instead of silently disconnecting).
   */
  onClick?: () => void;
  /**
   * Override positioning. Defaults to `absolute top-2 left-2` which works
   * for every solo game header. Gauntlet uses `top-1` because its header
   * sits tighter.
   */
  positionClass?: string;
}

/**
 * Shared corner Home button used at the top-left of every in-game header.
 * Sized for easy tapping on mobile (44×44 per iOS HIG) and colored to
 * match the mode the player is inside, so it reads as part of the page
 * rather than a floating afterthought.
 */
export function GameHomeButton({
  accentColor = '#7c3aed',
  onClick,
  positionClass = 'absolute top-2 left-2 z-10',
}: GameHomeButtonProps) {
  const className = `${positionClass} w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95`;
  const style = {
    background: '#ffffff',
    border: `2px solid ${accentColor}`,
    boxShadow: `0 2px 0 ${accentColor}33, 0 4px 12px rgba(0,0,0,0.08)`,
  } as const;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Back to Home"
        className={className}
        style={style}
      >
        <Home className="w-5 h-5" style={{ color: accentColor }} />
      </button>
    );
  }

  return (
    <Link
      href="/"
      aria-label="Back to Home"
      className={className}
      style={style}
    >
      <Home className="w-5 h-5" style={{ color: accentColor }} />
    </Link>
  );
}
