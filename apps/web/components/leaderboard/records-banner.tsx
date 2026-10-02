'use client';

import { PICKER_HEADER_CLASS, PICKER_HEADER_STYLE, ResetLine, dayTitle } from './leaderboard-banner';
import { LB_GOLD, SegmentedPill } from './board-rows';
import { PageHeadline } from '@/components/ui/page-headline';
import { GamePicker } from '@/components/ui/game-picker';

// The Records top, in the Leaderboard's finished look (docs/FINISH_SPEC.md
// A6, C2, C2b): the whole-cast ALL-TIME RECORDS title art as a full-width
// headline on the wallpaper, then the same ONE game picker card in gold —
// its header row carries the sub line (Daily: the day's title · reset clock;
// All-Time: THE BEST EVER · N RECORDS) and the DAILY | ALL-TIME switch; the
// WORDOCIOUS row ends with the Sweep broom tile.

export type RecordsTab = 'daily' | 'alltime';

interface Props {
  tab: RecordsTab;
  onTab: (tab: RecordsTab) => void;
  /** The player's local YYYY-MM-DD; null until hydrated. */
  today: string | null;
  /** The all-time records count, once loaded. */
  recordsCount: number | null;
  selectedMode: string;
  onSelect: (dbKey: string) => void;
}

export function RecordsBanner({ tab, onTab, today, recordsCount, selectedMode, onSelect }: Props) {
  return (
    <>
      <PageHeadline name="art-title-records" label="All-Time Records" className="mb-3" />
      <GamePicker
        selected={selectedMode}
        onSelect={onSelect}
        accent={LB_GOLD}
        label="Pick a game"
        header={
          <div className={PICKER_HEADER_CLASS} style={PICKER_HEADER_STYLE}>
            <span className="flex-1 min-w-0 truncate">
              {tab === 'daily'
                ? <ResetLine lead={today ? dayTitle(today) : null} />
                : `THE BEST EVER${recordsCount != null ? ` · ${recordsCount} RECORD${recordsCount === 1 ? '' : 'S'}` : ''}`}
            </span>
            <SegmentedPill
              label="Daily or All-Time"
              accent={LB_GOLD}
              value={tab}
              onChange={onTab}
              options={[['daily', 'DAILY'], ['alltime', 'ALL-TIME']] as const}
            />
          </div>
        }
      />
    </>
  );
}
