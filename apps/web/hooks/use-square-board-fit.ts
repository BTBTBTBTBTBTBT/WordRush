'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { fitBoardGrid, type GridFit } from '@/lib/board-fit';

export type BoardFit = GridFit;

/**
 * §255 / FINISH_SPEC B5: one square tile size that lets `boardCount` five-wide
 * boards of `maxRows` rows fit the measured container in BOTH dimensions —
 * the shared multi-board rule (lib/board-fit.ts fitBoardGrid): every sensible
 * arrangement (2-across, 4-across, all in a row) is tried and the LARGEST tile
 * wins, so QuadWord/Succession go 4x1 on a desktop and 2x2 on a phone, while
 * OctoWord stays 4x2. Capped so a big window doesn't balloon. Shared by
 * MultiBoard, Succession and Gauntlet's stages.
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
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = fitBoardGrid({ width: r.width, height: r.height, boards: boardCount, rows: maxRows, extraBoardHeight });
      setFit((prev) => (prev && next && prev.tile === next.tile && prev.cols === next.cols && prev.boardW === next.boardW ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, boardCount, maxRows, extraBoardHeight]);
  return fit;
}
