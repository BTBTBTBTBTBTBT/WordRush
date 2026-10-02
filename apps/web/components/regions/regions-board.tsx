'use client';

import { memo, useRef } from 'react';
import type { RegionsState } from '@wordle-duel/core';
import { starsweepSrc } from '@/lib/art';
import { TRAY, traySeam, type TrayState } from '@/lib/game-tray';
import { GameTray } from '@/components/ui/game-tray';
import { REGIONS_ACCENT } from './copy';
import {
  STARSWEEP_TINTS, darkTint, cellSeams, starsweepCellLook, starsweepChanges,
  type StarsweepMarks, type StarsweepMotion,
} from '@/lib/starsweep-look';

// The Starsweep board (More Games §18b; FINISH_SPEC H, the new look): ONE
// board of soft glossy candy tiles. Each region is a pastel of its own hue
// (lib/starsweep-look.ts, deterministic by region index) — every tile a
// rounded square with a faint lighter top gloss and a darker bottom lip,
// sitting on its region's slightly deeper "bed"; regions are split by a wider
// darker seam in the tray's seam color (never color alone: the seams carry the shape). The marks are
// the candy pieces (art-starsweep-*): a black unjudged star = star-placed, a
// played star = star-correct (purple) or star-wrong (coral, cracked), a
// cross-out = cross, and after a loss the missing solution stars show faded.
// Motion (B3; globals.css "Starsweep" block, off with Reduce Motion): placing
// = the type pop; playing = flip + purple glow (right) or red glow + a small
// shake (wrong); a hint star = flip + gold glow. The focused cell wears a gold
// inset ring so keyboard players can see where Space and Backspace will land.
// The whole board sits in the shared game tray (FINISH_SPEC L): Starsweep's
// gold wash while playing, purple once won, slate once lost.

/** The board's outer frame (px) — the seam color around the regions. */
export const STARSWEEP_BOARD_PAD = 3;
/** The tray border (px, inactive). */
const TRAY_BORDER = 1.5;
/**
 * What the tray + seam frame add around the n × n tiles (px), for the shared
 * board-fit rule: across (both sides) and down (top, bottom + the tray lip).
 */
export const STARSWEEP_BOARD_EXTRA = {
  width: 2 * (STARSWEEP_BOARD_PAD + TRAY.padding + TRAY_BORDER),
  height: 2 * (STARSWEEP_BOARD_PAD + TRAY.padding + TRAY_BORDER) + TRAY.lip,
} as const;
/** Half of a region seam (px): each side of a seam gives this much margin. */
const SEAM_HALF = 1.5;
/** The seam between regions and around them: the tray's own soft seam (FINISH_SPEC L), never black. */
const SEAM_COLOR = traySeam(REGIONS_ACCENT, 0.55);
/** Region-bed corner radius (px) where a region turns a corner. */
const BED_RADIUS = 6;

/** Light + dark tints as inline CSS vars (the dark theme swaps them in the globals.css block). */
const TINT_VARS = STARSWEEP_TINTS.map((t) => {
  const d = darkTint(t);
  return {
    ['--ss-face-l' as string]: t.face, ['--ss-top-l' as string]: t.top, ['--ss-lip-l' as string]: t.lip, ['--ss-bed-l' as string]: t.bed,
    ['--ss-face-d' as string]: d.face, ['--ss-top-d' as string]: d.top, ['--ss-lip-d' as string]: d.lip, ['--ss-bed-d' as string]: d.bed,
  } as React.CSSProperties;
});

interface RegionsBoardProps {
  state: RegionsState;
  focused: number | null;
  onTap: (cell: number) => void;
  /** After a loss: show the missing stars, muted, so nobody leaves without the answer. */
  revealSolution?: boolean;
  /** The tray's outer width cap (px). */
  maxSize?: number;
  /** The tray wash: the game's gold while playing, purple once won, slate once lost. */
  trayState?: TrayState;
}

interface CellMotion { kind: StarsweepMotion; seq: number }

export const RegionsBoard = memo(function RegionsBoard({ state, focused, onTap, revealSolution = false, maxSize = 440, trayState = 'playing' }: RegionsBoardProps) {
  const n = state.n;
  const reg = state.regions;
  const solutionStars = new Set<number>();
  if (revealSolution) for (let r = 0; r < n; r++) solutionStars.add(r * n + (state.solution.charCodeAt(r) - 48));

  // Which cells just changed, and what they play. Kept per cell (with a
  // sequence number that remounts the tile) so an animation plays once per
  // change and a later unrelated render (a focus move) never restarts it.
  // A board that mounts (a restored save, the finished recap) plays nothing.
  const prevRef = useRef<(StarsweepMarks & { seed: string }) | null>(null);
  const motionRef = useRef<Map<number, CellMotion>>(new Map());
  const seqRef = useRef(0);
  const marks: StarsweepMarks = { board: state.board, wrongMask: state.wrongMask, hintMask: state.hintMask };
  const prev = prevRef.current;
  if (!prev || prev.seed !== state.seed) {
    motionRef.current = new Map();
  } else if (prev.board !== marks.board || prev.wrongMask !== marks.wrongMask || prev.hintMask !== marks.hintMask) {
    for (const [cell, kind] of starsweepChanges(prev, marks)) {
      if (kind) motionRef.current.set(cell, { kind, seq: ++seqRef.current });
      else motionRef.current.delete(cell);
    }
  }
  prevRef.current = { ...marks, seed: state.seed };
  const motions = motionRef.current;

  return (
    <div className="w-full mx-auto" style={{ maxWidth: maxSize }}>
      <GameTray accent={REGIONS_ACCENT} state={trayState}>
        <div
          className="ss-board w-full select-none"
          style={{
            aspectRatio: '1 / 1',
            padding: STARSWEEP_BOARD_PAD,
            borderRadius: 14,
            ['--ss-seam' as string]: SEAM_COLOR,
          } as React.CSSProperties}
          role="grid"
          aria-label="Starsweep board"
        >
          <div
            className="grid w-full h-full"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: n * n }, (_, i) => {
              const r = Math.floor(i / n), c = i % n;
              const g = reg.charCodeAt(i) - 48;
              const mark = state.board[i];
              const wrong = state.wrongMask[i] === '1';
              const missing = revealSolution && mark !== '*' && solutionStars.has(i);
              const seam = cellSeams(n, reg, i);
              const look = starsweepCellLook(mark, wrong, missing);
              const motion = motions.get(i);
              const label = `Row ${r + 1} column ${c + 1}, region ${g + 1}, ${mark === '*' ? (wrong ? 'wrong star' : 'star') : mark === 'o' ? 'black star, double-tap to play' : mark === 'x' ? 'crossed out' : 'empty'}`;
              // A seam inside the board gives half its width from each side; the board edge is the frame's.
              const m = (onSeam: boolean, edge: boolean) => (onSeam && !edge ? SEAM_HALF : 0);
              const corner = (a: boolean, b: boolean) => (a && b ? BED_RADIUS : 0);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onTap(i)}
                  className="ss-cell"
                  data-focus={i === focused ? 'true' : undefined}
                  style={{
                    ...TINT_VARS[g % TINT_VARS.length],
                    marginTop: m(seam.top, r === 0),
                    marginRight: m(seam.right, c === n - 1),
                    marginBottom: m(seam.bottom, r === n - 1),
                    marginLeft: m(seam.left, c === 0),
                    borderTopLeftRadius: corner(seam.top, seam.left),
                    borderTopRightRadius: corner(seam.top, seam.right),
                    borderBottomRightRadius: corner(seam.bottom, seam.right),
                    borderBottomLeftRadius: corner(seam.bottom, seam.left),
                  }}
                  role="gridcell"
                  aria-label={label}
                >
                  <span key={motion?.seq ?? 0} className="ss-tile" data-m={motion?.kind}>
                    <span className="ss-glow" aria-hidden="true" />
                    {look.piece && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={starsweepSrc(look.piece)}
                        width={256}
                        height={256}
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        decoding="async"
                        className="ss-piece"
                        data-muted={look.muted ? 'true' : undefined}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </GameTray>
    </div>
  );
});
