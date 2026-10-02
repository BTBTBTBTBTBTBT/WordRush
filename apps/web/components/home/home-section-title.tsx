import { ArtTitle } from '@/components/ui/art-title';
import type { ArtName } from '@/lib/art';

// The Home section header (docs/ART_SPEC.md §2, §12, §19.2): a whole-cast title
// art (DAILIES, PUZZLES, WORD OF THE DAY) centered above its section at ~78% of
// the content width, capped at 340 px, with optional small content centered
// under it (Word of the Day's "Past words"). One component so all three
// headers match exactly. No hooks, so it renders anywhere.

export const HOME_SECTION_TITLE = { widthPct: 78, maxWidth: 340 } as const;

interface HomeSectionTitleProps {
  name: ArtName;
  /** The words the art says (its accessible name). */
  label: string;
  /** Scroll anchor (`/?more=1` lands on #puzzles). */
  id?: string;
  /** Small content centered under the title, e.g. a link. */
  below?: React.ReactNode;
}

export function HomeSectionTitle({ name, label, id, below }: HomeSectionTitleProps) {
  return (
    <div id={id} className="mt-1 mb-0.5 flex flex-col items-center" style={{ scrollMarginTop: 12 }}>
      <div className="min-w-0" style={{ width: `${HOME_SECTION_TITLE.widthPct}%`, maxWidth: HOME_SECTION_TITLE.maxWidth }}>
        <ArtTitle name={name} label={label} as="h2" maxWidth={HOME_SECTION_TITLE.maxWidth} align="center" priority={false} />
      </div>
      {below && <div className="mt-0.5 mb-1 text-center">{below}</div>}
    </div>
  );
}
