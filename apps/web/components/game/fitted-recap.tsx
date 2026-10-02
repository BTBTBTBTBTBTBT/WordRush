'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { CompletedBoardsRecap, type RecapBoard } from './completed-mini-board';
import { bestRecapLayout, recapCandidates, recapShape } from '@/lib/recap-fit';

/**
 * FINISH_SPEC R2: the finished multi-board recap sized to the room the
 * one-screen finished screen leaves (FinishedScreen fit="self" — this fills
 * that box and measures it). It tries the mini-grid arrangements (2 × 2 vs
 * 1 × 4, OctoWord 4 × 2 vs 2 × 4; lib/recap-fit.ts) and draws the one with the
 * biggest whole-pixel tiles — real pixels, no transform, so nothing shrinks twice.
 */
export function FittedBoardsRecap({ boards, maxTile }: { boards: RecapBoard[]; maxTile?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ cols: number; tile: number } | null>(null);
  const n = boards.length;
  // AT2: one tile size and one board height for every board (the largest board's shape).
  const { rows, cols: wordLength } = recapShape(boards);
  const cap = maxTile ?? (n > 4 ? 18 : 26);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const next = bestRecapLayout({ width: el.clientWidth, height: el.clientHeight, boards: n, wordLength, rows, maxTile: cap }, recapCandidates(n));
      setFit((prev) => (prev && prev.cols === next.cols && prev.tile === next.tile ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n, wordLength, rows, cap]);
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center">
      {fit && fit.tile > 0 && (
        <CompletedBoardsRecap boards={boards} rowCount={rows} tileSize={Math.max(6, fit.tile)} cols={fit.cols} />
      )}
    </div>
  );
}
