import Image from 'next/image';
import { medalSrc, type Medal } from '@/lib/art';

// The glossy 3D medals (lib/art.ts medalSrc: public/art/art-medal-<gold |
// silver | bronze | trophy>.webp, 256 px square) for the Stats page's daily
// podium finishes and medal counts, in place of the emoji / flat medal glyphs.
// Decorative: the count or row beside it carries the meaning. No hooks.

export function MedalArt({ medal, size = 20, inline = false, className = '', style }: {
  medal: Medal;
  size?: number;
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Image
      src={medalSrc(medal)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={`${inline ? 'inline-block' : 'block'} shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', ...(inline ? { verticalAlign: '-0.18em' } : null), ...style }}
    />
  );
}

/** A lucide-compatible medal icon for icon tables (size from the w-* class, color ignored). */
export function medalIcon(medal: Medal, fallbackSize = 16) {
  function MedalIcon({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
    const m = className.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?=\s|$)/);
    const size = m ? Number(m[1]) * 4 : typeof style?.width === 'number' ? style.width : fallbackSize;
    const rest = className.split(/\s+/).filter((c) => c && !/^(w|h)-/.test(c)).join(' ');
    return <MedalArt medal={medal} size={size} className={rest} />;
  }
  MedalIcon.displayName = `MedalArt(${medal})`;
  return MedalIcon;
}

export const GoldMedal = medalIcon('gold');
export const SilverMedal = medalIcon('silver');
export const BronzeMedal = medalIcon('bronze');
export const TrophyMedal = medalIcon('trophy');
