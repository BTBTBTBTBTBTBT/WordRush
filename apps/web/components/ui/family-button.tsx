import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { artSrc, type ArtName } from '@/lib/art';

// The button family (docs/design/brand/buttons/family/README.md; iOS FamilyButtons, Android FamilyButtons.kt):
// everything that is not a primary cast button. Technique = fill + light map: the plain capsule fill
// (any color), then art-fam-lm-frost (gloss + shading as a white/black overlay) three-sliced on top. The look
// lives in globals.css on the old `.candy` classes, so the old call sites switch with it:
//   HELPER  `.candy.candy-sm`        34 px, the game accent's wash, a tinted 3D icon + the deep-tint label
//   circle  `.candy.candy-round`     the 34 × 34 helper
//   QUIET   `.candy.candy-peach`     lavender, purple ink (small 34 · medium 40 · large 44)
//   ROUND   `.fam-round`             a bare 28 px 3D icon in a 44 px hit area
// No hooks: renders in server components too.

/** The helper icons (`art-fam-ic-*`): white clay, tinted by multiply with the ink. */
export type FamIconName =
  | 'delete' | 'shuffle' | 'enter' | 'hint' | 'eye' | 'flag' | 'check' | 'undo' | 'next' | 'refresh'
  | 'sparkles' | 'pencil' | 'erase' | 'xmark' | 'play' | 'chart';
export const FAM_ICONS: readonly FamIconName[] = [
  'delete', 'shuffle', 'enter', 'hint', 'eye', 'flag', 'check', 'undo', 'next', 'refresh', 'sparkles', 'pencil', 'erase', 'xmark', 'play', 'chart',
];
/** The chrome icons (`art-fam-cic-*`): drawn as they are (no tint). */
export type FamChromeIcon = 'close' | 'info' | 'gem';

export const famIconSrc = (name: FamIconName) => artSrc(`art-fam-ic-${name}`);
export const famChromeSrc = (name: FamChromeIcon) => artSrc(`art-fam-cic-${name}`);

/** A tinted 3D helper icon (fit in 18 px; `ink` defaults to the text color, i.e. the helper's deep tint). */
export function FamIcon({ name, size = 18, ink, className = '' }: { name: FamIconName; size?: number; ink?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`fic ${className}`.trim()}
      style={{ ['--ic' as string]: `url(${famIconSrc(name)})`, width: size, height: size, ...(ink ? { ['--fic-ink' as string]: ink } : {}) } as CSSProperties}
    />
  );
}

type ButtonRest = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'className' | 'children'>;

/**
 * The HELPER pill: 34 px, the tint's wash (light 20% / dark 34%), the icon + a Nunito Black 12.5 uppercase label
 * in the deep tint. `tint` = the game's accent (defaults to the page's: the game accent inside a game screen, else
 * purple). `circle` = the icon-only 34 × 34 helper. `used` = the spent / disabled look.
 */
export function HelperButton({ tint, icon, circle = false, used = false, on = false, className = '', style, children, type = 'button', ...rest }: ButtonRest & {
  tint?: string;
  icon?: FamIconName | ReactNode;
  circle?: boolean;
  used?: boolean;
  /** Selected (a tab / choice that is on): the solid tint with white ink. */
  on?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const cls = `candy candy-sm${circle ? ' candy-round' : ''}${used ? ' candy-dim' : ''}${on ? ' candy-on' : ''} ${className}`.trim();
  const iconNode = typeof icon === 'string' ? <FamIcon name={icon as FamIconName} /> : icon;
  return (
    <button type={type} {...rest} className={cls} style={{ ...(tint ? { ['--fam-tint' as string]: tint } : {}), ...style } as CSSProperties}>
      {iconNode}
      {children != null && !circle && <span className="candy-label">{children}</span>}
    </button>
  );
}

/** The QUIET pill (secondary actions): lavender #ece4ff, purple ink. lg 44 · md 40 · sm 34. */
export function QuietButton({ size = 'md', block = false, icon, className = '', style, children, type = 'button', ...rest }: ButtonRest & {
  size?: 'lg' | 'md' | 'sm';
  block?: boolean;
  icon?: FamIconName | ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const sz = size === 'lg' ? '' : ` candy-${size}`;
  const iconNode = typeof icon === 'string' ? <FamIcon name={icon as FamIconName} /> : icon;
  return (
    <button type={type} {...rest} className={`candy candy-peach${sz}${block ? ' candy-block' : ''} ${className}`.trim()} style={style}>
      {iconNode}
      {children != null && <span className="candy-label">{children}</span>}
    </button>
  );
}

/** The ROUND icon button: a bare 3D icon (28 px) in a 44 px hit area, squish .9 — no bubble (founder rule). */
export function RoundIconButton({ icon, label, size = 28, className = '', style, type = 'button', ...rest }: ButtonRest & {
  /** `close` / `info` (the family chrome icons) or any art name (the existing icon3d / header icons). */
  icon: FamChromeIcon | ArtName;
  label: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const src = icon === 'close' || icon === 'info' || icon === 'gem' ? famChromeSrc(icon) : artSrc(icon);
  return (
    <button type={type} {...rest} aria-label={label} className={`fam-round ${className}`.trim()} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" draggable={false} style={{ width: size, height: size }} />
    </button>
  );
}

/**
 * 2.8 item 23: the ROUND icon tap for any bare glyph (header counters + icons, the game corner Home, back/close):
 * `.hdr-glyph` gives the 44 px tap area, the global squish plays on press. Every header circle routes through here
 * instead of hand-rolling a <button>.
 */
export function RoundIconSlot({ label, className = '', style, type = 'button', children, ...rest }: ButtonRest & { label: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <button type={type} {...rest} aria-label={label} className={`hdr-glyph ${className}`.trim()} style={style}>
      {children}
    </button>
  );
}

/** The family 3D close X as a bare glyph, for a close that already owns its hit area (HeaderCircle, a popup corner). */
export function FamCloseGlyph({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={famChromeSrc('close')} alt="" aria-hidden="true" draggable={false}
      style={{ width: size, height: size, objectFit: 'contain', filter: 'drop-shadow(0 2px 2.5px rgba(76, 29, 149, 0.18))' }} />
  );
}

/** Every family sprite (the idle warm-up list, CastArtWarmup). */
export function famArtPaths(): string[] {
  return [
    artSrc('art-fam-lm-frost'), artSrc('art-fam-lm-frost-pressed'), artSrc('art-fam-lm-key'),
    ...FAM_ICONS.map(famIconSrc),
    ...(['close', 'info', 'gem'] as const).map(famChromeSrc),
  ];
}
