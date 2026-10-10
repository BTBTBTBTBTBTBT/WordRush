import { BubbleOneLine } from '@/components/ui/bubble-text';

// FINISH_SPEC BJ1: the Stats page's two section headers — TODAY first, ALL-TIME beneath
// (no Today | All-time toggle any more). Brand gradient caps + a short gradient rule, a
// small bubble note on the right (the date, "since Mar 2025"). Appears whole: no pop, no box, no border. Twins: iOS StatsSectionBanner, Android
// StatsSectionBanner.

export const SECTION_GRADIENTS = {
  today: ['#2563eb', '#7c3aed'],
  all: ['#d97706', '#db2777'],
} as const;

/** Founder 10-09: the section title in the Wordocious bubble lettering (blue Today, amber All-time). */
const SECTION_TITLE_COLOR = { today: '#3B82F6', all: '#F59E0B' } as const;

export function StatsSectionBanner({ kind, note }: { kind: 'today' | 'all'; note?: string | null }) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2" data-stats-section={kind}>
      <h2 className="m-0" style={{ width: 190 }} aria-label={kind === 'today' ? 'Today' : 'All-time'}>
        <BubbleOneLine text={kind === 'today' ? 'TODAY' : 'ALL-TIME'} accent={SECTION_TITLE_COLOR[kind]} size={30} align="left" />
      </h2>
      {note && (
        <div className="pb-1" style={{ width: 130 }}>
          <BubbleOneLine text={note.toUpperCase()} accent="#A78BFA" size={14} align="right" />
        </div>
      )}
    </div>
  );
}
