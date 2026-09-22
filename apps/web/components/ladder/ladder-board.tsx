'use client';

import { memo } from 'react';
import { cn } from '@/lib/utils';
import type { LadderState } from '@wordle-duel/core';

// The ladder (More Games §15): Classic tiles, one row per rung. START is a
// filled purple row, each accepted rung is a white row with the CHANGED letter
// filled in the mode accent (hint rungs: the violet hint colour) and ringed,
// the typing row is the empty bordered row, and END waits at the bottom as a
// dashed target. On a loss the canonical shortest path is shown muted below
// the ladder so nobody leaves without the answer.

export const LADDER_ACCENT = '#0284c7';
const HINT = '#8b5cf6';

type RowKind = 'start' | 'rung' | 'hint' | 'typing' | 'end' | 'reveal';

function LadderTile({ letter, kind, changed, invalid }: { letter: string; kind: RowKind; changed: boolean; invalid?: boolean }) {
  const base = 'h-full aspect-square border-2 rounded-[14%] flex items-center justify-center text-[clamp(0.875rem,4vmin,1.5rem)] font-black uppercase transition-colors';
  let cls = '';
  let style: React.CSSProperties | undefined;
  switch (kind) {
    case 'start':
      cls = 'tile-correct text-white'; break;
    case 'rung':
    case 'hint':
      if (changed) { cls = 'text-white'; style = { background: kind === 'hint' ? HINT : LADDER_ACCENT, borderColor: kind === 'hint' ? HINT : LADDER_ACCENT, boxShadow: `0 0 0 2px var(--color-surface), 0 0 0 4px ${kind === 'hint' ? HINT : LADDER_ACCENT}55` }; }
      else { cls = 'border-gray-300 bg-white text-gray-800'; }
      break;
    case 'typing':
      cls = invalid ? 'border-red-400 bg-red-50 text-red-500' : letter ? 'border-gray-400 bg-white text-gray-800' : 'border-gray-300 bg-white text-gray-800';
      break;
    case 'end':
      cls = 'border-dashed bg-transparent'; style = { borderColor: `${LADDER_ACCENT}88`, color: LADDER_ACCENT }; break;
    case 'reveal':
      cls = 'border-gray-200 bg-gray-50 text-gray-400'; break;
  }
  return <div className={cn(base, cls)} style={style} role="gridcell" aria-label={letter || 'empty'}>{letter}</div>;
}

function LadderRow({ word, prev, kind, invalid, shaking }: { word: string; prev?: string; kind: RowKind; invalid?: boolean; shaking?: boolean }) {
  const tiles = word.padEnd(5, ' ').split('');
  return (
    <div className={cn('flex gap-1 justify-center h-[clamp(34px,7.5vmin,52px)]', shaking && 'animate-shake')} role="row">
      {tiles.map((ch, i) => (
        <LadderTile key={i} letter={ch === ' ' ? '' : ch} kind={kind} changed={!!prev && prev[i] !== ch} invalid={invalid} />
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
    <div className="flex flex-col gap-1.5 items-center w-full" role="grid" aria-label="Letter Ladder">
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
