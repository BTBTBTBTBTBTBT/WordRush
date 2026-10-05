import Link from 'next/link';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { CastButton, CastLink, type CastColor } from '@/components/ui/cast-button';
import { FamIcon, type FamIconName } from '@/components/ui/family-button';

// The one button style (docs/FINISH_SPEC.md A8; reference
// docs/design/brand/buttons/chatgpt-buttons-*.jpg): a glossy candy pill (or
// circle) in a vertical gradient with a thin gold outline, a thick darker
// bottom lip, a white gloss on the top half and a white Nunito Black label
// with a dark-purple outline. Press = squish (components/ui/squish-host.tsx:
// scale .92 while the lip compresses). The look lives in globals.css `.candy*`.
// No hooks: renders in server components too.
//
// The button family (docs/design/brand/buttons/family/README.md, 10-05) replaced the look: `sm` → the HELPER
// pill, `round` → the helper circle, `peach` at md / lg → the QUIET pill (all globals.css `.candy*`), and any
// other md / lg → the cast primary (CastButton / CastLink, with the art labels).

export type CandyColor = 'purple' | 'pink' | 'amber' | 'teal' | 'peach';
/** lg 52 (primary CTAs) · md 40 · sm 32 · round 40 (icon only). */
export type CandySize = 'lg' | 'md' | 'sm' | 'round';
export type CandyIconName = 'play' | 'eye' | 'arrow' | 'share' | 'check' | 'trophy' | 'plus' | 'replay';

const ICON_PATHS: Record<CandyIconName, ReactNode> = {
  play: <path d="M7 4.6c0-1.2 1.3-1.9 2.3-1.3l11.2 7.2c.9.6.9 2 0 2.6L9.3 20.3c-1 .6-2.3-.1-2.3-1.3z" fill="#fff" />,
  eye: (
    <>
      <path d="M1.8 12C4.2 7.3 7.9 5 12 5s7.8 2.3 10.2 7c-2.4 4.7-6.1 7-10.2 7S4.2 16.7 1.8 12z" fill="#fff" />
      <circle cx="12" cy="12" r="3.9" fill="#3b1a78" />
      <circle cx="13.3" cy="10.7" r="1.3" fill="#fff" />
    </>
  ),
  arrow: <path d="M3 9.6h9.4V5.4c0-1 1.2-1.6 2-.9l7.2 6.4c.6.6.6 1.6 0 2.2l-7.2 6.4c-.8.7-2 .1-2-.9v-4.2H3c-.8 0-1.5-.7-1.5-1.5v-1.8c0-.8.7-1.5 1.5-1.5z" fill="#fff" />,
  share: (
    <>
      <path d="M12 2.5l5 5h-3.2v7.2h-3.6V7.5H7z" fill="#fff" />
      <path d="M4.5 12.5h3v6h9v-6h3V20a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20z" fill="#fff" />
    </>
  ),
  check: <path d="M3.5 12.6l2.6-2.6 4 4 8-8.1 2.6 2.6L10.1 19.2z" fill="#fff" />,
  trophy: <path d="M7 3h10v2h3.5v2.5a4.5 4.5 0 0 1-4.1 4.5A5 5 0 0 1 13.5 15v2.5H17V21H7v-3.5h3.5V15a5 5 0 0 1-2.9-3A4.5 4.5 0 0 1 3.5 7.5V5H7zM5.5 7v.5a2.5 2.5 0 0 0 1.6 2.3A7 7 0 0 1 7 8.6V7zm13 0H17v1.6c0 .4 0 .8-.1 1.2a2.5 2.5 0 0 0 1.6-2.3z" fill="#fff" />,
  plus: <path d="M10.2 3.5h3.6v6.7h6.7v3.6h-6.7v6.7h-3.6v-6.7H3.5v-3.6h6.7z" fill="#fff" />,
  replay: <path d="M12 4a8 8 0 1 1-7.6 10.5l3.3-1A4.6 4.6 0 1 0 12 7.4V10L6.8 6.2 12 2.4z" fill="#fff" />,
};

/** A candy icon (white with the dark-purple outline from `.candy-icon`). */
export function CandyIcon({ name, size = 20 }: { name: CandyIconName; size?: number }) {
  return (
    <span className="candy-icon" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24">{ICON_PATHS[name]}</svg>
    </span>
  );
}

const ICON_PX: Record<CandySize, number> = { lg: 22, md: 18, sm: 14, round: 20 };

/** Each color's gradient + lip (globals.css `.candy-*`), for inline recoloring. */
const CANDY_VARS: Record<CandyColor, [string, string, string]> = {
  purple: ['#a66bff', '#6d28d9', '#471a8d'],
  pink: ['#f472b6', '#a21caf', '#691272'],
  amber: ['#ffc56b', '#f97316', '#a24b0e'],
  teal: ['#5eead4', '#0d9488', '#086058'],
  peach: ['#ffd6c2', '#fbb38f', '#a3745d'],
};

/** Inline CSS vars that recolor a `.candy` element (a toggle's on state, a danger action). */
export function candyVars(color: CandyColor): React.CSSProperties {
  const [a, b, lip] = CANDY_VARS[color];
  return { ['--candy-1' as string]: a, ['--candy-2' as string]: b, ['--candy-lip' as string]: lip } as React.CSSProperties;
}

/**
 * The candy classes for a plain <button> (the games' old capsule helpers now
 * return this): small by default; `dim` = the quiet disabled look.
 */
export function candyClass({ color = 'purple', size = 'sm', dim = false, extra = '' }: { color?: CandyColor; size?: CandySize; dim?: boolean; extra?: string } = {}): string {
  return `candy candy-${color}${size === 'lg' ? '' : ` candy-${size}`}${dim ? ' candy-dim' : ''}${extra ? ` ${extra}` : ''}`;
}

interface CandyLook {
  color?: CandyColor;
  /** The screen's cast color (what purple means when this renders the cast primary). */
  screen?: CastColor;
  size?: CandySize;
  /** Leading icon: a candy glyph by name, or any node (e.g. a 3D icon). */
  icon?: CandyIconName | ReactNode;
  /** A trailing node (e.g. a count). */
  trailing?: ReactNode;
  /** Stretch to the container's width. */
  block?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

function classes({ color = 'purple', size = 'lg', block = false, className = '' }: CandyLook): string {
  const sz = size === 'lg' ? '' : ` candy-${size}`;
  return `candy candy-${color}${sz}${block ? ' candy-block' : ''} ${className}`.trim();
}

/** The candy glyphs with family art (the tinted 3D helper icons). */
const FAM_OF: Partial<Record<CandyIconName, FamIconName>> = { play: 'play', eye: 'eye', arrow: 'next', check: 'check', replay: 'refresh' };

/** True when this look renders the cast primary (md / lg, not the quiet peach). */
function isCast(color: CandyColor | undefined, size: CandySize | undefined): boolean {
  const s = size ?? 'lg';
  return (s === 'lg' || s === 'md') && color !== 'peach';
}

function Inner({ icon, size = 'lg', trailing, children }: CandyLook) {
  const fam = typeof icon === 'string' ? FAM_OF[icon as CandyIconName] : undefined;
  const iconNode = fam ? <FamIcon name={fam} />
    : typeof icon === 'string' ? <CandyIcon name={icon as CandyIconName} size={ICON_PX[size]} /> : icon;
  return (
    <>
      {iconNode}
      {children != null && <span className="candy-label">{children}</span>}
      {trailing}
    </>
  );
}

/** A candy <button>. */
export function CandyButton({ color, screen, size, icon, trailing, block, className, style, children, type = 'button', ...rest }: CandyLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'style' | 'className' | 'children'>) {
  if (isCast(color, size)) {
    return (
      <CastButton type={type} {...rest} color={color} screen={screen} size={size} icon={typeof icon === 'string' ? undefined : icon} trailing={trailing} block={block} className={className} style={style}>
        {children}
      </CastButton>
    );
  }
  return (
    <button type={type} {...rest} className={classes({ color, size, block, className })} style={style}>
      <Inner icon={icon} size={size} trailing={trailing}>{children}</Inner>
    </button>
  );
}

/**
 * A candy link: a Next <Link> by default, or a plain <a> with `native` (a full
 * document load, e.g. Unlimited on the same route as the finished daily).
 */
export function CandyLink({ href, native = false, color, screen, size, icon, trailing, block, className, style, children, ...rest }: CandyLook & {
  href: string;
  native?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'style' | 'className' | 'children' | 'href'>) {
  if (isCast(color, size)) {
    return (
      <CastLink href={href} native={native} {...rest} color={color} screen={screen} size={size} icon={typeof icon === 'string' ? undefined : icon} trailing={trailing} block={block} className={className} style={style}>
        {children}
      </CastLink>
    );
  }
  const cls = classes({ color, size, block, className });
  const inner = <Inner icon={icon} size={size} trailing={trailing}>{children}</Inner>;
  if (native) return <a href={href} {...rest} className={cls} style={style}>{inner}</a>;
  return <Link href={href} {...rest} className={cls} style={style}>{inner}</Link>;
}
