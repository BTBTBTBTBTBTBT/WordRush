'use client';

import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Lightbulb, Eye } from 'lucide-react';
import { scrambleRemaining, scrambleTarget, scrambleTray, scrambleFinalOpen, SCRAMBLE_FINAL, type ScrambleState } from '@wordle-duel/core';
import { CandyButton } from '@/components/ui/candy-button';
import { Confetti } from '@/components/effects/confetti';
import { muddleCoinSrc, type MuddleCoin } from '@/lib/art';
import { COIN_LETTER, answerSlotLook, chipSize, coinInk, punchlineSlotLook, usedLetters } from '@/lib/muddle-look';
import { REVEAL } from '@/lib/tile-motion';
import { prefersReducedMotion } from '@/lib/motion';
import { softBorder, softCard, softShadow } from '@/lib/soft-surface';

export const MUDDLE_ACCENT = '#f97316';
const HINT = '#8b5cf6';
const COLS = 6;

// Compact rule (More Games §5, founder 2026-09-23): the whole puzzle fits one
// phone screen with the keyboard pinned, so every size below is a fixed pixel
// constant rather than a viewport clamp. Tile letters never drop under 17px.
export const TILE = 38;            // answer tile, six fixed columns
export const TILE_GAP = 6;
export const TILE_FONT = 18;
export const RING_INSET = '16%';   // ring ≈ 60 % of the tile, drawn inside it
export const SCRAMBLE_FONT = 17;   // bold scramble letters, light tracking
export const ICON_BTN = 32;        // Letter · Solve round candy buttons (FINISH_SPEC I4)
export const FINAL_TILE = 32;      // gold punchline coins (FINISH_SPEC I2)
export const FINAL_FONT = 16;
/** Column width of the puzzle: the six-tile grid plus a scramble row with the two icon buttons — same on phone and desktop. */
export const COLUMN_CLASS = 'w-full max-w-sm';
/** I3: the scrambled clue letters as small glossy chips, ~70% of an answer tile. */
const CHIP = chipSize(TILE);

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
    // I4: the cream paper card keeps its tone, with the A1 border + soft shadow.
    <div className="rounded-2xl overflow-hidden" style={{ background: '#fdf8ec', border: softBorder(MUDDLE_ACCENT), boxShadow: softShadow(MUDDLE_ACCENT, 0.14), aspectRatio: '4 / 3', maxWidth: '100%', ...size }} role="img" aria-label={alt}>
      {src ? (
        // While playing the cartoon is the screen's hero: load it eagerly at high
        // priority (founder, 2026-09-29). React 18 passes only the lowercase attribute.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/muddle/${src}`} alt={alt} width={400} height={300} className="w-full h-full object-cover" loading={fixed ? 'lazy' : 'eager'} {...(fixed ? {} : { fetchpriority: 'high' })} />
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

/** I4: a small round candy hint button (bulb / eye); the label lives in aria-label and the title tooltip. */
function IconButton({ label, onClick, children }: { label: string; onClick: (e: MouseEvent) => void; children: ReactNode }) {
  return (
    <CandyButton
      size="round"
      color="amber"
      icon={children}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0"
      style={{ ['--candy-h' as string]: `${ICON_BTN}px`, ['--candy-lip-h' as string]: '3px', ['--candy-ring' as string]: '1px', marginBottom: 3 } as CSSProperties}
    />
  );
}

/**
 * A Muddle coin (FINISH_SPEC I1/I2): the glossy blank coin art with the letter
 * drawn on top — white Nunito Black with the tile text-shadow, dark amber on
 * the gold punchline coin — at ~52% of the coin. `frosted` lays the frosted
 * empty cell under the gold ring. Same footprint as a square tile.
 */
function Coin({ coin, frosted, letter, size, className = '', style, label }: {
  coin: MuddleCoin; frosted: boolean; letter: string; size: number; className?: string; style?: CSSProperties; label?: string;
}) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size, ...style }} aria-label={label}>
      {frosted && <span className="gtile absolute inset-0" data-s="empty" style={{ width: size, height: size }} aria-hidden="true" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={muddleCoinSrc(coin)} alt="" aria-hidden="true" width={size} height={size} draggable={false} className="absolute inset-0 w-full h-full pointer-events-none select-none" style={{ filter: 'drop-shadow(0 2px 3px rgba(60, 30, 110, 0.22))' }} />
      {letter && (
        <b
          className="absolute inset-0 flex items-center justify-center font-black"
          style={{
            fontSize: Math.round(size * COIN_LETTER), lineHeight: 1, color: coinInk(coin), zIndex: 1,
            textShadow: coin === 'punchline' ? '0 1px 0 rgba(255, 255, 255, 0.55)' : '0 1px 1px rgba(0, 0, 0, 0.25), 0 2px 3px rgba(40, 10, 80, 0.25)',
          }}
        >
          {letter}
        </b>
      )}
    </span>
  );
}

/**
 * True for one reveal after `on` flips from false to true while mounted (a
 * word / the punchline just solved) — never for rows that load solved.
 */
function useJustBecame(on: boolean, holdMs: number): boolean {
  const prev = useRef(on);
  const [just, setJust] = useState(false);
  useEffect(() => {
    if (on && !prev.current) {
      setJust(true);
      const t = setTimeout(() => setJust(false), holdMs);
      prev.current = on;
      return () => clearTimeout(t);
    }
    prev.current = on;
  }, [on, holdMs]);
  return just;
}

/** I3: a scrambled clue letter as a small glossy chip (light amber face, dark-purple letter); used letters sink. */
function LetterChip({ ch, used, disabled, onClick, ink = '#3b1a78' }: { ch: string; used: boolean; disabled: boolean; onClick: (e: MouseEvent) => void; ink?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-used={used ? 'true' : 'false'}
      className="gtile mud-chip shrink-0 border-0 p-0"
      data-s="typed"
      style={{
        width: CHIP, height: CHIP,
        ['--gt-edge' as string]: '#e3a54c',
        ['--gt-face' as string]: 'linear-gradient(#fff7e8, #ffe1ad)',
        ['--gt-ring' as string]: 'inset 0 0 0 1.5px rgba(217, 119, 6, 0.32)',
        ['--gt-glyph' as string]: ink,
        ['--gt-font' as string]: `${Math.round(CHIP * 0.56)}px`,
      } as CSSProperties}
      aria-label={used ? `${ch}, used` : ch}
    >
      <b style={{ textShadow: '0 1px 0 rgba(255, 255, 255, 0.7)' }}>{ch}</b>
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
 * the scrambled letters as small glossy chips on the left (FINISH_SPEC I3)
 * with the Letter · Solve round candy buttons on the right (I4), then the
 * answer slots directly beneath on ONE fixed six-column grid (the sixth slot
 * simply empty for a five-letter word). A circled slot is a round coin (I1);
 * the others are the B1 square glossy tiles. The active row is a tinted card
 * (A1). Tapping a chip places its letter (the type pop); used chips sink. A
 * word just solved flips over and glows (B3).
 */
export const WordRow = memo(function WordRow({ state, row, active, shaking, onSelect, onTapTile, onRevealLetter, onSolveWord, finished }: WordRowProps) {
  const w = state.words[row];
  const entry = state.entries[row];
  const solved = state.solved[row];
  const remaining = scrambleRemaining(w.scramble, entry);
  const used = usedLetters(w.scramble, remaining);
  const circled = new Set(w.circled);
  const revealed = state.revealed[row];
  const isActive = active && !finished;
  const justSolved = useJustBecame(solved, REVEAL.end(w.answer.length) + REVEAL.bloomMs);
  return (
    <div
      className={`${COLUMN_CLASS} flex flex-col gap-1 px-2 py-1 ${shaking ? 'gt-nudge' : ''}`}
      style={isActive ? softCard(MUDDLE_ACCENT, { radius: 12, shadow: false }) : { border: '1.5px solid transparent', borderRadius: 12 }}
      onClick={() => !solved && !finished && onSelect(row)}
      role="group"
      aria-label={`Word ${row + 1}`}
    >
      <div className="flex items-center justify-between" style={{ height: ICON_BTN + 4 }}>
        <div className="flex items-center gap-1" aria-label={`Scrambled letters ${w.scramble.split('').join(' ')}`}>
          {[...w.scramble].map((ch, i) => (
            <LetterChip key={i} ch={ch} used={used[i] || solved} disabled={solved || finished || used[i]}
              onClick={(e) => { e.stopPropagation(); onSelect(row); onTapTile(row, ch); }} />
          ))}
        </div>
        {!solved && !finished && (
          <div className="flex items-center gap-2.5">
            <IconButton label="Reveal a letter" onClick={(e) => { e.stopPropagation(); onRevealLetter(row); }}><Lightbulb className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
            <IconButton label="Solve this word" onClick={(e) => { e.stopPropagation(); onSolveWord(row); }}><Eye className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
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
          const look = answerSlotLook({ circled: ring, filled, pinned, solved });
          // B3: placing a letter = the type pop; a word just solved = the reveal flip + glow.
          const motion = justSolved ? 'gt-flip' : filled && !solved ? 'gt-pop' : '';
          const flipVar = justSolved ? { ['--gt-d' as string]: `${i * REVEAL.stagger}ms` } : null;
          const label = ring ? `${ch || 'empty'}, circled` : ch || 'empty';
          if (look.kind === 'coin') {
            return <Coin key={i} coin={look.coin} frosted={look.frosted} letter={ch} size={TILE} className={motion} style={flipVar ?? undefined} label={label} />;
          }
          // FINISH_SPEC B1: the shared glossy tile — purple once filled (a pinned hint letter in the hint violet), frosted when empty.
          return (
            <span key={i} className={`gtile ${motion}`} data-s={look.look === 'empty' ? 'empty' : 'correct'} style={{ width: TILE, height: TILE, ['--gt-font' as string]: `${TILE_FONT}px`, ...flipVar, ...(look.look === 'hint' ? { ['--gt-edge' as string]: '#5b21b6', ['--gt-face' as string]: `linear-gradient(#b197fc, ${HINT} 70%, #7c4ddb)` } : null) } as CSSProperties} aria-label={label}>
              <b>{ch}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
});

interface FinalRowProps { state: ScrambleState; active: boolean; shaking: boolean; onSelect: () => void; onTapTile: (letter: string) => void; onRevealLetter: () => void; finished: boolean }

/**
 * The punchline under a divider, grouped by word; its letters are gold coins
 * (FINISH_SPEC I2; empty = the gold ring on frosted) and its tray is the
 * circled letters as glossy chips. Solving it = a hop wave across the coins +
 * confetti (B3; off with Reduce Motion).
 */
export const FinalRow = memo(function FinalRow({ state, active, shaking, onSelect, onTapTile, onRevealLetter, finished }: FinalRowProps) {
  const open = scrambleFinalOpen(state);
  const entry = state.entries[SCRAMBLE_FINAL];
  const solved = state.solved[SCRAMBLE_FINAL];
  const target = scrambleTarget(state, SCRAMBLE_FINAL);
  const tray = scrambleTray(state, SCRAMBLE_FINAL);
  const remaining = scrambleRemaining(tray, entry);
  const used = usedLetters(tray, remaining);
  const isActive = active && !finished;
  const showTray = open && !solved && !finished;
  const total = state.final.pattern.reduce((a, b) => a + b, 0);
  const justSolved = useJustBecame(solved, total * REVEAL.hopStagger + REVEAL.hopMs + 3200);
  const confetti = justSolved && !prefersReducedMotion();
  let pos = 0;
  return (
    <div
      className={`${COLUMN_CLASS} flex flex-col gap-1 px-2 pt-1.5 pb-1 mt-1 ${shaking ? 'gt-nudge' : ''}`}
      style={{
        ...(isActive ? softCard(MUDDLE_ACCENT, { radius: 12, shadow: false }) : { border: '1.5px solid transparent', borderRadius: 12, borderTop: '1.5px solid var(--color-border)' }),
        opacity: open || finished ? 1 : 0.55,
      }}
      onClick={() => open && !solved && !finished && onSelect()}
      role="group"
      aria-label="Punchline"
    >
      {confetti && <Confetti />}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1" style={{ minHeight: showTray ? ICON_BTN + 4 : undefined }}>
        <span className="text-[10px] font-black tracking-widest uppercase leading-none" style={{ color: 'var(--color-text-muted)' }}>{open || finished ? 'The punchline' : 'Solve the four words to unlock the punchline'}</span>
        {showTray && (
          <div className="flex items-center justify-end gap-2 ml-auto min-w-0">
            <div className="flex items-center justify-end gap-1 flex-wrap" aria-label="Circled letters">
              {[...tray].map((ch, i) => (
                <LetterChip key={i} ch={ch} used={used[i]} disabled={used[i]} onClick={(e) => { e.stopPropagation(); onSelect(); onTapTile(ch); }} />
              ))}
            </div>
            <IconButton label="Reveal a letter of the punchline" onClick={(e) => { e.stopPropagation(); onRevealLetter(); }}><Lightbulb className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
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
                const look = punchlineSlotLook(filled);
                const coin = look.kind === 'coin' ? look : { coin: 'empty' as const, frosted: true };
                return (
                  <Coin
                    key={k}
                    coin={coin.coin}
                    frosted={coin.frosted}
                    letter={ch}
                    size={FINAL_TILE}
                    className={justSolved ? 'gt-hop' : filled && !solved ? 'gt-pop' : ''}
                    style={justSolved ? ({ ['--gt-hop-d' as string]: `${idx * REVEAL.hopStagger}ms` } as CSSProperties) : undefined}
                    label={ch || 'empty'}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
});
