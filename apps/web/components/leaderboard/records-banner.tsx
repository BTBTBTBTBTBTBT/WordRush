'use client';

import { Trophy } from 'lucide-react';
import { BannerGameRows, ResetLine, dayTitle } from './leaderboard-banner';

// The Records banner (founder, 2026-10-01; docs/RECORDS_REDESIGN_SPEC.md §1): the
// Leaderboard banner's one window in lilac-to-gold. A frosted strip with the trophy
// + ALL-TIME RECORDS, the sub line (Daily: the day's title · reset clock; All-Time:
// THE BEST EVER · N RECORDS) and the DAILY | ALL-TIME pill switch, then the same two
// game rows as the Leaderboard banner.

const HEAD = '#4c1d95';
const SUB = '#6d28d9';

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
  const segment = (key: RecordsTab, label: string) => {
    const on = tab === key;
    return (
      <button
        type="button"
        onClick={() => onTab(key)}
        aria-pressed={on}
        className="font-black transition-colors"
        style={{
          height: 26, padding: '0 10px', borderRadius: 999, fontSize: 10.5, letterSpacing: 0.6,
          background: on ? '#ffffff' : 'transparent',
          color: on ? HEAD : '#7c3aed',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #ede9fe, #fef3c7)',
        boxShadow: '0 4px 14px rgba(76,29,149,0.10)',
      }}
    >
      <div className="relative flex items-center gap-2" style={{ padding: '12px 10px 10px 12px', background: 'rgba(255,255,255,0.5)' }}>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-5 h-5 shrink-0" style={{ color: '#b45309' }} />
            <h1 className="font-black truncate" style={{ fontSize: 22, letterSpacing: 0.4, lineHeight: 1.15, color: HEAD, textShadow: '0 0 8px rgba(245,158,11,0.55)' }}>
              ALL-TIME RECORDS
            </h1>
          </div>
          <div className="font-extrabold truncate" style={{ fontSize: 10.5, letterSpacing: 0.4, color: SUB }}>
            {tab === 'daily'
              ? <ResetLine lead={today ? dayTitle(today) : null} />
              : `THE BEST EVER${recordsCount != null ? ` · ${recordsCount} RECORD${recordsCount === 1 ? '' : 'S'}` : ''}`}
          </div>
        </div>
        <div role="group" aria-label="Daily or All-Time" className="flex shrink-0" style={{ padding: 2, borderRadius: 999, background: 'rgba(124,58,237,0.12)' }}>
          {segment('daily', 'DAILY')}
          {segment('alltime', 'ALL-TIME')}
        </div>
      </div>

      <BannerGameRows selectedMode={selectedMode} onSelect={onSelect} ink={SUB} />
    </div>
  );
}
