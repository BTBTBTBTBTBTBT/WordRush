'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { HEADER_INK, HEADER_SHADOW } from '@/components/ui/page-header';

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
  /**
   * Where Home goes. Defaults to the home grid; the More Games titles pass
   * MORE_HOME_HREF so every exit lands back on the open More Games sheet
   * (founder + JP, 2026-09-26).
   */
  href?: string;
}

/**
 * Shared corner Home button used at the top-left of every in-game header.
 * Sized for easy tapping on mobile (44×44 per iOS HIG). HEADER_SPEC §4: the
 * back/close control is a soft white circle (no border) with the icon in
 * #6d28d9 on every screen; `accentColor` is kept for callers but no longer
 * tints it.
 */
export function GameHomeButton({
  onClick,
  positionClass = 'absolute top-2 left-2 z-10',
  href = '/',
}: GameHomeButtonProps) {
  const className = `${positionClass} w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95`;
  const style = { background: '#ffffff', boxShadow: HEADER_SHADOW } as const;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Back to Home"
        className={className}
        style={style}
      >
        <Home className="w-5 h-5" style={{ color: HEADER_INK }} strokeWidth={2.6} />
      </button>
    );
  }

  return (
    <Link
      href={href}
      aria-label="Back to Home"
      className={className}
      style={style}
    >
      <Home className="w-5 h-5" style={{ color: HEADER_INK }} strokeWidth={2.6} />
    </Link>
  );
}
