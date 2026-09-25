'use client';

import { memo } from 'react';
import type { GroupsGroup, GroupsState } from '@wordle-duel/core';

export const GROUPS_ACCENT = '#9f1239';
/** Tier ramp (More Games §14): one hue, four lightnesses — plus pips, never color alone. */
export const TIER_STYLE: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#ddd6fe', fg: '#3b0764' },
  2: { bg: '#a78bfa', fg: '#1a1a2e' },
  3: { bg: '#7c3aed', fg: '#ffffff' },
  4: { bg: '#1a1a2e', fg: '#ffffff' },
};
const PAIR_RING = '#8b5cf6';

/** A solved (or revealed) group as a full-width bar: pips for the tier, the label, the four words. */
export const GroupBar = memo(function GroupBar({ group, revealed = false }: { group: GroupsGroup; revealed?: boolean }) {
  const st = TIER_STYLE[group.tier] ?? TIER_STYLE[1];
  return (
    <div className="w-full rounded-xl px-3 py-2 flex flex-col items-center gap-0.5 animate-fade-in-up" style={{ background: st.bg, color: st.fg, opacity: revealed ? 0.85 : 1, border: revealed ? '2px dashed rgba(255,255,255,0.5)' : undefined }} role="group" aria-label={`${group.label}: ${group.words.join(', ')}`}>
      <div className="flex items-center gap-2">
        <span className="text-[8px] tracking-[2px]" aria-hidden>{'●'.repeat(group.tier)}</span>
        <span className="text-sm font-black">{group.label}</span>
      </div>
      <span className="text-xs font-bold tracking-wide">{group.words.join(', ')}</span>
    </div>
  );
});

interface TileGridProps {
  state: GroupsState;
  onToggle: (word: string) => void;
  shaking: boolean;
}

/** The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles fill with the accent; hinted pairs wear a ring. */
export const TileGrid = memo(function TileGrid({ state, onToggle, shaking }: TileGridProps) {
  const ringed = new Set(state.pairs.flat().filter((w) => state.tiles.includes(w)));
  return (
    <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 w-full max-w-md ${shaking ? 'animate-shake' : ''}`} role="group" aria-label="Words">
      {state.tiles.map((w) => {
        const sel = state.selected.includes(w);
        const long = w.length > 8;
        return (
          <button
            key={w}
            type="button"
            onClick={() => onToggle(w)}
            aria-pressed={sel}
            className={`btn-3d rounded-lg border-2 font-black uppercase flex items-center justify-center text-center leading-none h-[clamp(52px,12vw,68px)] px-1 ${long ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'} transition-colors`}
            style={{
              background: sel ? GROUPS_ACCENT : 'var(--color-surface)',
              borderColor: sel ? GROUPS_ACCENT : 'var(--color-border)',
              color: sel ? '#fff' : 'var(--color-text)',
              boxShadow: ringed.has(w) ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${PAIR_RING}` : undefined,
              wordBreak: 'break-word',
            }}
          >
            {w}
          </button>
        );
      })}
    </div>
  );
});

/** Four dots: filled while a mistake remains. */
export function MistakeDots({ mistakes, max }: { mistakes: number; max: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${max - mistakes} mistakes remaining`}>
      <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Mistakes left</span>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: i < max - mistakes ? GROUPS_ACCENT : 'var(--color-border)' }} />
      ))}
    </div>
  );
}
