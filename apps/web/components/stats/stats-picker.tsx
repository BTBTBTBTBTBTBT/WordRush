'use client';

import { GamePicker, type GamePickerBadge } from '@/components/ui/game-picker';
import { CandySegment } from '@/components/ui/candy-segment';
import { ArtTitle } from '@/components/ui/art-title';
import { LiveHeadline } from '@/components/ui/live-headline';
import { gameTitleArtForDbKey, gameTitleArtLabel } from '@/lib/art';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
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

/** BB1: the selected game's lettering title (~48 px) or, without title art, its name in live lettering in its accent. */
function SelectedTitle({ pickerKey }: { pickerKey: string | null }) {
  if (!pickerKey) return null;
  const art = gameTitleArtForDbKey(pickerKey);
  const meta = MODE_BY_DBKEY[pickerKey];
  return (
    // Keyed by the game: a quick pop each time another game is picked.
    <div key={pickerKey} className="intro-pop w-full flex justify-center" style={{ minHeight: 48 }}>
      {art ? (
        <ArtTitle name={art} label={gameTitleArtLabel(art)} maxHeight={48} maxWidth={320} as="div" level={2} priority={false} motion="none" />
      ) : (
        <LiveHeadline text={meta?.title ?? 'Daily Sweep'} accent={meta?.accentHex ?? '#7c3aed'} size={26} level={2} />
      )}
    </div>
  );
}

export function StatsPicker({ view, onSelect, badges, wordociousExtra }: Props) {
  const seg: 'today' | 'all' | '' = view === VIEW_TODAY ? 'today' : view === VIEW_ALL ? 'all' : '';
  const pickerKey = pickerKeyForView(view);
  const accent = (pickerKey && MODE_BY_DBKEY[pickerKey]?.accentHex) || STATS_ACCENT;
  return (
    <GamePicker
      selected={pickerKey}
      onSelect={(key) => onSelect(viewForPickerKey(key))}
      accent={STATS_ACCENT}
      ink={INK}
      bar
      badges={badges}
      wordociousExtra={wordociousExtra}
      label="Stats pages"
      title={<SelectedTitle pickerKey={pickerKey} />}
      header={
        // BB2: a candy segmented control with a sliding thumb (in the game's
        // accent when a game is picked; then neither half is chosen).
        <CandySegment<'today' | 'all'>
          options={[{ key: 'today', label: 'Today' }, { key: 'all', label: 'All-time' }]}
          value={seg}
          onChange={(k) => onSelect(k === 'all' ? VIEW_ALL : VIEW_TODAY)}
          accent={seg ? STATS_ACCENT : accent}
          label="Today or all-time"
          className="w-full"
        />
      }
    />
  );
}
