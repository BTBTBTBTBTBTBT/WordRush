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
  /** Measured tile box from the game's band fit (founder, 2026-09-28); null until the first measurement, when the vw clamp stands in. */
  fit?: { h: number; w: number } | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Approximate advance of a black uppercase glyph in ems, for the one-line shrink-to-fit. */
const GLYPH_EM = 0.66;

/** The unsolved words as a 4-wide grid of Classic-style tiles; selected tiles fill with the accent; hinted pairs wear a ring. */
export const TileGrid = memo(function TileGrid({ state, onToggle, shaking, fit = null }: TileGridProps) {
  const ringed = new Set(state.pairs.flat().filter((w) => state.tiles.includes(w)));
  return (
    <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 w-full max-w-md ${shaking ? 'animate-shake' : ''}`} role="group" aria-label="Words" data-groups-grid="">
      {state.tiles.map((w) => {
        const sel = state.selected.includes(w);
        const long = w.length > 8;
        // Tile font scales with the tile (founder, 2026-09-28): normal words clamp(h × 0.22, 12, 15),
        // long words clamp(h × 0.18, 10, 13), then shrunk to one line against the tile width;
        // only when even 9px cannot hold the word does it fall back to wrapping.
        let fontSize: number | undefined;
        let oneLine = false;
        if (fit) {
          const base = long ? clamp(fit.h * 0.18, 10, 13) : clamp(fit.h * 0.22, 12, 15);
          const fitted = Math.min(base, (fit.w - 8) / (GLYPH_EM * w.length));
          oneLine = fitted >= 9;
          fontSize = oneLine ? Math.floor(fitted * 2) / 2 : base;
        }
        return (
          <button
            key={w}
            type="button"
            onClick={() => onToggle(w)}
            aria-pressed={sel}
            className={`btn-3d rounded-lg border-2 font-black uppercase flex items-center justify-center text-center leading-none px-1 transition-colors ${fit ? '' : `h-[clamp(52px,12vw,68px)] ${long ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}`}
            style={{
              background: sel ? GROUPS_ACCENT : 'var(--color-surface)',
              borderColor: sel ? GROUPS_ACCENT : 'var(--color-border)',
              color: sel ? '#fff' : 'var(--color-text)',
              boxShadow: ringed.has(w) ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${PAIR_RING}` : undefined,
              height: fit ? fit.h : undefined,
              fontSize,
              whiteSpace: oneLine ? 'nowrap' : undefined,
              wordBreak: oneLine ? undefined : 'break-word',
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

interface ProgressRailProps {
  solvedTiers: number[];
  total: number;
  mistakes: number;
  maxMistakes: number;
}

/**
 * One row between the grid and the solved bars (founder, 2026-09-28): `Groups · N of 4` with four
 * tier pips in the TIER_STYLE ramp (filled once that tier is found, a 1.5px ring until then) on the
 * left and Mistakes left on the right. It exists from the first second so the lower band never
 * starts fully empty; the max-width matches the grid.
 */
export function ProgressRail({ solvedTiers, total, mistakes, maxMistakes }: ProgressRailProps) {
  const found = solvedTiers.length;
  return (
    <div className="w-full max-w-md flex items-center justify-between gap-2 px-0.5" role="group" aria-label={`${found} of ${total} groups found`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Groups</span>
        <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{found} of {total}</span>
        {Array.from({ length: total }, (_, i) => {
          const tier = i + 1;
          const st = TIER_STYLE[tier] ?? TIER_STYLE[4];
          const done = solvedTiers.includes(tier);
          return (
            <span
              key={tier}
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={done ? { background: st.bg } : { border: `1.5px solid ${st.bg}` }}
              aria-hidden
            />
          );
        })}
      </div>
      <MistakeDots mistakes={mistakes} max={maxMistakes} />
    </div>
  );
}
