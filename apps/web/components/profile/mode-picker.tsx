'use client';

import { TrendingUp, Shield, Skull, Crown, BarChart3 } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { BroomIcon } from '@/components/ui/broom-icon';
import { DAILY_MODES } from '@/lib/modes.generated';

export interface ModeConfig {
  id: string;
  dbKey: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<any> | null;
  romanNumeral?: string;
  accentColor: string;
}

// Icons stay web-native (keyed by id); everything else from the single-source catalog.
const MODE_ICONS: Record<string, React.ComponentType<any> | null> = {
  practice: WordleGridIcon, sequence: TrendingUp, rescue: Shield,
  six: SixIcon, seven: SevenIcon, gauntlet: Skull, propernoundle: Crown,
};

export const PROFILE_MODES: ModeConfig[] = DAILY_MODES.map((m) => ({
  id: m.id,
  dbKey: m.dbKey as string,
  title: m.title,
  shortTitle: m.shortTitle,
  icon: MODE_ICONS[m.id] ?? null,
  romanNumeral: m.romanNumeral ?? undefined,
  accentColor: m.accentHex,
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
};

interface ModePickerProps {
  selectedMode: string | null;
  onSelectMode: (dbKey: string | null) => void;
  gamesPerMode?: Record<string, number>;
  showAll?: boolean;
  /** When true, lay the 9 modes out 5-on-top-of-4 on one screen (no horizontal
   *  scroll) instead of a scrolling row. Used on /daily and /records. */
  grid?: boolean;
  /** When true, append the synthetic Sweep tile (10th) — the daily sweep
   *  leaderboard selector. Only /daily and /records opt in. */
  includeSweep?: boolean;
}

export function ModePicker({ selectedMode, onSelectMode, gamesPerMode, showAll = true, grid = false, includeSweep = false }: ModePickerProps) {
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
        onClick={() => onSelectMode(isActive ? null : mode.dbKey)}
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

  // 5-on-top-of-4 grid (all 9 modes visible, no scroll) — matches the native
  // app + Profile dailies. Each cell is exactly 1/5 of the row width so the
  // bottom 4 sit centered under the top 5.
  if (grid) {
    const cellWidth = 'calc((100% - 32px) / 5)'; // 5 cells, 4 × 8px gaps
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-center gap-2">
          {modes.slice(0, 5).map((m) => (
            <div key={m.id} style={{ width: cellWidth }}>{modeButton(m, true)}</div>
          ))}
        </div>
        <div className="flex justify-center gap-2">
          {modes.slice(5).map((m) => (
            <div key={m.id} style={{ width: cellWidth }}>{modeButton(m, true)}</div>
          ))}
        </div>
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
