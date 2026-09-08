'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';

export interface BoardFit {
  /** Square tile edge in px. */
  tile: number;
  /** Boards per row in the arrangement that produced the biggest tile. */
  cols: number;
  /** Outer width of one board (tiles + tile gaps + padding/border) in px. */
  boardW: number;
}

/**
 * §255: one square tile size that lets `boardCount` five-wide boards of
 * `maxRows` rows fit the measured container in BOTH dimensions.
 *
 * Tries every sensible arrangement (2-across, 4-across, all in a row) and
 * keeps whichever yields the LARGEST tile — so QuadWord/Succession go 4x1 on
 * a desktop and 2x2 on a phone, while OctoWord stays 4x2. Capped so a big
 * window doesn't balloon. The founder's screenshots that drove this: boards
 * stretched to fill their grid cells, so on a wide window every tile became
 * a flat bar, and after the first square-tile fix the boards were tiny
 * because the 2x2 arrangement stacked 18 tile-rows into the height while
 * leaving the width empty. Shared by MultiBoard and Succession.
 *
 * `extraBoardHeight`: px of non-tile content under each board's grid (e.g.
 * Succession's "solution" line on a failed board), so the fit leaves room.
 */
export function useSquareBoardFit(
  ref: RefObject<HTMLElement | null>,
  boardCount: number,
  maxRows: number,
  extraBoardHeight = 0,
): BoardFit | null {
  const [fit, setFit] = useState<BoardFit | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const GAP = 8, PAD = 12, TG = 2, CAP = 56;   // board gap, p-1+border-2 both sides, tile gap, max tile
    const n = Math.max(1, boardCount);
    const candidates = [...new Set([2, 4, n].filter((c) => c >= 1 && c <= n))];
    const measure = () => {
      const r = el.getBoundingClientRect();
      let best: BoardFit | null = null;
      for (const c of candidates) {
        const rows = Math.ceil(n / c);
        const byW = ((r.width - (c - 1) * GAP) / c - PAD - 4 * TG) / 5;
        const byH = ((r.height - (rows - 1) * GAP) / rows - PAD - extraBoardHeight - (maxRows - 1) * TG) / maxRows;
        const t = Math.floor(Math.min(byW, byH, CAP));
        if (t >= 10 && (!best || t > best.tile)) best = { tile: t, cols: c, boardW: t * 5 + 4 * TG + PAD };
      }
      setFit(best);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, boardCount, maxRows, extraBoardHeight]);
  return fit;
}
