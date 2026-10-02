'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import { fitBoard, type SingleFit, type SingleFitInput } from '@/lib/board-fit';

/**
 * FINISH_SPEC B5, single boards: measure the area between the title / status
 * line and the keyboard and hand back the biggest square-tile board that fits
 * it (lib/board-fit.ts fitBoard: full width minus a small side margin,
 * centered in the height that is left). Null until measured. Every word board
 * (Classic, Six, Seven, ProperNoundle, Gauntlet's single stages, VS Classic)
 * sizes through this; multi-board games use useSquareBoardFit (same module).
 */
export function useBoardFit(
  ref: RefObject<HTMLElement | null>,
  opts: Omit<SingleFitInput, 'width' | 'height'>,
  /** Re-measure when this changes (e.g. the measured element remounts between stages). */
  watch?: unknown,
): SingleFit | null {
  const [fit, setFit] = useState<SingleFit | null>(null);
  const { cols, rows, gap, side, vPad, maxTile, maxWidth, extraWidth } = opts;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = fitBoard({ width: r.width, height: r.height, cols, rows, gap, side, vPad, maxTile, maxWidth, extraWidth });
      setFit((prev) => (prev && next && prev.tile === next.tile && prev.gap === next.gap ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, cols, rows, gap, side, vPad, maxTile, maxWidth, extraWidth, watch]);
  return fit;
}
