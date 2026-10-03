'use client';

import { GamePicker, type GamePickerBadge } from '@/components/ui/game-picker';
import { CandySegment } from '@/components/ui/candy-segment';
import { ArtTitle } from '@/components/ui/art-title';
import { LiveHeadline } from '@/components/ui/live-headline';
import { gameTitleArtForDbKey, gameTitleArtLabel } from '@/lib/art';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { pickerKeyForView, viewForPickerKey, type StatsScope, type StatsState } from '@/lib/stats-view';

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
  /** FINISH_SPEC BG: SCOPE × GAME (lib/stats-view.ts). */
  state: StatsState;
  /** The Today | All-time toggle (keeps the game). */
  onScope: (scope: StatsScope) => void;
  /** A tile tap (a view key: game db key or 'sweep'); re-tapping the picked game returns to Overview. */
  onPick: (view: string) => void;
  badges?: Record<string, GamePickerBadge | undefined>;
  /** Right side of the WORDOCIOUS label line (today's n / N). */
  wordociousExtra?: React.ReactNode;
}

/**
 * BB1 + BG: the header says exactly what's shown — the picked game's title art
 * (~48 px; live lettering in its accent without art), or OVERVIEW lettering —
 * with a small TODAY / ALL-TIME chip under it. Pops when the game changes.
 */
function SelectedTitle({ pickerKey, scope }: { pickerKey: string | null; scope: StatsScope }) {
  const art = pickerKey ? gameTitleArtForDbKey(pickerKey) : null;
  const meta = pickerKey ? MODE_BY_DBKEY[pickerKey] : undefined;
  return (
    <div className="w-full flex flex-col items-center gap-1">
      <div key={pickerKey ?? 'overview'} className="intro-pop w-full flex justify-center" style={{ minHeight: 48 }}>
        {art ? (
          <ArtTitle name={art} label={gameTitleArtLabel(art)} maxHeight={48} maxWidth={320} as="div" level={2} priority={false} motion="none" />
        ) : pickerKey ? (
          <LiveHeadline text={meta?.title ?? 'Daily Sweep'} accent={meta?.accentHex ?? '#7c3aed'} size={26} level={2} />
        ) : (
          <LiveHeadline text="Overview" palette="stats" size={26} level={2} />
        )}
      </div>
      <span
        className="font-black uppercase rounded-full px-2.5 py-0.5"
        style={{ fontSize: 10.5, letterSpacing: '0.12em', color: '#ffffff', background: scope === 'all' ? 'linear-gradient(#a78bfa, #7c3aed)' : `linear-gradient(#60a5fa, ${STATS_ACCENT})`, boxShadow: '0 2px 0 rgba(30, 27, 75, 0.25)' }}
      >
        {scope === 'all' ? 'All-time' : 'Today'}
      </span>
    </div>
  );
}

export function StatsPicker({ state, onScope, onPick, badges, wordociousExtra }: Props) {
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
      title={<SelectedTitle pickerKey={pickerKey} scope={state.scope} />}
      header={
        // BB2 + BG: the scope toggle ALWAYS shows its half; switching keeps the picked game.
        <CandySegment<StatsScope>
          options={[{ key: 'today', label: 'Today' }, { key: 'all', label: 'All-time' }]}
          value={state.scope}
          onChange={onScope}
          accent={STATS_ACCENT}
          label="Today or all-time"
          className="w-full"
        />
      }
    />
  );
}
