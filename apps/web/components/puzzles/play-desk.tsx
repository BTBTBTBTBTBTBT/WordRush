'use client';

import type { CSSProperties, ReactNode } from 'react';

/**
 * The puzzle games' PLAYING screen on the wide desktop stage (founder 10-12: "the computers are
 * where people should be able to see everything the biggest and most clear"): the board gets
 * the big left column and the controls (action buttons, word lists, clues, hints, the pad) sit in
 * a right rail. On phones and tablets (< 1024 px, or a game that did not opt in with
 * `<GameBackground wide>`) every wrapper is `display: contents`, so the children stay direct items
 * of the game's flex column in the phone order: railTop, main, rail. CSS: globals.css desktop
 * block (.pz-play / .pz-main / .pz-rail-top / .pz-rail).
 */
export function PuzzlePlayDesk({ railTop, main, rail, railWidth, tall = false }: {
  /** Above the board on phones (a mode picker); first in the rail on desktop. */
  railTop?: ReactNode;
  /** The board's room: a `flex-1 min-h-0` box. */
  main: ReactNode;
  /** Below the board on phones (status line, pad, keyboard); the rail on desktop. */
  rail?: ReactNode;
  /** The desktop rail's width in px (default 340). */
  railWidth?: number;
  /** The rail holds a list that should take the whole height and scroll (clues, found words). */
  tall?: boolean;
}) {
  return (
    <div className={`pz-play contents${tall ? ' pz-tall' : ''}`} style={railWidth ? ({ ['--pz-rail' as string]: `${railWidth}px` } as CSSProperties) : undefined}>
      {railTop != null && railTop !== false && <div className="pz-rail-top contents">{railTop}</div>}
      <div className="pz-main contents">{main}</div>
      {rail != null && rail !== false && <div className="pz-rail contents">{rail}</div>}
    </div>
  );
}
