import Image from 'next/image';
import { ART_SIZE, MOMENT_LABEL, artSrc, type ArtName, type MomentName } from '@/lib/art';

// Image titles (docs/ART_SPEC.md §1, §2, §6, §8): a page title drawn as art — the
// lettering with the whole cast on it (art-title-*) or a Leaderboard day title
// (art-day-*). The image carries the title text as its accessible name, inside
// the heading element the text title used. Sized by width up to `maxWidth`
// (height follows the file's real aspect ratio, never stretched), or by
// `height` for the day art. No hooks, so it renders in server components too.

interface ArtTitleProps {
  name: ArtName;
  /** The title text (the image's accessible name), e.g. "Friends", "Friday’s Finest". */
  label: string;
  /** Widest it draws, in CSS px (it fills the content width up to this). */
  maxWidth?: number;
  /** Fixed rendered height in CSS px instead (width follows the aspect ratio). */
  height?: number;
  /** Share of the content width to fill (the home PUZZLES header uses ~70%). */
  widthPct?: number;
  align?: 'center' | 'left';
  as?: 'h1' | 'h2' | 'div';
  /** Above-the-fold titles load eagerly. */
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function ArtTitle({
  name, label, maxWidth = 420, height, widthPct = 100, align = 'center', as = 'h1',
  priority = true, className = '', style,
}: ArtTitleProps) {
  const [w, h] = ART_SIZE[name];
  const Tag = as;
  const imgStyle: React.CSSProperties = height != null
    ? { height, width: 'auto', maxWidth: '100%', objectFit: 'contain' }
    : { width: `${widthPct}%`, maxWidth, height: 'auto' };
  return (
    <Tag
      className={`flex ${align === 'center' ? 'justify-center' : 'justify-start'} m-0 select-none ${className}`}
      style={{ lineHeight: 0, ...style }}
    >
      <Image
        src={artSrc(name)}
        alt={label}
        width={w}
        height={h}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        draggable={false}
        sizes={`${height != null ? Math.ceil((height * w) / h) : maxWidth}px`}
        className="block pointer-events-none"
        style={{ aspectRatio: `${w} / ${h}`, ...imgStyle }}
      />
    </Tag>
  );
}

interface MomentArtProps {
  moment: MomentName;
  /** Accessible name; defaults to the words drawn (MOMENT_LABEL). */
  label?: string;
  /** Tallest it draws, in CSS px (§6: ≈72). */
  maxHeight?: number;
  /** Share of the card width to fill (§6: ~70%). */
  widthPct?: number;
  as?: 'h1' | 'h2' | 'div';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Moment lettering (docs/ART_SPEC.md §6): a result / celebration headline
 * (VICTORY!, SO CLOSE!, YOU WIN!, SWEEP!, …) drawn as art in place of its
 * text, ~70% of the card width and never taller than `maxHeight` (the width
 * cap keeps the aspect ratio), inside the heading element the text used, with
 * the words as its accessible name. The game's host pop stays above it.
 */
export function MomentArt({ moment, label, maxHeight = 72, widthPct = 70, as = 'h2', className = '', style }: MomentArtProps) {
  const name = `art-moment-${moment}` as const;
  const [w, h] = ART_SIZE[name];
  return (
    <ArtTitle
      name={name}
      label={label ?? MOMENT_LABEL[moment]}
      maxWidth={Math.round((maxHeight * w) / h)}
      widthPct={widthPct}
      as={as}
      className={className}
      style={style}
    />
  );
}
