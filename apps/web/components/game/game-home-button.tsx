'use client';

import Link from 'next/link';
import { Icon3D } from '@/components/ui/icon3d';
import { claimHomeTap, closeAllOverlays, homeTarget } from '@/lib/nav-home';
import { GAME_HEADER_GLYPH } from '@/components/ui/page-header';

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
   * Override positioning. Defaults to top-left at `--game-corner-top` (8 px
   * when unset): a header wearing game title art sets it so the buttons keep
   * their own top row above the art (ART_SPEC §19.3, lib/art.ts gameHeaderStyle).
   * Gauntlet uses `top-1` because its header sits tighter.
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
 * Sized for easy tapping on mobile (44×44 per iOS HIG). FINISH_SPEC A3 / B4:
 * the soft 3D home icon (`tab-home`) drawn bare — no circle — 30 px (AX), with the
 * icon squish on press; `accentColor` is kept for callers but no longer tints it.
 */
export function GameHomeButton({
  onClick,
  positionClass = 'absolute top-[var(--game-corner-top,0.5rem)] left-2 z-10',
  href = '/',
}: GameHomeButtonProps) {
  const className = `${positionClass} hdr-glyph w-11 h-11 flex items-center justify-center`;
  const style = undefined;

  if (onClick) {
    return (
      <button
        type="button"
        // AY: single-fire; closes overlays; the handler itself lands on the root.
        onClick={() => { if (!claimHomeTap()) return; closeAllOverlays(); onClick(); }}
        aria-label="Back to Home"
        className={className}
        style={style}
      >
        <Icon3D name="tab-home" size={GAME_HEADER_GLYPH} priority />
      </button>
    );
  }

  return (
    <Link
      // AY: always the Home root (a push to "/", never history-back), overlays
      // closed, one navigation per tap (a double tap is dropped).
      href={homeTarget(href)}
      onClick={(e) => { if (!claimHomeTap()) { e.preventDefault(); return; } closeAllOverlays(); }}
      aria-label="Back to Home"
      className={className}
      style={style}
    >
      <Icon3D name="tab-home" size={GAME_HEADER_GLYPH} priority />
    </Link>
  );
}
