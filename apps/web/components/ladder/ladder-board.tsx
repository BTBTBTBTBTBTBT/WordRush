'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { LadderState } from '@wordle-duel/core';
import { LetterTile, type TileLook } from '@/components/game/letter-tile';
import { darken, softMix } from '@/lib/soft-surface';
import { GameTray } from '@/components/ui/game-tray';
import { trayStateFor } from '@/lib/tray-fit';
import { ladderFit } from '@/lib/ladder-fit';

// The ladder (More Games §15): Classic tiles, one row per rung. START is a
// filled purple row, each accepted rung is a light row with the CHANGED letter
// filled in the mode accent (hint rungs: the violet hint color),
// the typing row is the empty bordered row, and END waits at the bottom as a
// dashed target. On a loss the canonical shortest path is shown muted below
// the ladder so nobody leaves without the answer.

export const LADDER_ACCENT = '#0284c7';
const HINT = '#8b5cf6';

type RowKind = 'start' | 'rung' | 'hint' | 'typing' | 'end' | 'reveal';

/** A changed letter's tile in the mode accent (or the hint violet): the shared glossy tile, recolored. */
function accentTile(accent: string): React.CSSProperties {
  return {
    ['--gt-edge' as string]: darken(accent, 0.35),
    ['--gt-face' as string]: `linear-gradient(${softMix(accent, 0.7)}, ${accent} 70%, ${darken(accent, 0.08)})`,
    ['--gt-ring' as string]: 'none',
    ['--gt-glow' as string]: `${accent}99`,
  };
}

// FINISH_SPEC B1: the rungs are the shared glossy tiles — START purple, a
// changed letter in the accent, the rest plain light tiles; the typing row is
// frosted / typed; END a frosted target with a dashed accent ring.
function LadderTile({ letter, kind, changed, invalid, bad, outIndex }: { letter: string; kind: RowKind; changed: boolean; invalid?: boolean; bad?: boolean; outIndex?: number }) {
  let look: TileLook = 'given';
  let style: React.CSSProperties | undefined;
  switch (kind) {
    case 'start':
      look = 'correct'; break;
    case 'rung':
    case 'hint':
      if (changed) { look = 'correct'; style = accentTile(kind === 'hint' ? HINT : LADDER_ACCENT); }
      else look = 'given';
      break;
    case 'typing':
      look = letter ? 'typed' : 'empty';
      break;
    case 'end':
      look = 'empty';
      style = { ['--gt-glyph' as string]: LADDER_ACCENT, outline: `2px dashed ${LADDER_ACCENT}88`, outlineOffset: -2, borderRadius: '22%' };
      break;
    case 'reveal':
      look = 'gap'; style = { ['--gt-glyph' as string]: '#9ca3af' }; break;
  }
  return (
    <LetterTile
      letter={letter}
      look={look}
      pop={kind === 'typing' && !!letter ? undefined : false}
      invalid={kind === 'typing' && invalid && !!letter}
      bad={bad && !!letter}
      outIndex={outIndex}
      className="h-full"
      style={style}
      role="gridcell"
      aria-label={letter || 'empty'}
    />
  );
}

function LadderRow({ word, prev, kind, invalid, shaking, tile }: { word: string; prev?: string; kind: RowKind; invalid?: boolean; shaking?: boolean; tile?: number }) {
  const tiles = word.padEnd(5, ' ').split('');
  return (
    <div className={cn('flex gap-1 justify-center shrink-0', tile == null && 'h-[clamp(34px,7.5vmin,52px)]', shaking && 'gt-nudge')} style={tile != null ? { height: tile } : undefined} role="row">
      {tiles.map((ch, i) => (
        <LadderTile key={i} letter={ch === ' ' ? '' : ch} kind={kind} changed={!!prev && prev[i] !== ch} invalid={invalid} bad={shaking} outIndex={tiles.length - 1 - i} />
      ))}
    </div>
  );
}

interface LadderBoardProps {
  state: LadderState;
  typing: string;
  invalid: boolean;
  shaking: boolean;
  /** After a loss: the canonical shortest path, muted. */
  revealPath: boolean;
}

export const LadderBoard = memo(function LadderBoard({ state, typing, invalid, shaking, revealPath }: LadderBoardProps) {
  const playing = state.status === 'playing';
  return (
    <div className="flex flex-col gap-1.5 items-center w-full" role="grid" aria-label="Letter Ladder" style={{ ['--gt-font' as string]: 'calc(clamp(34px, 7.5vmin, 52px) * 0.55)' } as React.CSSProperties}>
      {/* FINISH_SPEC L: the ladder's rungs sit on the shared game tray. */}
      <GameTray accent={LADDER_ACCENT} state={trayStateFor(state.status)} className="w-fit max-w-full flex flex-col gap-1.5 items-center">
        {state.words.map((w, i) => (
          <LadderRow key={`${i}-${w}`} word={w} prev={i > 0 ? state.words[i - 1] : undefined}
            kind={i === 0 ? 'start' : state.hintMask[i] === '1' ? 'hint' : 'rung'} />
        ))}
        {playing && <LadderRow word={typing} prev={state.words[state.words.length - 1]} kind="typing" invalid={invalid} shaking={shaking} />}
        {state.words[state.words.length - 1] !== state.end && (
          <>
            <div className="text-[10px] font-black tracking-wider" style={{ color: `${LADDER_ACCENT}aa` }}>↓ {state.status === 'playing' ? 'REACH' : 'TARGET'}</div>
            <LadderRow word={state.end} kind="end" />
          </>
        )}
      </GameTray>
      {revealPath && (
        <div className="mt-2 flex flex-col gap-1 items-center">
          <div className="text-[10px] font-black tracking-wider text-gray-400">ONE SHORTEST ROUTE</div>
          {state.path.map((w, i) => <LadderRow key={`p${i}`} word={w} prev={i > 0 ? state.path[i - 1] : undefined} kind="reveal" />)}
        </div>
      )}
    </div>
  );
});

/**
 * The live ladder (Doug, Android 10-05: a few rungs pushed the REACH row out of
 * the board): it fills its slot — every rung, the typing row, REACH and the target
 * sized to fit (lib/ladder-fit.ts) — and a ladder too long even at the smallest
 * tile scrolls only its climbed rungs (kept at the newest); the typing row and the
 * target stay pinned in view.
 */
export function LadderPlayBoard({ state, typing, invalid, shaking }: Omit<LadderBoardProps, 'revealPath'>) {
  const slotRef = useRef<HTMLDivElement>(null);
  const rungsRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const measure = () => setBox((b) => (b && b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const showEnd = state.words[state.words.length - 1] !== state.end;
  const vmin = typeof window === 'undefined' ? 800 : Math.min(window.innerWidth, window.innerHeight);
  const fit = box ? ladderFit(box.w, box.h, state.words.length, showEnd, 14, Math.min(52, Math.max(34, vmin * 0.075))) : null;
  useEffect(() => {
    const r = rungsRef.current;
    if (r) r.scrollTop = r.scrollHeight;
  }, [state.words.length, fit?.scrolls]);
  const gap = fit?.gap ?? 6;
  return (
    <div ref={slotRef} className="flex-1 min-h-0 w-full flex justify-center items-start">
      {fit && (
        <GameTray accent={LADDER_ACCENT} state={trayStateFor(state.status)} role="grid" aria-label="Letter Ladder"
          className="w-fit max-w-full min-h-0 flex flex-col items-center"
          style={{ gap, maxHeight: box!.h, ['--gt-font' as string]: `${fit.tile * 0.55}px` } as React.CSSProperties}>
          <div ref={rungsRef} className="min-h-0 overflow-y-auto flex flex-col items-center [scrollbar-width:none]"
            style={{ gap, ...(fit.scrolls ? { maskImage: 'linear-gradient(transparent, #000 14px)', WebkitMaskImage: 'linear-gradient(transparent, #000 14px)' } : null) }}>
            {state.words.map((w, i) => (
              <LadderRow key={`${i}-${w}`} word={w} prev={i > 0 ? state.words[i - 1] : undefined} tile={fit.tile}
                kind={i === 0 ? 'start' : state.hintMask[i] === '1' ? 'hint' : 'rung'} />
            ))}
          </div>
          <LadderRow word={typing} prev={state.words[state.words.length - 1]} kind="typing" invalid={invalid} shaking={shaking} tile={fit.tile} />
          {showEnd && (
            <>
              <div className="shrink-0 text-[10px] leading-[14px] font-black tracking-wider" style={{ color: `${LADDER_ACCENT}aa` }}>↓ REACH</div>
              <LadderRow word={state.end} kind="end" tile={fit.tile} />
            </>
          )}
        </GameTray>
      )}
    </div>
  );
}

/** Rungs (START included) a finished ladder shows in full before it collapses to a summary. */
export const LADDER_SUMMARY_AFTER = 4;

/**
 * FINISH_SPEC R2: the finished ladder on one screen. A short ladder shows
 * every rung; a longer one collapses to START, a "+N steps" chip and the last
 * rung (then TARGET when it was never reached). A loss names one shortest
 * route on a single line, so nobody leaves without the answer. The full
 * ladder (LadderBoard) sits under the finished screen's "See all steps".
 */
export function LadderSummary({ state }: { state: LadderState }) {
  const words = state.words;
  const last = words.length - 1;
  const reached = words[last] === state.end;
  const lost = state.status === 'lost';
  const collapse = words.length > LADDER_SUMMARY_AFTER;
  const hidden = collapse ? words.length - 2 : 0;
  const kindAt = (i: number): RowKind => (i === 0 ? 'start' : state.hintMask[i] === '1' ? 'hint' : 'rung');
  return (
    <div className="flex flex-col gap-1.5 items-center w-full" role="grid" aria-label={`Letter Ladder, ${last} step${last === 1 ? '' : 's'}`} style={{ ['--gt-font' as string]: 'calc(clamp(34px, 7.5vmin, 52px) * 0.55)' } as React.CSSProperties}>
      <GameTray accent={LADDER_ACCENT} state={trayStateFor(state.status)} className="w-fit max-w-full flex flex-col gap-1.5 items-center">
        {collapse ? (
          <>
            <LadderRow word={words[0]} kind="start" />
            <div className="text-[11px] font-black tracking-wider px-2.5 py-0.5 rounded-full" style={{ color: LADDER_ACCENT, background: `${LADDER_ACCENT}1a` }}>
              + {hidden} step{hidden === 1 ? '' : 's'}
            </div>
            <LadderRow word={words[last]} prev={words[last - 1]} kind={kindAt(last)} />
          </>
        ) : (
          words.map((w, i) => <LadderRow key={`${i}-${w}`} word={w} prev={i > 0 ? words[i - 1] : undefined} kind={kindAt(i)} />)
        )}
        {!reached && (
          <>
            <div className="text-[10px] font-black tracking-wider" style={{ color: `${LADDER_ACCENT}aa` }}>↓ TARGET</div>
            <LadderRow word={state.end} kind="end" />
          </>
        )}
      </GameTray>
      {lost && state.path.length > 0 && (
        <div className="text-center max-w-full px-2">
          <div className="text-[10px] font-black tracking-wider" style={{ color: 'var(--color-text-muted)' }}>ONE SHORTEST ROUTE</div>
          <div className="text-[13px] font-black break-words" style={{ color: 'var(--color-text)' }}>{state.path.join(' → ')}</div>
        </div>
      )}
    </div>
  );
}
