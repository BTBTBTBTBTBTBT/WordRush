import { ArtTitle } from '@/components/ui/art-title';
import type { ArtName } from '@/lib/art';

// The Home section header (docs/ART_SPEC.md §2, §12): a whole-cast title art
// (WORDOCIOUS DAILIES, PUZZLES, WORD OF THE DAY) at ~70% of the content width,
// capped at 300 px, left aligned, with an optional trailing link at the right
// of the row (Word of the Day's "Past words"). One component so all three
// headers match exactly. No hooks, so it renders anywhere.

export const HOME_SECTION_TITLE = { widthPct: 70, maxWidth: 300 } as const;

interface HomeSectionTitleProps {
  name: ArtName;
  /** The words the art says (its accessible name). */
  label: string;
  /** Scroll anchor (`/?more=1` lands on #puzzles). */
  id?: string;
  /** Right-aligned content on the header row, e.g. a link. */
  trailing?: React.ReactNode;
}

export function HomeSectionTitle({ name, label, id, trailing }: HomeSectionTitleProps) {
  return (
    <div id={id} className="mt-1 mb-0.5 flex items-end gap-2" style={{ scrollMarginTop: 12 }}>
      <div className="min-w-0" style={{ width: `${HOME_SECTION_TITLE.widthPct}%`, maxWidth: HOME_SECTION_TITLE.maxWidth }}>
        <ArtTitle name={name} label={label} as="h2" maxWidth={HOME_SECTION_TITLE.maxWidth} align="left" priority={false} />
      </div>
      {trailing && <div className="ml-auto shrink-0 pb-1">{trailing}</div>}
    </div>
  );
}
