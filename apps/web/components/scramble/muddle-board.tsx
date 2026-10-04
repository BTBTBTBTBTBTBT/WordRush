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
 * Muddle layout model (founder 10-02, "the picture and the tagline need to
 * appear the whole time"; iOS + Android draw the same pt/dp): the sizes of
 * the full ACTIVE word block and the open punchline. The finished board and
 * "See all words" keep the original sizes (MUDDLE_FULL).
 */
export interface MuddleSizes { tile: number; tileGap: number; tileFont: number; chip: number; iconBtn: number; coin: number }
export const MUDDLE_FULL: MuddleSizes = { tile: TILE, tileGap: TILE_GAP, tileFont: TILE_FONT, chip: CHIP, iconBtn: ICON_BTN, coin: FINAL_TILE };
/** While playing: tile 34 / chip 24 / coin 30; on a short viewport (< 700 tall) 32 / 22 / 28. */
export function muddlePlaySizes(short: boolean): MuddleSizes {
  return short
    ? { tile: 32, tileGap: 4, tileFont: 16, chip: 22, iconBtn: 28, coin: 28 }
    : { tile: 34, tileGap: 5, tileFont: 17, chip: 24, iconBtn: 30, coin: 30 };
}
/** A compact word line (inactive or solved): ~28 tall, chips 20, answer tiles 22; the locked punchline's rings 18; the open punchline's tray chips 22. */
export const MUDDLE_LINE = { height: 28, chip: 20, tile: 22, tileGap: 3, tileFont: 12, ring: 18, trayChip: 22 } as const;
/** The cartoon never drops under this while playing or finished (px). */
export const MUDDLE_CARTOON_MIN = 150;
/** The short-viewport breakpoint the tile sizes follow (matches globals.css .game-art-header). */
export const MUDDLE_SHORT_QUERY = '(max-height: 699.98px)';

/** True while the viewport is under 700 tall (the short sizes). */
export function useShortViewport(): boolean {
  const [short, setShort] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(MUDDLE_SHORT_QUERY);
    const on = () => setShort(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return short;
}

/**
 * The cartoon panel (More Games §5/§8): a standard card in the cream paper
 * tone, 4:3. The caption is ALWAYS typeset by the app beneath the panel,
 * never drawn. Sizing:
 * - `fill` (playing): fills its parent's height (the parent row is the flex
 *   item that takes the room left over, ≥ 150px); the width follows from 4:3.
 * - `fixed` (finished): a plain card, 26vh tall but never under 150px.
 * - default (completed-more-board): a flex item, 96px floor, 26vh cap.
 */
export const CartoonPanel = memo(function CartoonPanel({ src, alt, fixed = false, fill = false }: { src: string | null; alt: string; fixed?: boolean; fill?: boolean }) {
  const size: CSSProperties = fill
    ? { alignSelf: 'stretch', flexShrink: 0 }
    : fixed ? { height: `max(${MUDDLE_CARTOON_MIN}px, 26vh)`, flexShrink: 0 } : { flex: '1 1 0%', minHeight: 96, maxHeight: '26vh' };
  return (
    // I4: the cream paper card keeps its tone, with the A1 border + soft shadow.
    <div className="rounded-2xl overflow-hidden" data-muddle-cartoon style={{ background: '#fdf8ec', border: softBorder(MUDDLE_ACCENT), boxShadow: softShadow(MUDDLE_ACCENT, 0.14), aspectRatio: '4 / 3', maxWidth: '100%', ...size }} role="img" aria-label={alt}>
      {src ? (
        // While playing the cartoon is the screen's hero: load it eagerly at high
        // priority (founder, 2026-09-29). React 18 passes only the lowercase attribute.
        // Founder 10-03: prewarmed (lib/predecode warmMuddleCartoon); until it decodes the paper card
        // alone holds the slot at its exact size — never a placeholder sketch or text.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/muddle/${src}`} alt={alt} width={400} height={300} className="w-full h-full object-cover" loading={fixed ? 'lazy' : 'eager'} {...(fixed ? {} : { fetchpriority: 'high' })} />
      ) : null}
    </div>
  );
});

/** I4: a small round candy hint button (bulb / eye); the label lives in aria-label and the title tooltip. */
function IconButton({ label, onClick, children, size = ICON_BTN }: { label: string; onClick: (e: MouseEvent) => void; children: ReactNode; size?: number }) {
  return (
    <CandyButton
      size="round"
      color="amber"
      icon={children}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0"
      style={{ ['--candy-h' as string]: `${size}px`, ['--candy-lip-h' as string]: '3px', ['--candy-ring' as string]: '1px', marginBottom: 3 } as CSSProperties}
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
function LetterChip({ ch, used, disabled, onClick, ink = '#3b1a78', size = CHIP }: { ch: string; used: boolean; disabled: boolean; onClick: (e: MouseEvent) => void; ink?: string; size?: number }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-used={used ? 'true' : 'false'}
      className="gtile mud-chip shrink-0 border-0 p-0"
      data-s="typed"
      style={{
        width: size, height: size,
        ['--gt-edge' as string]: '#e3a54c',
        ['--gt-face' as string]: 'linear-gradient(#fff7e8, #ffe1ad)',
        ['--gt-ring' as string]: 'inset 0 0 0 1.5px rgba(217, 119, 6, 0.32)',
        ['--gt-glyph' as string]: ink,
        ['--gt-font' as string]: `${Math.round(size * 0.56)}px`,
      } as CSSProperties}
      aria-label={used ? `${ch}, used` : ch}
    >
      <b style={{ textShadow: '0 1px 0 rgba(255, 255, 255, 0.7)' }}>{ch}</b>
    </button>
  );
}


/** One answer slot at any size: a circled slot is a round coin (I1), the others the B1 square glossy tile. */
function AnswerSlot({ ch, ring, pinned, solved, size, font, motion, flipVar }: {
  ch: string; ring: boolean; pinned: boolean; solved: boolean; size: number; font: number; motion: string; flipVar: CSSProperties | null;
}) {
  const filled = ch !== '';
  const look = answerSlotLook({ circled: ring, filled, pinned, solved });
  const label = ring ? `${ch || 'empty'}, circled` : ch || 'empty';
  if (look.kind === 'coin') {
    return <Coin coin={look.coin} frosted={look.frosted} letter={ch} size={size} className={motion} style={flipVar ?? undefined} label={label} />;
  }
  // FINISH_SPEC B1: the shared glossy tile — purple once filled (a pinned hint letter in the hint violet), frosted when empty.
  return (
    <span className={`gtile ${motion}`} data-s={look.look === 'empty' ? 'empty' : 'correct'} style={{ width: size, height: size, ['--gt-font' as string]: `${font}px`, ...flipVar, ...(look.look === 'hint' ? { ['--gt-edge' as string]: '#5b21b6', ['--gt-face' as string]: `linear-gradient(#b197fc, ${HINT} 70%, #7c4ddb)` } : null) } as CSSProperties} aria-label={label}>
      <b>{ch}</b>
    </span>
  );
}

/**
 * How a word row draws (founder 10-02 layout model):
 * - `full`: the ACTIVE word — scrambled chips over the six-column answer
 *   tiles, Letter · Solve at right (also the finished "See all words" rows);
 * - `line`: an inactive or solved word as ONE ~28px line — small chips at
 *   left, small answer tiles at right, no hint buttons; clicking selects it;
 * - `mini`: a solved word's small locked tiles only (the 2×2 grid while the
 *   punchline is open).
 */
export type WordRowVariant = 'full' | 'line' | 'mini';

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
  variant?: WordRowVariant;
  sizes?: MuddleSizes;
}

/**
 * One word (More Games §5, the classic newspaper layout). In `full`, ONE
 * compact block: the scrambled letters as small glossy chips on the left
 * (FINISH_SPEC I3) with the Letter · Solve round candy buttons on the right
 * (I4), then the answer slots directly beneath on ONE fixed six-column grid
 * (the sixth slot simply empty for a five-letter word). The active row is a
 * tinted card (A1). Tapping a chip places its letter (the type pop); used
 * chips sink. A word just solved flips over and glows (B3).
 */
export const WordRow = memo(function WordRow({ state, row, active, shaking, onSelect, onTapTile, onRevealLetter, onSolveWord, finished, variant = 'full', sizes = MUDDLE_FULL }: WordRowProps) {
  const w = state.words[row];
  const entry = state.entries[row];
  const solved = state.solved[row];
  const remaining = scrambleRemaining(w.scramble, entry);
  const used = usedLetters(w.scramble, remaining);
  const circled = new Set(w.circled);
  const revealed = state.revealed[row];
  const isActive = active && !finished;
  const justSolved = useJustBecame(solved, REVEAL.end(w.answer.length) + REVEAL.bloomMs);
  const compact = variant !== 'full';
  const tile = compact ? MUDDLE_LINE.tile : sizes.tile;
  const font = compact ? MUDDLE_LINE.tileFont : sizes.tileFont;
  const gap = variant === 'mini' ? 2 : compact ? MUDDLE_LINE.tileGap : sizes.tileGap;
  const slot = (i: number) => {
    const ch = solved ? w.answer[i] : entry[i] ?? '';
    // B3: placing a letter = the type pop; a word just solved = the reveal flip + glow.
    const motion = justSolved ? 'gt-flip' : ch !== '' && !solved ? 'gt-pop' : '';
    const flipVar = justSolved ? ({ ['--gt-d' as string]: `${i * REVEAL.stagger}ms` } as CSSProperties) : null;
    return <AnswerSlot key={i} ch={ch} ring={circled.has(i)} pinned={revealed[i] !== '_'} solved={solved} size={tile} font={font} motion={motion} flipVar={flipVar} />;
  };
  const chips = (size: number, gapClass: string) => (
    <div className={`flex items-center ${gapClass}`} aria-label={`Scrambled letters ${w.scramble.split('').join(' ')}`}>
      {[...w.scramble].map((ch, i) => (
        <LetterChip key={i} ch={ch} size={size} used={used[i] || solved} disabled={solved || finished || used[i]}
          onClick={(e) => { e.stopPropagation(); onSelect(row); onTapTile(row, ch); }} />
      ))}
    </div>
  );
  const grid = (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, ${tile}px)`, gap }}>
      {Array.from({ length: COLS }, (_, i) => (i >= w.answer.length ? <span key={i} aria-hidden /> : slot(i)))}
    </div>
  );

  if (variant === 'mini') {
    return (
      <div className={`flex items-center justify-center ${shaking ? 'gt-nudge' : ''}`} style={{ height: MUDDLE_LINE.height, gap }} role="group" aria-label={`Word ${row + 1}${solved ? ', solved' : ''}`}>
        {Array.from({ length: w.answer.length }, (_, i) => slot(i))}
      </div>
    );
  }

  if (variant === 'line') {
    const selectable = !solved && !finished;
    return (
      <div
        className={`${COLUMN_CLASS} flex items-center justify-between gap-2 px-2 ${selectable ? 'cursor-pointer' : ''} ${shaking ? 'gt-nudge' : ''}`}
        style={{ height: MUDDLE_LINE.height, border: '1.5px solid transparent', borderRadius: 10 }}
        onClick={() => selectable && onSelect(row)}
        role="group"
        aria-label={`Word ${row + 1}${solved ? ', solved' : ''}`}
      >
        {chips(MUDDLE_LINE.chip, 'gap-0.5')}
        {grid}
      </div>
    );
  }

  return (
    <div
      className={`${COLUMN_CLASS} flex flex-col gap-1 px-2 py-1 ${shaking ? 'gt-nudge' : ''}`}
      style={isActive ? softCard(MUDDLE_ACCENT, { radius: 12, shadow: false }) : { border: '1.5px solid transparent', borderRadius: 12 }}
      onClick={() => !solved && !finished && onSelect(row)}
      role="group"
      aria-label={`Word ${row + 1}`}
    >
      <div className="flex items-center justify-between" style={{ height: sizes.iconBtn + 3 }}>
        {chips(sizes.chip, 'gap-1')}
        {!solved && !finished && (
          <div className="flex items-center gap-2.5">
            <IconButton size={sizes.iconBtn} label="Reveal a letter" onClick={(e) => { e.stopPropagation(); onRevealLetter(row); }}><Lightbulb className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
            <IconButton size={sizes.iconBtn} label="Solve this word" onClick={(e) => { e.stopPropagation(); onSolveWord(row); }}><Eye className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
          </div>
        )}
      </div>
      {grid}
    </div>
  );
});

interface FinalRowProps {
  state: ScrambleState; active: boolean; shaking: boolean; onSelect: () => void; onTapTile: (letter: string) => void; onRevealLetter: () => void; finished: boolean;
  /** Coin size of the open / finished punchline (MUDDLE_FULL when omitted). */
  sizes?: MuddleSizes;
}

/**
 * The punchline under a divider, grouped by word; its letters are gold coins
 * (FINISH_SPEC I2; empty = the gold ring on frosted) and its tray is the
 * circled letters as glossy chips. Locked (founder 10-02): one compact block —
 * the label over small rings for the pattern. Open: the label with Letter at
 * right, the tray chips (wrapping), then the answer coins (wrapping).
 * Solving it = a hop wave across the coins + confetti (B3; off with Reduce Motion).
 */
export const FinalRow = memo(function FinalRow({ state, active, shaking, onSelect, onTapTile, onRevealLetter, finished, sizes = MUDDLE_FULL }: FinalRowProps) {
  const open = scrambleFinalOpen(state);
  const entry = state.entries[SCRAMBLE_FINAL];
  const solved = state.solved[SCRAMBLE_FINAL];
  const target = scrambleTarget(state, SCRAMBLE_FINAL);
  const tray = scrambleTray(state, SCRAMBLE_FINAL);
  const remaining = scrambleRemaining(tray, entry);
  const used = usedLetters(tray, remaining);
  const isActive = active && !finished;
  const locked = !open && !finished;
  const showTray = open && !solved && !finished;
  const total = state.final.pattern.reduce((a, b) => a + b, 0);
  const justSolved = useJustBecame(solved, total * REVEAL.hopStagger + REVEAL.hopMs + 3200);
  const confetti = justSolved && !prefersReducedMotion();
  const coinSize = locked ? MUDDLE_LINE.ring : sizes.coin;
  let pos = 0;
  return (
    <div
      className={`${COLUMN_CLASS} flex flex-col ${locked ? 'gap-1 px-1.5 pt-1 pb-0.5 mt-0.5' : 'gap-1 px-2 pt-1.5 pb-1 mt-1'} ${shaking ? 'gt-nudge' : ''}`}
      style={{
        ...(isActive ? softCard(MUDDLE_ACCENT, { radius: 12, shadow: false }) : { border: '1.5px solid transparent', borderRadius: 12, borderTop: '1.5px solid var(--color-border)' }),
        opacity: locked ? 0.6 : 1,
      }}
      onClick={() => open && !solved && !finished && onSelect()}
      role="group"
      aria-label="Punchline"
    >
      {confetti && <Confetti />}
      <div className="flex items-center justify-between gap-2" style={{ minHeight: showTray ? sizes.iconBtn + 2 : undefined }}>
        <span className="text-[10px] font-black tracking-widest uppercase leading-none" style={{ color: 'var(--color-text-muted)' }}>{open || finished ? 'The punchline' : 'Solve the four words to unlock the punchline'}</span>
        {showTray && (
          <IconButton size={sizes.iconBtn} label="Reveal a letter of the punchline" onClick={(e) => { e.stopPropagation(); onRevealLetter(); }}><Lightbulb className="w-4 h-4" color="#ffffff" strokeWidth={2.75} /></IconButton>
        )}
      </div>
      {showTray && (
        <div className="flex items-center gap-1 flex-wrap" aria-label="Circled letters">
          {[...tray].map((ch, i) => (
            <LetterChip key={i} ch={ch} size={MUDDLE_LINE.trayChip} used={used[i]} disabled={used[i]} onClick={(e) => { e.stopPropagation(); onSelect(); onTapTile(ch); }} />
          ))}
        </div>
      )}
      <div className={`flex flex-wrap ${locked ? 'gap-x-2 gap-y-1' : 'gap-x-2.5 gap-y-1.5'}`}>
        {state.final.pattern.map((len, wi) => {
          const start = pos; pos += len;
          return (
            <div key={wi} className={`flex ${locked ? 'gap-0.5' : 'gap-1'}`}>
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
                    size={coinSize}
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
