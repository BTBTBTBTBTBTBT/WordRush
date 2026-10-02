'use client';

import { useMemo, type ReactNode } from 'react';
import { GameArt } from '@/components/ui/game-art';
import { useFlags } from '@/hooks/use-flags';
import { pickerRows, type PickerTile } from '@/lib/game-picker';
import { SOFT, alphaHex, cardBarStyle, softCard, softIconTile } from '@/lib/soft-surface';

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
}

const BADGE_BG: Record<GamePickerBadge['kind'], string> = { won: '#7c3aed', lost: '#6b7891', done: '#7c3aed' };
const BADGE_TEXT: Record<GamePickerBadge['kind'], string> = { won: 'W', lost: 'L', done: '✓' };

function Tile({ t, on, badge, onSelect, size }: { t: PickerTile; on: boolean; badge?: GamePickerBadge; onSelect: (k: string) => void; size?: number }) {
  return (
    <button
      type="button"
      aria-label={t.title}
      aria-pressed={on}
      onClick={() => onSelect(t.key)}
      className="relative flex items-center justify-center min-w-0"
      style={{ ...softIconTile(t.accent, { selected: on, radius: size ? 9 : 11 }), ...(size ? { flex: 'none', width: size, height: size } : { flex: '1 1 0', aspectRatio: '1 / 1', maxWidth: 44 }), padding: 0 }}
    >
      <GameArt id={t.artId} size={64} style={{ width: '74%', height: '74%', marginTop: 2 }} />
      {badge && (
        <span
          aria-label={badge.kind === 'won' ? 'Won today' : badge.kind === 'lost' ? 'Lost today' : 'Done today'}
          className="absolute flex items-center justify-center font-black text-white"
          style={{ top: -4, right: -4, width: 15, height: 15, borderRadius: 5, fontSize: 9, background: BADGE_BG[badge.kind], boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
        >
          {BADGE_TEXT[badge.kind]}
        </span>
      )}
    </button>
  );
}

export function GamePicker({
  selected, onSelect, accent = '#f59e0b', header, wordociousExtra, sweep = true, badges, ink, bar = false, className = '', label = 'Pick a game', layout = 'rows',
}: GamePickerProps) {
  const { isOn } = useFlags();
  const rows = useMemo(() => pickerRows(isOn, { sweep }), [isOn, sweep]);
  const labelInk = ink ?? alphaHex(accent, 1);
  const rowLabel = (text: string) => (
    <span className="text-[11px] font-black picker-label" style={{ letterSpacing: '0.12em', color: labelInk }}>{text}</span>
  );
  const row = (tiles: PickerTile[]) => (
    <div className="flex" style={{ gap: 5 }} role="group">
      {tiles.map((t) => (
        <Tile key={t.key} t={t} on={selected === t.key} badge={badges?.[t.key]} onSelect={onSelect} />
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
  return (
    <div className={`relative overflow-hidden ${className}`} style={softCard(accent, { radius: 20 })} role="group" aria-label={label}>
      {bar && <div aria-hidden="true" style={cardBarStyle(accent, SOFT.bar)} />}
      {header != null && (
        <div style={{ padding: '10px 14px', background: alphaHex(accent, 0.08) }}>{header}</div>
      )}
      <div className="grid" style={{ gap: 8, padding: '12px 12px 14px' }}>
        <div className="flex items-center justify-between gap-2">
          {rowLabel('WORDOCIOUS')}
          {wordociousExtra}
        </div>
        {row(rows.wordocious)}
        {rows.puzzles.length > 0 && (
          <>
            <div style={{ marginTop: 4 }}>{rowLabel('PUZZLES')}</div>
            {row(rows.puzzles)}
          </>
        )}
      </div>
    </div>
  );
}
