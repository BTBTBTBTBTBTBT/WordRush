'use client';

import { GamePicker, type GamePickerBadge } from '@/components/ui/game-picker';
import { TintSegment } from '@/components/stats/tint-segment';
import { VIEW_ALL, VIEW_TODAY, pickerKeyForView, viewForPickerKey } from '@/lib/stats-view';

// The Stats tab's game picker (docs/FINISH_SPEC.md C3, founder): the SAME
// picker window as the Leaderboard (components/ui/game-picker.tsx) in the
// Stats blue — every game visible at once, the Sweep broom 9th in the
// WORDOCIOUS row, the PUZZLES row under it, today's W / L on each tile. Today
// and All-time stay the first two options as a two-segment toggle in the
// window's header row; picking either deselects the tiles. Replaces the old
// horizontally scrolling rail and its hold-for-grid.

export const STATS_ACCENT = '#2563eb';
const INK = '#1d4ed8';

interface Props {
  /** The current view (lib/stats-view.ts): 'today' | 'all' | 'sweep' | a game db key. */
  view: string;
  onSelect: (view: string) => void;
  badges?: Record<string, GamePickerBadge | undefined>;
  /** Right side of the WORDOCIOUS label line (today's n / N). */
  wordociousExtra?: React.ReactNode;
}

export function StatsPicker({ view, onSelect, badges, wordociousExtra }: Props) {
  const seg: 'today' | 'all' | '' = view === VIEW_TODAY ? 'today' : view === VIEW_ALL ? 'all' : '';
  return (
    <GamePicker
      selected={pickerKeyForView(view)}
      onSelect={(key) => onSelect(viewForPickerKey(key))}
      accent={STATS_ACCENT}
      ink={INK}
      bar
      badges={badges}
      wordociousExtra={wordociousExtra}
      label="Stats pages"
      header={
        <TintSegment<'today' | 'all' | ''>
          options={[{ key: 'today', label: 'Today' }, { key: 'all', label: 'All-time' }]}
          value={seg}
          onChange={(k) => onSelect(k === 'all' ? VIEW_ALL : VIEW_TODAY)}
          accent={STATS_ACCENT}
          ink={INK}
          label="Today or all-time"
          className="w-full"
        />
      }
    />
  );
}
