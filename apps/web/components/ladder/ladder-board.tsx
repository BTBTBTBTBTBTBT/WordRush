'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { LadderState } from '@wordle-duel/core';
import { LetterTile, type TileLook } from '@/components/game/letter-tile';
import { darken, softMix } from '@/lib/soft-surface';

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

function LadderRow({ word, prev, kind, invalid, shaking }: { word: string; prev?: string; kind: RowKind; invalid?: boolean; shaking?: boolean }) {
  const tiles = word.padEnd(5, ' ').split('');
  return (
    <div className={cn('flex gap-1 justify-center h-[clamp(34px,7.5vmin,52px)]', shaking && 'gt-nudge')} role="row">
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
      {revealPath && (
        <div className="mt-2 flex flex-col gap-1 items-center">
          <div className="text-[10px] font-black tracking-wider text-gray-400">ONE SHORTEST ROUTE</div>
          {state.path.map((w, i) => <LadderRow key={`p${i}`} word={w} prev={i > 0 ? state.path[i - 1] : undefined} kind="reveal" />)}
        </div>
      )}
    </div>
  );
});
