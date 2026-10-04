import Link from 'next/link';
import { isValidElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { ART_SIZE, artSrc, type ArtName } from '@/lib/art';
import { CandyIcon, type CandyColor, type CandySize } from '@/components/ui/candy-button';

// FINISH_SPEC BJ15 — cast-color buttons + art labels (docs/design/brand/buttons/cast/README.md,
// cast/labels.json, labels/labels.json). THE primary button:
//   · skin   art-btn-<color>-<s|m|l>[-pressed][-dark] as a CSS border-image three-slice (caps drawn as is,
//            only the middle 1-px column stretches); :active swaps the -pressed skin, dark theme the -dark ones
//   · label  art-btnlabel-<slug> at ONE cap height (0.42 × the button height); dynamic text (names, prices,
//            countdowns…) → the live Nunito Black fallback at the same cap height
//   · width  label + 2 × max(0.6 × h, 14 px @44) — the button widens; a fixed slot shrinks the label
// Press = the global squish (squish-host) + the label drops 1 px. Performance: <CastArtWarmup/> (root layout)
// decodes every skin + label at idle, so nothing pops in. No hooks: renders in server components too.

export type CastColor = 'purple' | 'teal' | 'green' | 'blue' | 'gold' | 'slate' | 'orange' | 'pink';
export type CastSize = 's' | 'm' | 'l';

export const CAST_COLORS: readonly CastColor[] = ['purple', 'teal', 'green', 'blue', 'gold', 'slate', 'orange', 'pink'];
const HEIGHT: Record<CastSize, number> = { s: 32, m: 44, l: 56 };
/** labels.json `stroke` / `shadow`: a deeper shade of the same hue. */
export const CAST_DEEP: Record<CastColor, string> = {
  purple: '#4f0192', gold: '#936801', slate: '#3b3f51', orange: '#934400',
  pink: '#931048', teal: '#016774', green: '#1a7724', blue: '#003091',
};

/** Label-art slugs keyed by the label's letters (A–Z / 0–9). ship-labels.py prints this. */
const LABEL_ART: Record<string, string> = {
  PLAY: 'play', SIGNIN: 'signin', DONE: 'done', GOPRO: 'gopro', REMATCH: 'rematch', HINT: 'hint',
  ADDAFRIEND: 'addfriend', TAKETHETOUR: 'tour', SEEALL: 'seeall', SHARERESULTS: 'shareresults', SHARE: 'share',
  ACCEPT: 'accept', NEXT: 'next', PLAYAGAIN: 'playagain', TRYAGAIN: 'tryagain', DECLINE: 'decline',
  SENDAGIFT: 'sendgift', UPGRADETOPRO: 'upgrade', GOTIT: 'gotit', SEEPRO: 'seepro', LETSPLAY: 'letsplay',
  CHALLENGETHEM: 'challengethem', SEEFRIENDS: 'seefriends', STARTPLAYING: 'startplaying', UNDO: 'undo',
  CONTINUE: 'continue', HOWTOPLAY: 'howtoplay', SKIP: 'skip', SHARELINK: 'sharelink', ERASE: 'erase',
  KEEPPLAYING: 'keepplaying', SAVE: 'save', NOTNOW: 'notnow', START: 'start', SIGNUP: 'signup', INVITE: 'invite',
  HEADS: 'heads', TAILS: 'tails', COPIED: 'copied',
};
export const CAST_LABEL_SLUGS: readonly string[] = Object.values(LABEL_ART);

export function labelKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** The art slug for a fixed label, or null (→ live text). */
export function labelArt(text: string): string | null {
  return LABEL_ART[labelKey(text)] ?? null;
}

/** An old candy color → its cast color (purple → the screen's color; amber → gold; quiet peach → slate). */
export function castOf(color: CandyColor | CastColor | undefined, screen: CastColor = 'purple'): CastColor {
  switch (color) {
    case undefined: case 'purple': return screen;
    case 'amber': return 'gold';
    case 'peach': return 'slate';
    default: return color;
  }
}

function sizeOf(size: CandySize | CastSize | undefined): CastSize {
  if (size === 'md' || size === 'm') return 'm';
  if (size === 'sm' || size === 's') return 's';
  return 'l';
}

/** border-image for one skin: caps drawn as is, the middle 1-px column stretched. */
function skinBorder(name: string, h: number): string {
  const [w, ph] = ART_SIZE[name as ArtName] ?? [h * 3 * 1.9, h * 3];
  const left = Math.floor(w / 2);
  const right = w - left - 1;
  const k = h / ph;
  return `url(${artSrc(name)}) 0 ${right} 0 ${left} fill / 0 ${(right * k).toFixed(2)}px 0 ${(left * k).toFixed(2)}px / 0 stretch`;
}

function castVars(c: CastColor, s: CastSize): CSSProperties {
  const h = HEIGHT[s];
  const base = `art-btn-${c}-${s}`;
  return {
    ['--cast-h' as string]: `${h}px`,
    ['--cast-pad' as string]: `${Math.max(0.6 * h, (14 * h) / 44)}px`,
    ['--cast-cap' as string]: `${Math.round(h * 0.42 * 3) / 3}px`,
    ['--cast-deep' as string]: CAST_DEEP[c],
    ['--cast-skin' as string]: skinBorder(base, h),
    ['--cast-skin-p' as string]: skinBorder(`${base}-pressed`, h),
    ['--cast-skin-d' as string]: skinBorder(`${base}-dark`, h),
    ['--cast-skin-pd' as string]: skinBorder(`${base}-pressed-dark`, h),
  } as CSSProperties;
}

function textOf(children: ReactNode): string | null {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children) && children.every((c) => typeof c === 'string' || typeof c === 'number')) return children.join('');
  return null;
}

/** The label: the art lettering when the text has art, else the live fallback (same cap height). */
export function CastLabel({ children, color, ariaHidden = false }: { children: ReactNode; color: CastColor; ariaHidden?: boolean }) {
  const text = textOf(children);
  const slug = text != null ? labelArt(text) : null;
  if (slug) {
    const name = `art-btnlabel-${slug}` as ArtName;
    const [w, h] = ART_SIZE[name] ?? [300, 96];
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`cast-label-art${color === 'gold' ? ' cast-label-gold' : ''}`}
        src={artSrc(name)}
        alt={ariaHidden ? '' : text ?? ''}
        width={w}
        height={h}
        draggable={false}
        decoding="sync"
        style={{ aspectRatio: `${w} / ${h}` }}
      />
    );
  }
  return <span className="cast-label-live">{children}</span>;
}

interface CastLook {
  /** A cast color, or an old candy color (mapped by `castOf`). */
  color?: CastColor | CandyColor;
  /** The screen's cast color (what purple / no color means here). */
  screen?: CastColor;
  size?: CastSize | CandySize;
  /** Kept for drop-in parity with CandyButton: a custom node icon is shown; named glyphs are dropped. */
  icon?: ReactNode;
  trailing?: ReactNode;
  block?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function look({ color, screen, size, block, className = '', style }: CastLook) {
  const c = castOf(color, screen);
  const s = sizeOf(size);
  return {
    c,
    className: `cast cast-${s}${block ? ' cast-block' : ''} ${className}`.trim(),
    style: { ...castVars(c, s), ...style },
  };
}

function Inner({ icon, trailing, children, c }: CastLook & { c: CastColor }) {
  return (
    <>
      {/* Old outlined candy glyphs are dropped (the lettering carries the button); 3D icons stay. */}
      {isValidElement(icon) && icon.type !== CandyIcon && icon}
      {children != null && <CastLabel color={c}>{children}</CastLabel>}
      {trailing}
    </>
  );
}

/** FINISH_SPEC BJ15 a cast-color <button>. */
export function CastButton({ color, screen, size, icon, trailing, block, className, style, children, type = 'button', ...rest }: CastLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'style' | 'className' | 'children'>) {
  const l = look({ color, screen, size, block, className, style });
  return (
    <button type={type} {...rest} className={l.className} style={l.style}>
      <Inner icon={icon} trailing={trailing} c={l.c}>{children}</Inner>
    </button>
  );
}

/** FINISH_SPEC BJ15 a cast-color link (`native` = a plain <a>, a full document load). */
export function CastLink({ href, native = false, color, screen, size, icon, trailing, block, className, style, children, ...rest }: CastLook & {
  href: string;
  native?: boolean;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'color' | 'style' | 'className' | 'children' | 'href'>) {
  const l = look({ color, screen, size, block, className, style });
  const inner = <Inner icon={icon} trailing={trailing} c={l.c}>{children}</Inner>;
  if (native) return <a href={href} {...rest} className={l.className} style={l.style}>{inner}</a>;
  return <Link href={href} {...rest} className={l.className} style={l.style}>{inner}</Link>;
}

/** Every skin + label path (the warm-up list). */
export function castArtPaths(): string[] {
  const out: string[] = [];
  for (const c of CAST_COLORS) {
    for (const s of ['s', 'm', 'l'] as const) {
      for (const v of ['', '-pressed', '-dark', '-pressed-dark']) out.push(artSrc(`art-btn-${c}-${s}${v}`));
    }
  }
  for (const slug of CAST_LABEL_SLUGS) out.push(artSrc(`art-btnlabel-${slug}`));
  return out;
}

/** BJ15 round 2: text links / tertiary actions stay text, never a cast pill (Forgot password?, Sign up, Play without an account). */
export function TextLink({ className = '', style, children, type = 'button', ...rest }: { className?: string; style?: CSSProperties; children?: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style' | 'className' | 'children'>) {
  return <button type={type} {...rest} className={`cast-text-link ${className}`.trim()} style={style}>{children}</button>;
}

/** The link twin of TextLink (`native` = a plain <a>). */
export function TextLinkA({ href, native = false, className = '', style, children, ...rest }: { href: string; native?: boolean; className?: string; style?: CSSProperties; children?: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'style' | 'className' | 'children' | 'href'>) {
  const cls = `cast-text-link ${className}`.trim();
  if (native) return <a href={href} {...rest} className={cls} style={style}>{children}</a>;
  return <Link href={href} {...rest} className={cls} style={style}>{children}</Link>;
}
