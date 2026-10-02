import { ArtTitle } from '@/components/ui/art-title';
import { ART_SIZE, type ArtName } from '@/lib/art';
import { HEADLINE, headlineMaxWidth } from '@/lib/headline';

// The Home section header (docs/ART_SPEC.md §2, §12, §19.2; FINISH_SPEC N1): a
// lettering-only title art (DAILIES, PUZZLES, WORD OF THE DAY) centered above
// its section by the page-title rule — ≈62% of the content width, ≤ 300 px
// wide, ≤ 64 px tall (lib/headline.ts) — with optional small content centered
// under it (Word of the Day's "Past words"). One component so all three
// headers match exactly. No hooks, so it renders anywhere.

export const HOME_SECTION_TITLE = HEADLINE;

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
      <div className="min-w-0" style={{ width: `${HOME_SECTION_TITLE.widthPct}%`, maxWidth: headlineMaxWidth(ART_SIZE[name][0], ART_SIZE[name][1]) }}>
        <ArtTitle name={name} label={label} as="h2" maxWidth={HOME_SECTION_TITLE.maxWidth} maxHeight={HOME_SECTION_TITLE.maxHeight} align="center" priority={name === 'art-title-dailies'} />
      </div>
      {below && <div className="mt-0.5 mb-1 text-center">{below}</div>}
    </div>
  );
}
