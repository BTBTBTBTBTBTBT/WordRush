'use client';

import { useState } from 'react';
import { BarChart3, LayoutGrid } from 'lucide-react';
import { BroomIcon } from '@/components/ui/broom-icon';
import { DAILY_MODES, MORE_CATEGORIES } from '@/lib/modes.generated';
import { MODE_CHROME } from '@/components/home/mode-chrome';
import { useFlags } from '@/hooks/use-flags';

export interface ModeConfig {
  id: string;
  dbKey: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<any> | null;
  romanNumeral?: string;
  accentColor: string;
  /** Member of the current Daily Sweep set — a cell in the 5-over-N grid. */
  sweep: boolean;
  /** More Games sheet section (null for the sweep modes). */
  category: string | null;
  /** Remote gate (app_flags key); null = never gated. */
  flagKey: string | null;
}

// Icons come from the home chrome table (one icon map for the whole app);
// everything else from the single-source catalog.
export const PROFILE_MODES: ModeConfig[] = DAILY_MODES.map((m) => ({
  id: m.id,
  dbKey: m.dbKey as string,
  title: m.title,
  shortTitle: m.shortTitle,
  icon: MODE_CHROME[m.id]?.icon ?? null,
  romanNumeral: m.romanNumeral ?? undefined,
  accentColor: m.accentHex,
  sweep: m.sweep,
  category: m.category,
  flagKey: m.flagKey,
}));

// Synthetic 10th tile — the Daily Sweep leaderboard. Deliberately NOT in
// modes.json (it has no puzzle/seed) and NOT in PROFILE_MODES (which many
// surfaces map over: the profile mode pickers, the favorite-mode chooser).
// It's opt-in via <ModePicker includeSweep> so it only ever shows on /daily
// and /records; appending it there makes the grid's slice(0,5)/slice(5) fall
// out to a clean 5-over-5.
export const SWEEP_MODE: ModeConfig = {
  id: 'SWEEP',
  dbKey: 'SWEEP',
  title: 'Sweep',
  shortTitle: 'Sweep',
  icon: BroomIcon,
  romanNumeral: undefined,
  accentColor: '#4f46e5',
  sweep: false,
  category: null,
  flagKey: null,
};

// Tolerance (More Games Stage 1): a mode key this bundle does not know — a
// row written by a newer client for a mode this deploy has not shipped yet.
// The old `find(...)!` threw and blanked /daily and /records for everyone;
// now it renders a neutral tile instead. Never shown in pickers.
export const UNKNOWN_MODE: ModeConfig = {
  id: 'UNKNOWN',
  dbKey: 'UNKNOWN',
  title: 'Game',
  shortTitle: 'Game',
  icon: BarChart3,
  romanNumeral: undefined,
  accentColor: '#9ca3af',
  sweep: false,
  category: null,
  flagKey: null,
};

/** Look a mode up by dbKey, falling back to UNKNOWN_MODE instead of throwing. */
export function modeByKey(dbKey: string): ModeConfig {
  if (dbKey === 'SWEEP') return SWEEP_MODE;
  return PROFILE_MODES.find((m) => m.dbKey === dbKey) ?? UNKNOWN_MODE;
}

// The grid picker cannot hold every daily mode in its 5-over-N layout (More
// Games §18): it shows the sweep modes (+ Sweep) and ONE "More" chip that
// opens the More Games list, sectioned like the sheet. Today every daily mode
// is in the sweep, so the chip is hidden and the grid is unchanged.
const MORE_ACCENT = '#4f46e5';
export const MORE_PICKER_MODES: ModeConfig[] = PROFILE_MODES.filter((m) => !m.sweep);
export function morePickerSections(modes: ModeConfig[] = MORE_PICKER_MODES): { key: string; title: string; modes: ModeConfig[] }[] {
  const sections = MORE_CATEGORIES.map((c) => ({ key: c.key, title: c.title, modes: modes.filter((m) => m.category === c.key) }));
  const other = modes.filter((m) => !m.category || !MORE_CATEGORIES.some((c) => c.key === m.category));
  if (other.length) sections.push({ key: 'other', title: 'Other', modes: other });
  return sections.filter((s) => s.modes.length > 0);
}

interface ModePickerProps {
  selectedMode: string | null;
  onSelectMode: (dbKey: string | null) => void;
  gamesPerMode?: Record<string, number>;
  showAll?: boolean;
  /** When true, lay the sweep modes out 5-on-top-of-4 on one screen (no horizontal
   *  scroll) instead of a scrolling row. Used on /daily and /records. */
  grid?: boolean;
  /** When true, append the synthetic Sweep tile (10th) — the daily sweep
   *  leaderboard selector. Only /daily and /records opt in. */
  includeSweep?: boolean;
}

export function ModePicker({ selectedMode, onSelectMode, gamesPerMode, showAll = true, grid = false, includeSweep = false }: ModePickerProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Remote flags (Stage 7): a More Games mode sits behind the chip only when
  // its app_flags row says so for this viewer.
  const { isOn: flagOn } = useFlags();
  const morePicker = MORE_PICKER_MODES.filter((m) => flagOn(m.flagKey));
  const modes = includeSweep ? [...PROFILE_MODES, SWEEP_MODE] : PROFILE_MODES;
  const modeButton = (mode: ModeConfig, fullWidth = false) => {
    const isActive = selectedMode === mode.dbKey;
    const games = gamesPerMode?.[mode.dbKey] || 0;
    const Icon = mode.icon;
    return (
      <button
        key={mode.id}
        className={`${fullWidth ? 'w-full' : 'flex-shrink-0'} flex flex-col items-center gap-1 transition-all duration-200`}
        style={{
          background: isActive ? `${mode.accentColor}15` : 'var(--color-surface)',
          border: isActive ? `1.5px solid ${mode.accentColor}` : '1.5px solid var(--color-border)',
          borderRadius: '12px',
          padding: '8px 12px',
          minWidth: fullWidth ? undefined : '62px',
        }}
        onClick={() => { setMoreOpen(false); onSelectMode(isActive ? null : mode.dbKey); }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${mode.accentColor}15` }}
        >
          {mode.romanNumeral ? (
            <span className="text-[10px] font-black leading-none" style={{ color: mode.accentColor }}>{mode.romanNumeral}</span>
          ) : Icon ? (
            <Icon className="w-3.5 h-3.5" style={{ color: mode.accentColor }} />
          ) : null}
        </div>
        <span
          className="text-[10px] font-extrabold leading-tight"
          style={{ color: isActive ? mode.accentColor : 'var(--color-text-muted)' }}
        >
          {mode.shortTitle}
        </span>
        {games > 0 && (
          <span className="text-[8px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{games}</span>
        )}
      </button>
    );
  };

  // The "More" chip: opens the More Games list. When one of those modes is
  // selected the chip wears that mode's icon, title and accent so the grid
  // still shows what the page is filtered to.
  const moreButton = () => {
    const selectedMore = morePicker.find((m) => m.dbKey === selectedMode) ?? null;
    const accent = selectedMore?.accentColor ?? MORE_ACCENT;
    const active = !!selectedMore || moreOpen;
    const Icon = selectedMore?.icon ?? LayoutGrid;
    return (
      <button
        key="MORE"
        className="w-full flex flex-col items-center gap-1 transition-all duration-200"
        style={{
          background: active ? `${accent}15` : 'var(--color-surface)',
          border: active ? `1.5px solid ${accent}` : '1.5px solid var(--color-border)',
          borderRadius: '12px',
          padding: '8px 12px',
        }}
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
        aria-label="More Games"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
          {selectedMore?.romanNumeral ? (
            <span className="text-[10px] font-black leading-none" style={{ color: accent }}>{selectedMore.romanNumeral}</span>
          ) : (
            <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
          )}
        </div>
        <span className="text-[10px] font-extrabold leading-tight" style={{ color: active ? accent : 'var(--color-text-muted)' }}>
          {selectedMore?.shortTitle ?? 'More'}
        </span>
      </button>
    );
  };

  // 5-on-top-of-N grid (every sweep mode visible, no scroll) — matches the native
  // app + Profile dailies. Each cell is exactly 1/5 of the row width so the
  // bottom row sits centered under the top 5.
  if (grid) {
    const cellWidth = 'calc((100% - 32px) / 5)'; // 5 cells, 4 × 8px gaps
    const cells: React.ReactNode[] = modes.filter((m) => m.sweep || m.id === 'SWEEP').map((m) => (
      <div key={m.id} style={{ width: cellWidth }}>{modeButton(m, true)}</div>
    ));
    if (morePicker.length > 0) cells.push(<div key="MORE" style={{ width: cellWidth }}>{moreButton()}</div>);
    const rows: React.ReactNode[][] = [];
    for (let i = 0; i < cells.length; i += 5) rows.push(cells.slice(i, i + 5));
    return (
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-2">{row}</div>
        ))}
        {moreOpen && morePicker.length > 0 && (
          <div
            className="p-3 space-y-2 animate-fade-in-up"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '14px' }}
            role="group"
            aria-label="More Games"
          >
            {morePickerSections(morePicker).map((s) => (
              <div key={s.key}>
                <div className="section-header mb-1">{s.title.toUpperCase()}</div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                  {s.modes.map((m) => modeButton(m))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {/* All chip */}
      {showAll && (
        <button
          className="flex-shrink-0 flex flex-col items-center gap-1 transition-all duration-200"
          style={{
            background: selectedMode === null ? 'var(--color-surface-hover)' : 'var(--color-surface)',
            border: selectedMode === null ? '1.5px solid #7c3aed' : '1.5px solid var(--color-border)',
            borderRadius: '12px',
            padding: '8px 14px',
            minWidth: '62px',
          }}
          onClick={() => onSelectMode(null)}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: selectedMode === null ? '#7c3aed15' : 'var(--color-surface-alt)' }}
          >
            <BarChart3 className="w-3.5 h-3.5" style={{ color: selectedMode === null ? '#7c3aed' : 'var(--color-text-muted)' }} />
          </div>
          <span className="text-[10px] font-extrabold" style={{ color: selectedMode === null ? '#7c3aed' : 'var(--color-text-muted)' }}>All</span>
        </button>
      )}

      {modes.map((mode) => modeButton(mode))}
    </div>
  );
}
