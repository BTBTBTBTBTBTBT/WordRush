import Image from 'next/image';

// The 3D icon set (docs/HEADER_SPEC.md §0): ChatGPT-designed in the same style
// as the cast, 256 px transparent PNGs in public/icons3d/ (plus the art pass's
// badge / lock / bell / add-friend / share / sound / back webps in public/art/,
// docs/ART_SPEC.md §0). ONE component,
// Icon3D(name, size), used for every streak flame, trophy, streak shield,
// crown, settings gear, help button and tab icon in the app (§2, §3).
// Decorative unless given a label. No hooks, so it renders in server
// components too. iOS keeps `icon3d-<name>` image sets and Android
// `drawable-nodpi/icon3d_<name>.png` in step with this list.

export type Icon3DName =
  | 'flame'
  | 'trophy'
  | 'shield'
  | 'gear'
  | 'help'
  | 'crown'
  | 'tab-home'
  | 'tab-leaderboard'
  | 'tab-stats'
  | 'tab-friends'
  // The art pass (docs/ART_SPEC.md §0, §4, §5): 256 px webp in public/art/.
  | 'badge-w'
  | 'badge-l'
  | 'badge-check'
  | 'lock'
  | 'bell'
  | 'add-friend'
  | 'share'
  | 'sound'
  | 'back';

export const ICON3D_NAMES: readonly Icon3DName[] = [
  'flame', 'trophy', 'shield', 'gear', 'help', 'crown',
  'tab-home', 'tab-leaderboard', 'tab-stats', 'tab-friends',
  'badge-w', 'badge-l', 'badge-check', 'lock', 'bell', 'add-friend', 'share', 'sound', 'back',
];

/** The names shipped with the art pass, served from public/art/icon3d-<name>.webp. */
const ART_PASS_NAMES: ReadonlySet<Icon3DName> = new Set([
  'badge-w', 'badge-l', 'badge-check', 'lock', 'bell', 'add-friend', 'share', 'sound', 'back',
]);

/** Public path of an icon's art. */
export function icon3dSrc(name: Icon3DName): string {
  return ART_PASS_NAMES.has(name) ? `/art/icon3d-${name}.webp` : `/icons3d/${name}.png`;
}

interface Icon3DProps {
  name: Icon3DName;
  /** Rendered box in CSS px (square). */
  size?: number;
  /** Accessible name. Without one the icon is decorative (hidden from screen readers). */
  label?: string;
  /** Sits on the text baseline inside a line of copy. */
  inline?: boolean;
  /** Above-the-fold icons (header, tab bar) load eagerly. */
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon3D({ name, size = 20, label, inline = false, priority = false, className = '', style }: Icon3DProps) {
  return (
    <Image
      src={icon3dSrc(name)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      className={`${inline ? 'inline-block' : 'block'} shrink-0 select-none pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        ...(inline ? { verticalAlign: '-0.18em' } : null),
        ...style,
      }}
    />
  );
}

/**
 * The 3D icon that replaces a UI-chrome emoji slot (a highlight or feed row
 * whose icon is 🔥 / 🏆 / 👑), or null to keep the emoji.
 */
export function icon3dForEmoji(emoji: string): Icon3DName | null {
  const e = emoji.replace(/\uFE0F/g, '');
  if (e === '\u{1F525}') return 'flame';
  if (e === '\u{1F3C6}') return 'trophy';
  if (e === '\u{1F451}') return 'crown';
  return null;
}

/** Props a lucide icon takes, so a 3D icon can stand in an icon table unchanged. */
export interface IconLikeProps {
  className?: string;
  style?: React.CSSProperties;
  fill?: string;
  strokeWidth?: string | number;
  'aria-label'?: string;
}

export type IconLike = React.ComponentType<IconLikeProps>;

/** Tailwind size class → px: w-3.5 → 14, w-[18px] → 18. */
function sizeFromClass(className: string): number | null {
  const px = className.match(/(?:^|\s)w-\[(\d+(?:\.\d+)?)px\]/);
  if (px) return Number(px[1]);
  const scale = className.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?=\s|$)/);
  if (scale) return Number(scale[1]) * 4;
  return null;
}

/**
 * A lucide-compatible component for an icon table (`icon: Flame` → `icon:
 * Flame3D`): the size comes from the w-* class (or style.width); color, fill
 * and stroke props are ignored, since the art carries its own colors.
 */
export function icon3dAs(name: Icon3DName, fallbackSize = 16): IconLike {
  function Icon3DLike({ className = '', style, 'aria-label': label }: IconLikeProps) {
    const fromStyle = typeof style?.width === 'number' ? style.width : null;
    const size = sizeFromClass(className) ?? fromStyle ?? fallbackSize;
    const classes = className.split(/\s+/).filter((c) => c && !/^(w|h)-/.test(c) && !/^text-/.test(c));
    const inline = classes.includes('inline');
    const rest = classes.filter((c) => c !== 'inline').join(' ');
    const keep: React.CSSProperties = { ...style };
    delete keep.color;
    delete keep.width;
    delete keep.height;
    return <Icon3D name={name} size={size} label={label} inline={inline} className={rest} style={keep} />;
  }
  Icon3DLike.displayName = `Icon3D(${name})`;
  return Icon3DLike;
}

export const Flame3D = icon3dAs('flame');
export const Trophy3D = icon3dAs('trophy');
export const Shield3D = icon3dAs('shield');
export const Crown3D = icon3dAs('crown');
export const Gear3D = icon3dAs('gear');
export const Help3D = icon3dAs('help');
export const Lock3D = icon3dAs('lock');
export const Bell3D = icon3dAs('bell');
export const AddFriend3D = icon3dAs('add-friend');
export const Share3D = icon3dAs('share');
