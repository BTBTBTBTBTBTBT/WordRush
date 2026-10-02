'use client';

import { memo, useCallback, useRef, useState, type CSSProperties } from 'react';
import { wordsearchCells, wordsearchLine, type WordsearchState } from '@wordle-duel/core';
import { GameTray } from '@/components/ui/game-tray';
import { glossyChip, tintedChip } from '@/lib/puzzle-look';
import { SOFT_INK, alphaHex, darken } from '@/lib/soft-surface';

// The Spyglass grid (More Games §17; FINISH_SPEC J3 + L): a 10 × 10 board of
// crisp Nunito Black letters right on the shared game tray — no ruled frame,
// no grid lines. (Small glossy tiles were the alternative; at ~30 px cells on
// a phone a hundred opaque tiles crowd the board and would hide the found-word
// capsules that run under the letters along rows, columns and diagonals, so
// the letters sit on the tinted tray instead.) Found words get a glossy
// capsule in the accent with a soft glow, the letters turning white; the live
// selection shows as a lighter capsule while you drag. Input is tap-start /
// tap-end (the accessible default) OR a drag — both end in one SELECT. A
// hinted word pulses its first letter.

export const WORDSEARCH_ACCENT = '#4d7c0f';
/** Found letters: white on the glossy capsule, with a soft deep-green shadow. */
const FOUND_SHADOW = `0 1px 1px ${alphaHex(darken(WORDSEARCH_ACCENT, 0.5), 0.6)}`;

interface SpyglassGridProps {
  state: WordsearchState;
  onSelect: (from: number, to: number) => void;
  disabled?: boolean;
  /** After a reveal: outline the words that were never found. */
  revealMissing?: boolean;
}

type CapsuleKind = 'found' | 'preview' | 'missing';

/** A capsule from cell a to cell b, in grid units (0..n). */
function Capsule({ n, a, b, kind }: { n: number; a: number; b: number; kind: CapsuleKind }) {
  const ax = (a % n) + 0.5, ay = Math.floor(a / n) + 0.5, bx = (b % n) + 0.5, by = Math.floor(b / n) + 0.5;
  const len = Math.hypot(bx - ax, by - ay);
  const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
  const thick = 0.78;
  const look: CSSProperties = kind === 'found'
    // FINISH_SPEC J3: a glossy capsule in the accent with a soft glow (no lip: it runs at any angle).
    ? glossyChip(WORDSEARCH_ACCENT, { lip: 0, glow: true })
    : kind === 'preview'
      ? { background: alphaHex(WORDSEARCH_ACCENT, 0.2), boxShadow: `inset 0 0 0 2px ${alphaHex(WORDSEARCH_ACCENT, 0.5)}` }
      : { background: 'transparent', border: '2px dashed #dc2626', opacity: 0.6 };
  return (
    <div
      className="absolute pointer-events-none rounded-full"
      style={{
        left: `${(ax / n) * 100}%`, top: `${(ay / n) * 100}%`,
        width: `${((len + thick) / n) * 100}%`, height: `${(thick / n) * 100}%`,
        transform: `translate(${-(thick / 2) / (len + thick) * 100}%, -50%) rotate(${angle}deg)`,
        transformOrigin: `${(thick / 2) / (len + thick) * 100}% 50%`,
        ...look,
        color: undefined, textShadow: undefined,
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
  const foundCells = new Set<number>();
  for (const p of state.words) if (state.found.includes(p.w)) wordsearchCells(n, p).forEach((i) => foundCells.add(i));
  const hintCells = new Set<number>();
  for (const p of state.words) if (state.hinted.includes(p.w) && !state.found.includes(p.w)) hintCells.add(wordsearchCells(n, p)[0]);

  const trayState = state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'playing';
  return (
    <div className="w-full mx-auto select-none" style={{ maxWidth: 440 }}>
      <GameTray accent={WORDSEARCH_ACCENT} state={trayState}>
        <div
          ref={gridRef}
          className="relative grid w-full touch-none"
          style={{ aspectRatio: '1 / 1', gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}
          role="grid" aria-label={`Spyglass grid: ${state.title}`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        >
          {/* Found-word capsules sit UNDER the letters. */}
          {state.words.filter((p) => state.found.includes(p.w)).map((p) => {
            const cells = wordsearchCells(n, p);
            return <Capsule key={p.w} n={n} a={cells[0]} b={cells[cells.length - 1]} kind="found" />;
          })}
          {revealMissing && state.words.filter((p) => !state.found.includes(p.w)).map((p) => {
            const cells = wordsearchCells(n, p);
            return <Capsule key={`m-${p.w}`} n={n} a={cells[0]} b={cells[cells.length - 1]} kind="missing" />;
          })}
          {preview && <Capsule n={n} a={anchor!} b={hover!} kind="preview" />}
          {Array.from({ length: n * n }, (_, i) => {
            const r = Math.floor(i / n), c = i % n;
            const isAnchor = i === anchor;
            const found = foundCells.has(i);
            const hinted = hintCells.has(i);
            return (
              <div
                key={i}
                className={`relative flex items-center justify-center font-black leading-none rounded-full ${hinted ? 'motion-safe:animate-pulse' : ''}`}
                style={{
                  color: found ? '#ffffff' : SOFT_INK.num,
                  textShadow: found ? FOUND_SHADOW : undefined,
                  fontSize: 'clamp(13px, 4vw, 20px)',
                  background: isAnchor ? alphaHex(WORDSEARCH_ACCENT, 0.28) : undefined,
                  boxShadow: isAnchor
                    ? `inset 0 0 0 2px ${alphaHex(WORDSEARCH_ACCENT, 0.6)}`
                    : hinted ? `inset 0 0 0 2px ${WORDSEARCH_ACCENT}, 0 0 8px ${alphaHex(WORDSEARCH_ACCENT, 0.45)}` : undefined,
                }}
                role="gridcell"
                aria-label={`Row ${r + 1} column ${c + 1}, ${state.grid[i]}${found ? ', found' : ''}`}
              >
                {state.grid[i]}
              </div>
            );
          })}
        </div>
      </GameTray>
    </div>
  );
});

/** The word list under the grid (shared by the game and the leaderboard's Completed Today card). */
export function SpyglassWordList({ state: s, done }: { state: WordsearchState; done: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 px-2" aria-label="Words to find">
      {s.words.map((p) => {
        const found = s.found.includes(p.w);
        const hinted = s.hinted.includes(p.w) && !found;
        // Hidden until found or shown: the word's length as dots (founder, 2026-09-26).
        const visible = found || !!s.wordsShown || done;
        // FINISH_SPEC J3: a found word is a glossy capsule in the accent (white ink); the rest are
        // tinted glossy chips (A1, no plain white); a hinted word wears an accent ring.
        const chip = found ? glossyChip(WORDSEARCH_ACCENT, { lip: 3 }) : tintedChip(WORDSEARCH_ACCENT, { lip: 3 });
        return (
          <span key={p.w} className={`text-sm font-bold px-3 pt-1.5 rounded-full whitespace-nowrap ${found ? 'line-through' : ''}`}
            style={{
              ...chip,
              paddingBottom: 'calc(0.375rem + 3px)',
              ...(found ? null : {
                color: visible ? 'var(--color-text)' : 'var(--color-text-muted)',
                letterSpacing: visible ? undefined : '0.2em',
                boxShadow: hinted ? `${chip.boxShadow}, 0 0 0 2px ${WORDSEARCH_ACCENT}` : chip.boxShadow,
              }),
            }}
            aria-label={visible ? p.w : `${p.w.length}-letter word`}>
            {visible ? p.w : '•'.repeat(p.w.length)}
          </span>
        );
      })}
    </div>
  );
}
