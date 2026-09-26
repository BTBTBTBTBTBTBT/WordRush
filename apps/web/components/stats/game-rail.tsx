'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { CalendarDays, Swords, Trophy, LayoutGrid, X } from 'lucide-react';
import type { ModeMeta } from '@/lib/modes.generated';
import type { DailyCompletion } from '@/lib/daily-service';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { WIN_FG } from '@/lib/tile-theme';

// The Stats tab's game rail (Stats + Friends redesign D2, founder 2026-09-26:
// "I don't want to swipe right through 19 different games … flow like
// butter"). One horizontal row of chips: Today · the eight sweep games · VS ·
// the More Games titles · All-time. Tap jumps straight to that page; a swipe on
// the page below moves one chip; HOLD the Today chip (or tap the grid button)
// for the whole set as a 5-wide grid so any game is one tap away. Each game
// chip wears today's W/L dot. iOS StatsRail / Android StatsRail are the twins.

export const RAIL_TODAY = 'today';
export const RAIL_VS = 'vs';
export const RAIL_ALL = 'all';

export interface RailItem {
  key: string;                 // 'today' | 'vs' | 'all' | a daily mode dbKey
  label: string;
  icon: ComponentType<any> | null;
  romanNumeral?: string;
  accent: string;
  /** Today's result dot on a game chip (null = not played). */
  dot?: 'won' | 'lost' | null;
}

export function buildRailItems(
  sweepModes: ModeMeta[],
  moreModes: ModeMeta[],
  todayDailies: Map<string, DailyCompletion>,
  vsDailyWon: boolean | null,
): RailItem[] {
  const game = (m: ModeMeta): RailItem => {
    const r = m.dbKey ? todayDailies.get(m.dbKey) : undefined;
    return {
      key: m.dbKey as string,
      label: m.shortTitle,
      icon: MODE_CHROME[m.id]?.icon ?? null,
      romanNumeral: m.romanNumeral ?? undefined,
      accent: m.accentHex,
      dot: r ? (r.won ? 'won' : 'lost') : null,
    };
  };
  return [
    { key: RAIL_TODAY, label: 'Today', icon: CalendarDays, accent: '#7c3aed' },
    ...sweepModes.map(game),
    { key: RAIL_VS, label: 'VS', icon: Swords, accent: '#ec4899', dot: vsDailyWon === null ? null : vsDailyWon ? 'won' : 'lost' },
    ...moreModes.map(game),
    { key: RAIL_ALL, label: 'All-time', icon: Trophy, accent: '#d97706' },
  ];
}

interface Props {
  items: RailItem[];
  selected: string;
  onSelect: (key: string) => void;
}

const HOLD_MS = 450;

export function GameRail({ items, selected, onSelect }: Props) {
  const [gridOpen, setGridOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  // Keep the selected chip in view as the page changes (swipe, grid pick).
  useEffect(() => {
    const el = scrollerRef.current?.querySelector<HTMLElement>(`[data-rail-key="${selected}"]`);
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selected]);

  const startHold = () => {
    held.current = false;
    holdTimer.current = setTimeout(() => { held.current = true; setGridOpen(true); }, HOLD_MS);
  };
  const endHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };

  const chip = (it: RailItem, inGrid = false) => {
    const active = it.key === selected;
    const Icon = it.icon;
    const isToday = it.key === RAIL_TODAY;
    return (
      <button
        key={it.key}
        data-rail-key={it.key}
        type="button"
        className={`${inGrid ? 'w-full' : 'flex-shrink-0 min-w-[62px]'} relative flex flex-col items-center gap-1 transition-all duration-200`}
        style={{
          background: active ? `${it.accent}15` : 'var(--color-surface)',
          border: active ? `1.5px solid ${it.accent}` : '1.5px solid var(--color-border)',
          borderRadius: '12px',
          padding: '8px 10px',
        }}
        onClick={() => {
          if (held.current) { held.current = false; return; }
          setGridOpen(false);
          onSelect(it.key);
        }}
        onPointerDown={isToday && !inGrid ? startHold : undefined}
        onPointerUp={isToday && !inGrid ? endHold : undefined}
        onPointerLeave={isToday && !inGrid ? endHold : undefined}
        onContextMenu={isToday && !inGrid ? (e) => { e.preventDefault(); setGridOpen(true); } : undefined}
        aria-current={active ? 'page' : undefined}
        aria-label={isToday && !inGrid ? 'Today — hold for every game' : it.label}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${it.accent}15` }}>
          {it.romanNumeral ? (
            <span className="text-[10px] font-black leading-none" style={{ color: it.accent }}>{it.romanNumeral}</span>
          ) : Icon ? (
            <Icon className="w-3.5 h-3.5" style={{ color: it.accent }} />
          ) : null}
        </div>
        <span className="text-[10px] font-extrabold leading-tight whitespace-nowrap" style={{ color: active ? it.accent : 'var(--color-text-muted)' }}>
          {it.label}
        </span>
        {it.dot && (
          <span
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: it.dot === 'won' ? WIN_FG : '#dc2626' }}
            aria-label={it.dot === 'won' ? 'Won today' : 'Lost today'}
          />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-stretch gap-2">
        <div
          ref={scrollerRef}
          className="flex-1 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          role="tablist"
          aria-label="Stats pages"
        >
          {items.map((it) => chip(it))}
        </div>
        <button
          type="button"
          onClick={() => setGridOpen((o) => !o)}
          className="flex-shrink-0 self-center w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{
            background: gridOpen ? '#7c3aed15' : 'var(--color-surface)',
            border: gridOpen ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
            color: gridOpen ? '#7c3aed' : 'var(--color-text-muted)',
          }}
          aria-expanded={gridOpen}
          aria-label="Every game"
        >
          {gridOpen ? <X className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>
      {gridOpen && (
        <div
          className="p-3 animate-fade-in-up"
          style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}
          role="group"
          aria-label="Every game"
        >
          <div className="grid grid-cols-5 gap-2">
            {items.map((it) => chip(it, true))}
          </div>
        </div>
      )}
    </div>
  );
}
