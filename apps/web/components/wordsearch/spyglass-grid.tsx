'use client';

import { memo, useCallback, useRef, useState } from 'react';
import { wordsearchCells, wordsearchLine, type WordsearchState } from '@wordle-duel/core';

// The Spyglass grid (More Games §17): a 10 × 10 board of letters in the
// Classic tile ink on the surface, inside the same rounded, ruled frame the
// other More Games boards use. Found words get an accent capsule laid along
// their line; the live selection shows as a lighter capsule while you drag.
// Input is tap-start / tap-end (the accessible default) OR a drag — both end
// in one SELECT. A hinted word pulses its first letter.

export const WORDSEARCH_ACCENT = '#4d7c0f';
const HEAVY = '#4c1d95';
const RULE = 'rgba(76, 29, 149, 0.16)';

interface SpyglassGridProps {
  state: WordsearchState;
  onSelect: (from: number, to: number) => void;
  disabled?: boolean;
  /** After a reveal: outline the words that were never found. */
  revealMissing?: boolean;
}

/** A capsule from cell a to cell b, in grid units (0..n). */
function Capsule({ n, a, b, color, opacity, dashed }: { n: number; a: number; b: number; color: string; opacity: number; dashed?: boolean }) {
  const ax = (a % n) + 0.5, ay = Math.floor(a / n) + 0.5, bx = (b % n) + 0.5, by = Math.floor(b / n) + 0.5;
  const len = Math.hypot(bx - ax, by - ay);
  const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
  const thick = 0.78;
  return (
    <div
      className="absolute pointer-events-none rounded-full"
      style={{
        left: `${(ax / n) * 100}%`, top: `${(ay / n) * 100}%`,
        width: `${((len + thick) / n) * 100}%`, height: `${(thick / n) * 100}%`,
        transform: `translate(${-(thick / 2) / (len + thick) * 100}%, -50%) rotate(${angle}deg)`,
        transformOrigin: `${(thick / 2) / (len + thick) * 100}% 50%`,
        background: dashed ? 'transparent' : color, opacity,
        border: dashed ? `2px dashed ${color}` : undefined,
      }}
    />
  );
}

export const SpyglassGrid = memo(function SpyglassGrid({ state, onSelect, disabled = false, revealMissing = false }: SpyglassGridProps) {
  const n = state.n;
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const cellAt = useCallback((x: number, y: number): number | null => {
    const el = gridRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    const c = Math.floor(((x - r.left) / r.width) * n), row = Math.floor(((y - r.top) / r.height) * n);
    if (c < 0 || c >= n || row < 0 || row >= n) return null;
    return row * n + c;
  }, [n]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const cell = cellAt(e.clientX, e.clientY); if (cell == null) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (anchor != null && !dragging.current && cell !== anchor) {
      // Tap-tap: the second tap completes the selection.
      onSelect(anchor, cell); setAnchor(null); setHover(null); return;
    }
    setAnchor(cell); setHover(cell); dragging.current = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const cell = cellAt(e.clientX, e.clientY); if (cell != null) setHover(cell);
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (anchor != null && hover != null && hover !== anchor) { onSelect(anchor, hover); setAnchor(null); setHover(null); }
    else setHover(null);   // a tap: keep the anchor for tap-tap
  };

  const preview = anchor != null && hover != null && hover !== anchor ? wordsearchLine(n, anchor, hover) : null;
  const previewCells = new Set(preview ?? []);
  const foundCells = new Set<number>();
  for (const p of state.words) if (state.found.includes(p.w)) wordsearchCells(n, p).forEach((i) => foundCells.add(i));
  const hintCells = new Set<number>();
  for (const p of state.words) if (state.hinted.includes(p.w) && !state.found.includes(p.w)) hintCells.add(wordsearchCells(n, p)[0]);

  return (
    <div className="w-full mx-auto select-none" style={{ maxWidth: 440, aspectRatio: '1 / 1' }}>
      <div
        ref={gridRef}
        className="relative grid w-full h-full overflow-hidden touch-none"
        style={{
          gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)`,
          border: `2.5px solid ${HEAVY}`, borderRadius: '14px', background: 'var(--color-surface)',
        }}
        role="grid" aria-label={`Spyglass grid: ${state.title}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        {/* Found-word capsules sit UNDER the letters. */}
        {state.words.filter((p) => state.found.includes(p.w)).map((p) => {
          const cells = wordsearchCells(n, p);
          return <Capsule key={p.w} n={n} a={cells[0]} b={cells[cells.length - 1]} color={WORDSEARCH_ACCENT} opacity={0.28} />;
        })}
        {revealMissing && state.words.filter((p) => !state.found.includes(p.w)).map((p) => {
          const cells = wordsearchCells(n, p);
          return <Capsule key={`m-${p.w}`} n={n} a={cells[0]} b={cells[cells.length - 1]} color="#dc2626" opacity={0.6} dashed />;
        })}
        {preview && <Capsule n={n} a={anchor!} b={hover!} color={WORDSEARCH_ACCENT} opacity={0.18} />}
        {Array.from({ length: n * n }, (_, i) => {
          const r = Math.floor(i / n), c = i % n;
          const isAnchor = i === anchor;
          const inPreview = previewCells.has(i);
          const found = foundCells.has(i);
          const hinted = hintCells.has(i);
          return (
            <div
              key={i}
              className={`relative flex items-center justify-center font-black leading-none ${hinted ? 'animate-pulse' : ''}`}
              style={{
                color: found ? '#365314' : 'var(--color-text)',
                borderRight: c === n - 1 ? 'none' : `1px solid ${RULE}`,
                borderBottom: r === n - 1 ? 'none' : `1px solid ${RULE}`,
                fontSize: 'clamp(13px, 4vw, 20px)',
                background: isAnchor ? `${WORDSEARCH_ACCENT}33` : inPreview ? `${WORDSEARCH_ACCENT}14` : 'transparent',
                boxShadow: hinted ? `inset 0 0 0 2px ${WORDSEARCH_ACCENT}` : undefined,
              }}
              role="gridcell"
              aria-label={`Row ${r + 1} column ${c + 1}, ${state.grid[i]}${found ? ', found' : ''}`}
            >
              {state.grid[i]}
            </div>
          );
        })}
      </div>
    </div>
  );
});
