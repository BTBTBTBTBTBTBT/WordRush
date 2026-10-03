import { ArtTitle } from '@/components/ui/art-title';
import { ART_SIZE, type ArtName } from '@/lib/art';
import { HEADLINE, headlineMaxWidth, type HeadlineRule } from '@/lib/headline';

// The Home section header (docs/ART_SPEC.md §2, §12, §19.2; FINISH_SPEC N1): a
// lettering-only title art (DAILIES, PUZZLES, WORD OF THE DAY) centered above
// its section by the page-title rule — ≈62% of the content width, ≤ 300 px
// wide, ≤ 64 px tall (lib/headline.ts) — with optional small content centered
// under it (Word of the Day's "Past words"). One component so all three
// headers match exactly. No hooks, so it renders anywhere.

export const HOME_SECTION_TITLE = HEADLINE;
/** FINISH_SPEC BH2: DAILIES / PUZZLES sit over the compact cards ~25% smaller, with less air. */
export const HOME_SECTION_TITLE_COMPACT: HeadlineRule = {
  widthPct: Math.round(HEADLINE.widthPct * 0.75), maxWidth: Math.round(HEADLINE.maxWidth * 0.75), maxHeight: Math.round(HEADLINE.maxHeight * 0.75),
};

interface HomeSectionTitleProps {
  name: ArtName;
  /** The words the art says (its accessible name). */
  label: string;
  /** Scroll anchor (`/?more=1` lands on #puzzles). */
  id?: string;
  /** Small content centered under the title, e.g. a link. */
  below?: React.ReactNode;
  /** The compact game-section size (BH2). */
  compact?: boolean;
}

export function HomeSectionTitle({ name, label, id, below, compact = false }: HomeSectionTitleProps) {
  const rule = compact ? HOME_SECTION_TITLE_COMPACT : HOME_SECTION_TITLE;
  return (
    <div id={id} className={`${compact ? 'mt-0 -mb-0.5' : 'mt-1 mb-0.5'} flex flex-col items-center`} style={{ scrollMarginTop: 12 }}>
      <div className="min-w-0" style={{ width: `${rule.widthPct}%`, maxWidth: headlineMaxWidth(ART_SIZE[name][0], ART_SIZE[name][1], rule) }}>
        <ArtTitle name={name} label={label} as="h2" maxWidth={rule.maxWidth} maxHeight={rule.maxHeight} align="center" priority={name === 'art-title-dailies'} />
      </div>
      {below && <div className="mt-0.5 mb-1 text-center">{below}</div>}
    </div>
  );
}
