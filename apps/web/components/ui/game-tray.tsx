import type { CSSProperties, ReactNode } from 'react';
import { gameTrayStyle, type TrayState } from '@/lib/game-tray';

// The ONE game tray (docs/FINISH_SPEC.md L; style in lib/game-tray.ts): the
// panel every board's tiles sit on — Classic family, each QuadWord / OctoWord
// mini board, Succession / Deliverance, Sudocious, Crosswordocious, Cipher,
// Spyglass, Starsweep, Kindred, Hubbub, Ladder, Muddle's word rows and the
// Friends pocket boards. No hooks: server-safe.

export function GameTray({ accent, state = 'playing', active = false, radius, padding, className = '', style, children, as: Tag = 'div', ...rest }: {
  /** The game's catalog accent. */
  accent: string;
  /** Solved boards take a purple (won) or slate (lost) wash. */
  state?: TrayState;
  /** The active / zoomed board: stronger tint + accent ring. */
  active?: boolean;
  radius?: number;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  as?: 'div' | 'section';
  role?: string;
  'aria-label'?: string;
}) {
  return (
    <Tag className={`game-tray relative ${className}`} style={{ ...gameTrayStyle(accent, { state, active, radius, padding }), ...style }} {...rest}>
      {children}
    </Tag>
  );
}
