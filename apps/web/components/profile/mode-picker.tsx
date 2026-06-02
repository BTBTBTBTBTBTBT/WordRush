'use client';

import { TrendingUp, Shield, Skull, Crown, BarChart3 } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';

export interface ModeConfig {
  id: string;
  dbKey: string;
  title: string;
  shortTitle: string;
  icon: React.ComponentType<any> | null;
  romanNumeral?: string;
  accentColor: string;
}

export const PROFILE_MODES: ModeConfig[] = [
  { id: 'practice', dbKey: 'DUEL', title: 'Classic', shortTitle: 'Classic', icon: WordleGridIcon, accentColor: '#7c3aed' },
  { id: 'quordle', dbKey: 'QUORDLE', title: 'QuadWord', shortTitle: 'Quad', icon: null, romanNumeral: 'IV', accentColor: '#ec4899' },
  { id: 'octordle', dbKey: 'OCTORDLE', title: 'OctoWord', shortTitle: 'Octo', icon: null, romanNumeral: 'VIII', accentColor: '#7e22ce' },
  { id: 'sequence', dbKey: 'SEQUENCE', title: 'Succession', shortTitle: 'Succ.', icon: TrendingUp, accentColor: '#2563eb' },
  { id: 'rescue', dbKey: 'RESCUE', title: 'Deliverance', shortTitle: 'Deliv.', icon: Shield, accentColor: '#059669' },
  { id: 'six', dbKey: 'DUEL_6', title: 'Six', shortTitle: 'Six', icon: SixIcon, accentColor: '#06b6d4' },
  { id: 'seven', dbKey: 'DUEL_7', title: 'Seven', shortTitle: 'Seven', icon: SevenIcon, accentColor: '#84cc16' },
  { id: 'gauntlet', dbKey: 'GAUNTLET', title: 'Gauntlet', shortTitle: 'Gauntlet', icon: Skull, accentColor: '#d97706' },
  { id: 'propernoundle', dbKey: 'PROPERNOUNDLE', title: 'ProperNoundle', shortTitle: 'Proper', icon: Crown, accentColor: '#dc2626' },
];

interface ModePickerProps {
  selectedMode: string | null;
  onSelectMode: (dbKey: string | null) => void;
  gamesPerMode?: Record<string, number>;
  showAll?: boolean;
  /** When true, lay the 9 modes out 5-on-top-of-4 on one screen (no horizontal
   *  scroll) instead of a scrolling row. Used on /daily and /records. */
  grid?: boolean;
}

export function ModePicker({ selectedMode, onSelectMode, gamesPerMode, showAll = true, grid = false }: ModePickerProps) {
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
          {PROFILE_MODES.slice(0, 5).map((m) => (
            <div key={m.id} style={{ width: cellWidth }}>{modeButton(m, true)}</div>
          ))}
        </div>
        <div className="flex justify-center gap-2">
          {PROFILE_MODES.slice(5).map((m) => (
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

      {PROFILE_MODES.map((mode) => modeButton(mode))}
    </div>
  );
}
