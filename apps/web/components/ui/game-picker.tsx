'use client';

import { useMemo, type ReactNode } from 'react';
import { GameArt } from '@/components/ui/game-art';
import { useFlags } from '@/hooks/use-flags';
import { pickerRows, type PickerTile } from '@/lib/game-picker';
import { useGameOrder } from '@/lib/game-order-store';
import { SOFT, alphaHex, cardBarStyle, liftedInk, softCard, softIconTile } from '@/lib/soft-surface';

// The one game picker (docs/FINISH_SPEC.md C2, C2b, C3; mockup
// docs/design/brand/mockups/leaderboard-polish.html `.picker`): a tinted card
// whose header row is the caller's (the Leaderboard's date · reset clock +
// ALL-TIME, the Stats page's Today | All-time toggle), then the WORDOCIOUS
// row (eight dailies + the Sweep broom as the 9th tile) and the PUZZLES row.
// Every game is visible at once — tiles shrink to fit, never scroll. Each
// tile is a mini game card in its game's accent; the selected one takes a
// stronger tint + an accent ring. Used by the Leaderboard, Records and Stats.

export interface GamePickerBadge {
  /** 'won' → purple W, 'lost' → slate L, 'done' → purple check. */
  kind: 'won' | 'lost' | 'done';
}

interface GamePickerProps {
  /** The selected key (a daily db key or 'SWEEP'); null = no tile selected (Stats' Today / All-time). */
  selected: string | null;
  onSelect: (key: string) => void;
  /** The card's accent (Leaderboard gold, Stats blue). */
  accent?: string;
  /** The header row above the WORDOCIOUS row (date line, toggle). */
  header?: ReactNode;
  /** Right side of the WORDOCIOUS label line. */
  wordociousExtra?: ReactNode;
  /** Include the Sweep tile (default on). */
  sweep?: boolean;
  /** A small corner badge per tile key (Stats: today's W / L). */
  badges?: Record<string, GamePickerBadge | undefined>;
  /** Label ink for the row labels. */
  ink?: string;
  /** Draw the card's 10 px top bar. */
  bar?: boolean;
  className?: string;
  /** Accessible name of the tile group. */
  label?: string;
  /** AU2: 'strip' = ONE horizontally scrolling row of smaller tiles (Wordocious, a divider, Puzzles). */
  layout?: 'rows' | 'strip';
  /** BB3: 'compact' rows — tiles ≤ 32 px, tighter gaps (the Leaderboard). */
  density?: 'regular' | 'compact';
  /** BB1: a title above the header row (the selected game's title art). */
  title?: ReactNode;
  /** 11b: no card / header — the picker sits directly on the Leaderboard stage's backdrop. */
  bare?: boolean;
}

const BADGE_BG: Record<GamePickerBadge['kind'], string> = { won: '#7c3aed', lost: '#6b7891', done: '#7c3aed' };
const BADGE_TEXT: Record<GamePickerBadge['kind'], string> = { won: 'W', lost: 'L', done: '✓' };

/** 2.8 item 8: the ONE W / L corner badge (the Sudocious finish screen's picker tile; Home's banner tiles use it too). */
export function PickerResultBadge({ kind, size = 15 }: { kind: GamePickerBadge['kind']; size?: number }) {
  return (
    <span
      aria-label={kind === 'won' ? 'Won today' : kind === 'lost' ? 'Lost today' : 'Done today'}
      className="absolute flex items-center justify-center font-black text-white"
      style={{ top: -4, right: -4, width: size, height: size, borderRadius: Math.round(size / 3), fontSize: Math.round(size * 0.6), background: BADGE_BG[kind], boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
    >
      {BADGE_TEXT[kind]}
    </span>
  );
}

function Tile({ t, on, badge, onSelect, size, maxSize = 44, slots, gap = 5 }: { t: PickerTile; on: boolean; badge?: GamePickerBadge; onSelect: (k: string) => void; size?: number; maxSize?: number; slots?: number; gap?: number }) {
  // 2.8 item 8: with `slots`, every row's tile is the same size — the width of one of `slots` equal cells.
  const sized = size ? { flex: 'none', width: size, height: size }
    : slots ? { flex: 'none', width: `min(${maxSize}px, calc((100% - ${gap * (slots - 1)}px) / ${slots}))`, aspectRatio: '1 / 1' }
    : { flex: '1 1 0', aspectRatio: '1 / 1', maxWidth: maxSize };
  return (
    <button
      type="button"
      aria-label={t.title}
      aria-pressed={on}
      onClick={() => onSelect(t.key)}
      className="relative flex items-center justify-center min-w-0"
      style={{ ...softIconTile(t.accent, { selected: on, radius: size ? 9 : 11 }), ...sized, padding: 0 }}
    >
      <GameArt id={t.artId} size={64} style={{ width: '74%', height: '74%', marginTop: 2 }} />
      {badge && <PickerResultBadge kind={badge.kind} />}
    </button>
  );
}

export function GamePicker({
  selected, onSelect, accent = '#f59e0b', header, wordociousExtra, sweep = true, badges, ink, bar = false, className = '', label = 'Pick a game', layout = 'rows', density = 'regular', title, bare = false,
}: GamePickerProps) {
  const compact = density === 'compact';
  const { isOn } = useFlags();
  const { order: gameOrderPrefs } = useGameOrder();
  const rows = useMemo(() => pickerRows(isOn, { sweep, order: gameOrderPrefs }), [isOn, sweep, gameOrderPrefs]);
  const labelInk = ink ?? liftedInk(alphaHex(accent, 1));
  const rowLabel = (text: string) => (
    <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-black picker-label`} style={{ letterSpacing: '0.12em', color: labelInk }}>{text}</span>
  );
  // Both rows share ONE tile size and gap (sized for the longer row), centered — like Home's banner rows.
  const slots = Math.max(rows.wordocious.length, rows.puzzles.length);
  const gap = compact ? 5 : 6;
  const row = (tiles: PickerTile[]) => (
    <div className="flex justify-center" style={{ gap }} role="group">
      {tiles.map((t) => (
        <Tile key={t.key} t={t} on={selected === t.key} badge={badges?.[t.key]} onSelect={onSelect} maxSize={compact ? 34 : 44} slots={slots} gap={gap} />
      ))}
    </div>
  );
  if (layout === 'strip') {
    // AU2: one scrolling row — the selected tile scrolls into view on mount.
    return (
      <div className={`relative overflow-hidden ${className}`} style={softCard(accent, { radius: 16 })} role="group" aria-label={label}>
        {header != null && (
          <div style={{ padding: '6px 12px', background: alphaHex(accent, 0.08) }}>{header}</div>
        )}
        <div
          className="flex items-center overflow-x-auto"
          style={{ gap: 5, padding: '8px 10px 9px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          ref={(el) => { const on = el?.querySelector<HTMLElement>('[aria-pressed="true"]'); if (on && el && el.dataset.scrolled !== '1') { el.dataset.scrolled = '1'; el.scrollLeft = Math.max(0, on.offsetLeft - el.clientWidth / 2 + on.clientWidth / 2); } }}
        >
          {rows.wordocious.map((t) => <Tile key={t.key} t={t} on={selected === t.key} badge={badges?.[t.key]} onSelect={onSelect} size={36} />)}
          {rows.puzzles.length > 0 && (
            <span aria-hidden="true" className="shrink-0 self-stretch" style={{ width: 2, margin: '2px 4px', borderRadius: 2, background: alphaHex(accent, 0.3) }} />
          )}
          {rows.puzzles.map((t) => <Tile key={t.key} t={t} on={selected === t.key} badge={badges?.[t.key]} onSelect={onSelect} size={36} />)}
        </div>
      </div>
    );
  }
  if (bare) {
    // Item 11b: the stage's own picker — no card, no header; it sits on the stage's backdrop.
    return (
      <div className={`relative ${className}`} role="group" aria-label={label}>
        <div className="grid" style={{ gap: 4, padding: '4px 12px 6px' }}>
          {row(rows.wordocious)}
          {rows.puzzles.length > 0 && row(rows.puzzles)}
        </div>
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden ${className}`} style={softCard(accent, { radius: 20 })} role="group" aria-label={label}>
      {bar && <div aria-hidden="true" style={cardBarStyle(accent, SOFT.bar)} />}
      {title != null && <div className="flex justify-center" style={{ padding: '8px 12px 0' }}>{title}</div>}
      {header != null && (
        <div style={{ padding: compact ? '6px 12px' : '10px 14px', background: alphaHex(accent, 0.08) }}>{header}</div>
      )}
      <div className="grid" style={{ gap: compact ? 4 : 8, padding: compact ? '6px 10px 8px' : '12px 12px 14px' }}>
        <div className="flex items-center justify-between gap-2">
          {rowLabel('WORDOCIOUS')}
          {wordociousExtra}
        </div>
        {row(rows.wordocious)}
        {rows.puzzles.length > 0 && (
          <>
            <div style={{ marginTop: compact ? 2 : 4 }}>{rowLabel('PUZZLES')}</div>
            {row(rows.puzzles)}
          </>
        )}
      </div>
    </div>
  );
}
