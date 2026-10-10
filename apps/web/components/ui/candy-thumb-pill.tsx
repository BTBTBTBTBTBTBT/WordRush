'use client';

import type { CSSProperties, ReactNode } from 'react';
import { CANDY_INK, threeSlice } from '@/lib/candy-toggle';
import { gameHueShift } from '@/lib/cast-accent';

/**
 * Founder 10-10: the candy toggle's glossy thumb as a stand-alone 26 px pill (white Nunito Black 11 caps, a small glyph leading):
 * Leaderboard View board / Play and the Stats Achievements Show all / Hide. The sprite sits behind the label so a hue turn
 * (`accent`: the selected game's color; the candy art is purple, hue ~262) never tints the white label. Mirrors iOS
 * YourBoardPill + CandyPill(.thumbOn) and Android CandyThumbPill.
 */
export function CandyThumbPill({ label, icon, onClick, ariaLabel, accent, ariaExpanded, style }: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  /** A hex accent to hue-turn the pill to (animated); omit to keep the purple. */
  accent?: string;
  ariaExpanded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <button
      data-squish
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-expanded={ariaExpanded}
      className="relative inline-flex shrink-0 items-center border-0 cursor-pointer font-black uppercase"
      style={{
        height: 26, padding: '0 13px', gap: 5, fontSize: 11, letterSpacing: 0.3, whiteSpace: 'nowrap', color: CANDY_INK.on,
        textShadow: '0 1px 0 rgba(76, 29, 149, 0.45)', background: 'transparent', ...style,
      }}
    >
      <span aria-hidden="true" className="absolute inset-0 pointer-events-none"
        style={{ ...threeSlice('thumb-on', 26, '--candy-thumb'), filter: accent ? `hue-rotate(${gameHueShift(accent)}deg)` : undefined, transition: 'filter 300ms ease-in-out' }} />
      {icon != null && <span className="relative inline-flex shrink-0 items-center" aria-hidden="true">{icon}</span>}
      <span className="relative">{label}</span>
    </button>
  );
}
