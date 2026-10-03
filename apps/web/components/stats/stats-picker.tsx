'use client';

import { GamePicker, type GamePickerBadge } from '@/components/ui/game-picker';
import { ArtTitle } from '@/components/ui/art-title';
import { LiveHeadline } from '@/components/ui/live-headline';
import { gameTitleArtForDbKey, gameTitleArtLabel } from '@/lib/art';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { pickerKeyForView, viewForPickerKey, type StatsState } from '@/lib/stats-view';

// The Stats tab's game picker (docs/FINISH_SPEC.md C3, founder): the SAME
// picker window as the Leaderboard (components/ui/game-picker.tsx) in the
// Stats blue — every game visible at once, the Sweep broom 9th in the
// WORDOCIOUS row, the PUZZLES row under it, today's W / L on each tile.
// FINISH_SPEC BJ1 (founder 10-03): no Today | All-time toggle any more — the page
// below always shows the picked game's TODAY section, then its ALL-TIME section.

export const STATS_ACCENT = '#2563eb';
const INK = '#1d4ed8';

interface Props {
  /** FINISH_SPEC BJ1: the picked game (lib/stats-view.ts). */
  state: StatsState;
  /** A tile tap (a view key: game db key or 'sweep'); re-tapping the picked game returns to Overview. */
  onPick: (view: string) => void;
  badges?: Record<string, GamePickerBadge | undefined>;
  /** Right side of the WORDOCIOUS label line (today's n / N). */
  wordociousExtra?: React.ReactNode;
}

/**
 * BB1: the header says exactly what's shown — the picked game's title art (~48 px;
 * live lettering in its accent without art), or OVERVIEW lettering. Pops when the
 * game changes.
 */
function SelectedTitle({ pickerKey }: { pickerKey: string | null }) {
  const art = pickerKey ? gameTitleArtForDbKey(pickerKey) : null;
  const meta = pickerKey ? MODE_BY_DBKEY[pickerKey] : undefined;
  return (
    <div key={pickerKey ?? 'overview'} className="intro-pop w-full flex justify-center" style={{ minHeight: 48 }}>
      {art ? (
        <ArtTitle name={art} label={gameTitleArtLabel(art)} maxHeight={48} maxWidth={320} as="div" level={2} priority={false} motion="none" />
      ) : pickerKey ? (
        <LiveHeadline text={meta?.title ?? 'Daily Sweep'} accent={meta?.accentHex ?? '#7c3aed'} size={26} level={2} />
      ) : (
        <LiveHeadline text="Overview" palette="stats" size={26} level={2} />
      )}
    </div>
  );
}

export function StatsPicker({ state, onPick, badges, wordociousExtra }: Props) {
  const pickerKey = state.game ? pickerKeyForView(state.game) : null;
  return (
    <GamePicker
      selected={pickerKey}
      onSelect={(key) => onPick(viewForPickerKey(key))}
      accent={STATS_ACCENT}
      ink={INK}
      bar
      badges={badges}
      wordociousExtra={wordociousExtra}
      label="Stats pages"
      title={<SelectedTitle pickerKey={pickerKey} />}
    />
  );
}
