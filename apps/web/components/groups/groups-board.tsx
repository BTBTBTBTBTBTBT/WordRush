'use client';

import { memo } from 'react';
import type { GroupsGroup, GroupsState } from '@wordle-duel/core';
import { GameTray } from '@/components/ui/game-tray';
import { glossyChip, tintedChip } from '@/lib/puzzle-look';
import { alphaHex, cardBarStyle, softCard } from '@/lib/soft-surface';

export const GROUPS_ACCENT = '#9f1239';
/** Tier ramp (More Games §14): one hue, four lightnesses — plus pips, never color alone. */
export const TIER_STYLE: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#ddd6fe', fg: '#3b0764' },
  2: { bg: '#a78bfa', fg: '#1a1a2e' },
  3: { bg: '#7c3aed', fg: '#ffffff' },
  4: { bg: '#1a1a2e', fg: '#ffffff' },
};
/**
 * The wash each tier's solved card takes (A1): the ramp itself is too pale at
 * tier 1 to tint a card, so the washes step one shade deeper; the card's top
 * bar keeps the exact TIER_STYLE ramp color.
 */
export const TIER_WASH: Record<number, string> = { 1: '#a78bfa', 2: '#8b5cf6', 3: '#6d28d9', 4: '#1a1a2e' };
const PAIR_RING = '#8b5cf6';
/** Lip under each word chip (px). */
const CHIP_LIP = 4;

/**
 * A solved (or revealed) group (FINISH_SPEC J3): a tinted card in its tier's
 * wash with the game-card top bar in the tier color — pips for the tier, the
 * label, the four words. A revealed (missed) group is dashed and a touch faded.
 */
export const GroupBar = memo(function GroupBar({ group, revealed = false }: { group: GroupsGroup; revealed?: boolean }) {
  const st = TIER_STYLE[group.tier] ?? TIER_STYLE[1];
  const wash = TIER_WASH[group.tier] ?? TIER_WASH[1];
  const card = softCard(wash, { radius: 14 });
  return (
    <div
      className="w-full overflow-hidden animate-fade-in-up"
      style={{ ...card, ...(revealed ? { border: `2px dashed ${alphaHex(wash, 0.55)}`, opacity: 0.85 } : null) }}
      role="group"
      aria-label={`${group.label}: ${group.words.join(', ')}`}
    >
      <div style={cardBarStyle(st.bg, 8)} aria-hidden />
      <div className="px-3 pt-1.5 pb-2 flex flex-col items-center gap-0.5" style={{ color: 'var(--color-text)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[8px] tracking-[2px]" style={{ color: wash }} aria-hidden>{'●'.repeat(group.tier)}</span>
          <span className="text-sm font-black">{group.label}</span>
        </div>
        <span className="text-xs font-bold tracking-wide" style={{ color: 'var(--color-text-muted)' }}>{group.words.join(', ')}</span>
      </div>
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

/**
 * The unsolved words as a 4-wide grid of glossy chips (FINISH_SPEC J3) on the
 * shared game tray (L): a tinted face with a top gloss and a darker bottom lip;
 * a selected word fills with the game accent (white ink) — never its group's
 * tier color, which would give the answer away; hinted pairs wear a ring.
 * The tray carries `data-groups-grid` so the game's band fit finds it.
 */
export const TileGrid = memo(function TileGrid({ state, onToggle, shaking, fit = null }: TileGridProps) {
  const ringed = new Set(state.pairs.flat().filter((w) => state.tiles.includes(w)));
  return (
    <GameTray accent={GROUPS_ACCENT} padding={8} className="w-full max-w-md" data-groups-grid="">
      <div className={`grid grid-cols-4 gap-1.5 sm:gap-2 w-full ${shaking ? 'animate-shake' : ''}`} role="group" aria-label="Words">
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
          const chip = sel ? glossyChip(GROUPS_ACCENT, { lip: CHIP_LIP }) : tintedChip(GROUPS_ACCENT, { lip: CHIP_LIP });
          const ring = ringed.has(w) ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${PAIR_RING}` : null;
          return (
            <button
              key={w}
              type="button"
              onClick={() => onToggle(w)}
              aria-pressed={sel}
              className={`rounded-xl font-black uppercase flex items-center justify-center text-center leading-none px-1 transition-colors ${fit ? '' : `h-[clamp(52px,12vw,68px)] ${long ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'}`}`}
              style={{
                ...chip,
                color: sel ? '#ffffff' : 'var(--color-text)',
                boxShadow: ring ? `${chip.boxShadow}, ${ring}` : chip.boxShadow,
                paddingBottom: CHIP_LIP,
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
    </GameTray>
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
