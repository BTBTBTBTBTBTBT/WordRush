'use client';

import { memo, type MouseEvent, type ReactNode } from 'react';
import { Lightbulb, Eye } from 'lucide-react';
import { scrambleRemaining, scrambleTarget, scrambleTray, scrambleFinalOpen, SCRAMBLE_FINAL, type ScrambleState } from '@wordle-duel/core';

export const MUDDLE_ACCENT = '#f97316';
const PURPLE = '#7c3aed', LILAC = '#f5f3ff', LILAC_BORDER = '#c4b5fd', LILAC_TEXT = '#5b21b6', HINT = '#8b5cf6';
const COLS = 6;

// Compact rule (More Games §5, founder 2026-09-23): the whole puzzle fits one
// phone screen with the keyboard pinned, so every size below is a fixed pixel
// constant rather than a viewport clamp. Tile letters never drop under 17px.
export const TILE = 38;            // answer tile, six fixed columns
export const TILE_GAP = 6;
export const TILE_FONT = 18;
export const RING_INSET = '16%';   // ring ≈ 60 % of the tile, drawn inside it
export const SCRAMBLE_FONT = 17;   // bold scramble letters, light tracking
export const ICON_BTN = 28;        // Letter · Solve round icon buttons
export const FINAL_TILE = 32;      // lilac punchline tiles
export const FINAL_FONT = 16;
/** Column width of the puzzle: the six-tile grid plus a scramble row with the two icon buttons — same on phone and desktop. */
export const COLUMN_CLASS = 'w-full max-w-sm';
// A 44px hit target around a 28px glyph: padding grows the box, the negative
// margin gives the layout its 28px back, so rows stay compact.
const HIT_28 = { padding: '8px 6px', margin: '-8px -6px' } as const;

/**
 * The cartoon panel (More Games §5/§8): a standard card in the cream paper
 * tone, 4:3, sized by its parent's height (the flex column lets it shrink on
 * short screens) and capped at ~26vh so the words below always fit. Until the
 * founder's image batch runs, a placeholder sketch stands in; the caption is
 * ALWAYS typeset by the app beneath the panel, never drawn.
 */
export const CartoonPanel = memo(function CartoonPanel({ src, alt, fixed = false }: { src: string | null; alt: string; fixed?: boolean }) {
  // Playing: a flex item that takes whatever height the column has left
  // (never under 96px, never over 26vh); the width follows from the 4:3 ratio.
  // Finished: a plain 26vh card at the top of the scrolling results.
  const size = fixed ? { height: '26vh', flexShrink: 0 } : { flex: '1 1 0%', minHeight: 96, maxHeight: '26vh' };
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: '#fdf8ec', borderColor: 'var(--color-border)', aspectRatio: '4 / 3', maxWidth: '100%', ...size }} role="img" aria-label={alt}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/muddle/${src}`} alt={alt} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <svg viewBox="0 0 400 300" className="w-full h-full" aria-hidden>
          <rect x="0" y="0" width="400" height="300" fill="#fdf8ec" />
          <g fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="34" y="30" width="332" height="240" rx="18" strokeDasharray="10 8" opacity="0.35" />
            <path d="M120 215 Q200 120 280 215" />
            <circle cx="200" cy="130" r="34" />
            <path d="M186 124 q6 -8 12 0 M202 124 q6 -8 12 0" />
            <path d="M188 146 q12 12 24 0" />
          </g>
          <circle cx="300" cy="90" r="14" fill="#f97316" opacity="0.9" />
          <circle cx="100" cy="90" r="9" fill="#7c3aed" opacity="0.9" />
          <text x="200" y="262" textAnchor="middle" fontFamily="Nunito, system-ui, sans-serif" fontWeight="800" fontSize="14" fill="#6b7280">Cartoon panel — art batch pending</text>
        </svg>
      )}
    </div>
  );
});

/** Round icon-only hint button (lightbulb / eye); the label lives in aria-label and the title tooltip. */
function IconButton({ label, onClick, children }: { label: string; onClick: (e: MouseEvent) => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-center rounded-full border transition-opacity hover:opacity-80 shrink-0"
      style={{ width: ICON_BTN, height: ICON_BTN, borderColor: `${MUDDLE_ACCENT}66`, color: MUDDLE_ACCENT, background: `${MUDDLE_ACCENT}0d`, boxSizing: 'content-box', ...HIT_28 }}
      aria-label={label} title={label}>
      {children}
    </button>
  );
}

interface WordRowProps {
  state: ScrambleState;
  row: number;
  active: boolean;
  shaking: boolean;
  onSelect: (row: number) => void;
  onTapTile: (row: number, letter: string) => void;
  onRevealLetter: (row: number) => void;
  onSolveWord: (row: number) => void;
  finished: boolean;
}

/**
 * One word (More Games §5, the classic newspaper layout) as ONE compact block:
 * the scrambled letters as bold spaced type on the left with the Letter · Solve
 * icon buttons on the right, then the answer boxes directly beneath on ONE fixed
 * six-column grid (the sixth slot simply empty for a five-letter word). A
 * circled letter is a ring drawn INSIDE its box — white on a filled tile,
 * purple on an empty one — never an outline around the tile. No card frame per
 * word; a light lilac tint marks the active row. Tapping a scrambled letter
 * places it; used letters dim.
 */
export const WordRow = memo(function WordRow({ state, row, active, shaking, onSelect, onTapTile, onRevealLetter, onSolveWord, finished }: WordRowProps) {
  const w = state.words[row];
  const entry = state.entries[row];
  const solved = state.solved[row];
  const remaining = scrambleRemaining(w.scramble, entry);
  const used = [...w.scramble];   // mark used letters left-to-right by multiset
  const left = [...remaining];
  const dimmed = used.map((ch) => { const k = left.indexOf(ch); if (k >= 0) { left.splice(k, 1); return false; } return true; });
  const circled = new Set(w.circled);
  const revealed = state.revealed[row];
  const isActive = active && !finished;
  return (
    <div className={`${COLUMN_CLASS} flex flex-col gap-1 rounded-lg px-2 py-1 ${shaking ? 'animate-shake' : ''}`} style={{ background: isActive ? LILAC : undefined, border: `1px solid ${isActive ? LILAC_BORDER : 'transparent'}` }} onClick={() => !solved && !finished && onSelect(row)} role="group" aria-label={`Word ${row + 1}`}>
      <div className="flex items-center justify-between" style={{ height: ICON_BTN }}>
        <div className="flex items-center gap-0.5" aria-label={`Scrambled letters ${w.scramble.split('').join(' ')}`}>
          {[...w.scramble].map((ch, i) => (
            <button key={i} type="button" disabled={solved || finished || dimmed[i]} onClick={(e) => { e.stopPropagation(); onSelect(row); onTapTile(row, ch); }}
              className="font-black leading-none transition-opacity" style={{ fontSize: SCRAMBLE_FONT, height: ICON_BTN, padding: '8px 6px', margin: '-8px 0', boxSizing: 'content-box', lineHeight: `${ICON_BTN}px`, color: 'var(--color-text)', opacity: dimmed[i] || solved ? 0.25 : 1, letterSpacing: 0.5 }}>
              {ch}
            </button>
          ))}
        </div>
        {!solved && !finished && (
          <div className="flex items-center gap-3">
            <IconButton label="Reveal a letter" onClick={(e) => { e.stopPropagation(); onRevealLetter(row); }}><Lightbulb className="w-3.5 h-3.5" /></IconButton>
            <IconButton label="Solve this word" onClick={(e) => { e.stopPropagation(); onSolveWord(row); }}><Eye className="w-3.5 h-3.5" /></IconButton>
          </div>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`, gap: TILE_GAP }}>
        {Array.from({ length: COLS }, (_, i) => {
          if (i >= w.answer.length) return <span key={i} aria-hidden />;
          const ch = solved ? w.answer[i] : entry[i] ?? '';
          const filled = ch !== '';
          const pinned = revealed[i] !== '_';
          const ring = circled.has(i);
          const bg = solved ? PURPLE : filled ? (pinned ? HINT : PURPLE) : 'var(--color-surface)';
          const border = solved || filled ? bg : 'var(--color-border)';
          return (
            <span key={i} className="relative flex items-center justify-center rounded-md border-2 font-black" style={{ width: TILE, height: TILE, background: bg, borderColor: border, color: filled || solved ? '#fff' : 'var(--color-text)', fontSize: TILE_FONT }} aria-label={ring ? `${ch || 'empty'}, circled` : ch || 'empty'}>
              {ch}
              {ring && <span className="absolute rounded-full pointer-events-none" style={{ inset: RING_INSET, border: `2px solid ${filled || solved ? '#fff' : PURPLE}`, opacity: 0.9 }} aria-hidden />}
            </span>
          );
        })}
      </div>
    </div>
  );
});

interface FinalRowProps { state: ScrambleState; active: boolean; shaking: boolean; onSelect: () => void; onTapTile: (letter: string) => void; onRevealLetter: () => void; finished: boolean }

/** The punchline under a divider, grouped by word, in the light lilac tint with purple text; its tray is the circled letters in word order. */
export const FinalRow = memo(function FinalRow({ state, active, shaking, onSelect, onTapTile, onRevealLetter, finished }: FinalRowProps) {
  const open = scrambleFinalOpen(state);
  const entry = state.entries[SCRAMBLE_FINAL];
  const solved = state.solved[SCRAMBLE_FINAL];
  const target = scrambleTarget(state, SCRAMBLE_FINAL);
  const tray = scrambleTray(state, SCRAMBLE_FINAL);
  const remaining = scrambleRemaining(tray, entry);
  const left = [...remaining];
  const dimmed = [...tray].map((ch) => { const k = left.indexOf(ch); if (k >= 0) { left.splice(k, 1); return false; } return true; });
  const isActive = active && !finished;
  const showTray = open && !solved && !finished;
  let pos = 0;
  return (
    <div className={`${COLUMN_CLASS} flex flex-col gap-1 rounded-lg px-2 pt-1.5 pb-1 mt-1 ${shaking ? 'animate-shake' : ''}`} style={{ borderTop: '1.5px solid var(--color-border)', background: isActive ? LILAC : undefined, opacity: open || finished ? 1 : 0.55 }} onClick={() => open && !solved && !finished && onSelect()} role="group" aria-label="Punchline">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1" style={{ minHeight: showTray ? ICON_BTN : undefined }}>
        <span className="text-[10px] font-black tracking-widest uppercase leading-none" style={{ color: 'var(--color-text-muted)' }}>{open || finished ? 'The punchline' : 'Solve the four words to unlock the punchline'}</span>
        {showTray && (
          <div className="flex items-center justify-end gap-2 ml-auto min-w-0">
            <div className="flex items-center justify-end gap-0.5 flex-wrap" aria-label="Circled letters">
              {[...tray].map((ch, i) => (
                <button key={i} type="button" disabled={dimmed[i]} onClick={(e) => { e.stopPropagation(); onSelect(); onTapTile(ch); }} className="font-black leading-none" style={{ fontSize: SCRAMBLE_FONT, height: ICON_BTN, padding: '8px 5px', margin: '-8px 0', boxSizing: 'content-box', lineHeight: `${ICON_BTN}px`, color: LILAC_TEXT, opacity: dimmed[i] ? 0.25 : 1, letterSpacing: 0.5 }}>{ch}</button>
              ))}
            </div>
            <IconButton label="Reveal a letter of the punchline" onClick={(e) => { e.stopPropagation(); onRevealLetter(); }}><Lightbulb className="w-3.5 h-3.5" /></IconButton>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-x-2.5 gap-y-1.5">
        {state.final.pattern.map((len, wi) => {
          const start = pos; pos += len;
          return (
            <div key={wi} className="flex gap-1">
              {Array.from({ length: len }, (_, k) => {
                const idx = start + k;
                const ch = solved || finished ? target[idx] : entry[idx] ?? '';
                const filled = ch !== '';
                return (
                  <span key={k} className="relative flex items-center justify-center rounded-md border-2 font-black" style={{ width: FINAL_TILE, height: FINAL_TILE, background: filled ? LILAC : 'var(--color-surface)', borderColor: filled ? LILAC_BORDER : 'var(--color-border)', color: LILAC_TEXT, fontSize: FINAL_FONT }}>
                    {ch}
                    <span className="absolute rounded-full pointer-events-none" style={{ inset: 3, border: `2px solid ${PURPLE}`, opacity: filled ? 0.9 : 0.35 }} aria-hidden />
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
