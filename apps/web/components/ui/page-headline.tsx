import Image from 'next/image';
import { ART_SIZE, artLabel, artSrc, type ArtName } from '@/lib/art';
import { PAGE_HEADLINE, headlineMaxWidth, type HeadlineRule } from '@/lib/headline';

// Page titles are headlines (docs/FINISH_SPEC.md A6, N1): the page / day
// title art right on the wallpaper — no box, stage or border, no float — and,
// since the calmer top (N1), a smaller centered headline: ≈62% of the content
// width, at most 300 px wide and 64 px tall (lib/headline.ts HEADLINE); the
// Leaderboard day title passes DAY_HEADLINE (≈58%, ≤ 150 tall). The cast row
// above is the only whole-cast art on the screen. The image carries the title
// text as its accessible name inside the heading element. No hooks: server-safe.

/** The shared footer-page title height cap (C6: all seven the same height; BJ7: ≤ 52). */
export const FOOTER_TITLE_HEIGHT = PAGE_HEADLINE.maxHeight;

// BJ7: page top titles take PAGE_HEADLINE (≤ 52 tall) unless a rule is passed.
export function PageHeadline({ name, label, as: Tag = 'h1', level, rule = PAGE_HEADLINE, maxHeight, className = '', style }: {
  name: ArtName;
  /** The title text (accessible name); empty or omitted falls back to the art's words (lib/art.ts artLabel). */
  label?: string;
  as?: 'h1' | 'h2' | 'div';
  /**
   * FINISH_SPEC AB: with `as="div"`, the heading level the wrapper announces.
   * Leave unset when it already sits inside a heading element.
   */
  level?: 1 | 2 | 3 | 4;
  /** The size rule (HEADLINE for page titles, DAY_HEADLINE for the Leaderboard day title). */
  rule?: HeadlineRule;
  /** Override the rule's height cap (px). */
  maxHeight?: number;
  /** Kept for old call sites; the headline no longer bleeds past the gutter (N1). */
  bleed?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [w, h] = ART_SIZE[name];
  const r = maxHeight != null ? { ...rule, maxHeight: Math.min(rule.maxHeight, maxHeight) } : rule;
  const capW = headlineMaxWidth(w, h, r);
  return (
    <Tag {...(Tag === 'div' && level != null ? { role: 'heading', 'aria-level': level } : null)} className={`page-headline m-0 flex justify-center select-none ${className}`} style={{ lineHeight: 0, ...style }}>
      <Image
        src={artSrc(name)}
        alt={label || artLabel(name)}
        width={w}
        height={h}
        priority
        draggable={false}
        sizes={`${capW}px`}
        className="block pointer-events-none"
        style={{ width: `${r.widthPct}%`, maxWidth: capW, height: 'auto', aspectRatio: `${w} / ${h}`, filter: 'drop-shadow(0 4px 8px rgba(40, 20, 90, 0.16))' }}
      />
    </Tag>
  );
}
