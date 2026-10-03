import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArtTitle } from '@/components/ui/art-title';
import { POSE_SIZE, gameTitleArtLabel, poseSrc, type GameTitleArtName } from '@/lib/art';
import type { MascotId } from '@/lib/mascots';
import { accentInk, alphaHex, darken, softBackground, softShadow } from '@/lib/soft-surface';

// The guide page family (Strategy reader + index, How to Play; 3-platform
// parity spec): the guide card language (components/help/game-help-card.tsx,
// R1) without any stroke — a warm-cream card with the accent's soft gradient,
// the 8 px rainbow top bar, radius 28 and one soft accent shadow; the host in
// its "ready" pose on a glow + ground shadow (springs in once); numbered
// section heads with a soft numeral on a filled accent-wash circle; takeaways
// in a soft color field. Separation is space, color fields, size and weight —
// never a border. No hooks: server components render these too.

/** The guide card's rainbow top bar. */
export const GUIDE_BAR = 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)';

/** The no-stroke guide card surface (globals.css `.sg-card`): accent gradient over cream / the dark surface. */
export function guideCardStyle(accent: string, { radius = 28, hi = 0.1, lo = 0.04, hiDark = 0.24, loDark = 0.08, shadow = 0.2 }: {
  radius?: number; hi?: number; lo?: number; hiDark?: number; loDark?: number; shadow?: number;
} = {}): CSSProperties {
  return {
    ['--sg-hi' as string]: alphaHex(accent, hi),
    ['--sg-lo' as string]: alphaHex(accent, lo),
    ['--sg-hi-d' as string]: alphaHex(accent, hiDark),
    ['--sg-lo-d' as string]: alphaHex(accent, loDark),
    borderRadius: radius,
    boxShadow: softShadow(accent, shadow, 24, 8),
    overflow: 'hidden',
  } as CSSProperties;
}

/** The host's stage: soft radial glow, a ground shadow, the "ready" pose springing in once. */
export function GuideStage({ host, accent, size = 110, priority = false }: { host: MascotId; accent: string; size?: number; priority?: boolean }) {
  const deep = darken(accent, 0.35);
  const glow = Math.round(size * 1.25);
  return (
    <div aria-hidden="true" className="relative mx-auto pointer-events-none select-none" style={{ width: Math.round(size * 1.4), height: Math.round(size * 1.04) }}>
      <span className="absolute" style={{ left: '50%', top: '48%', width: glow, height: glow, marginLeft: -glow / 2, marginTop: -glow / 2, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(accent, 0.3)}, transparent 68%)` }} />
      <span className="absolute" style={{ left: '50%', bottom: 0, width: Math.round(size * 0.72), height: Math.round(size * 0.12), marginLeft: -Math.round(size * 0.36), borderRadius: '50%', background: `radial-gradient(ellipse, ${alphaHex(deep, 0.28)}, transparent 70%)` }} />
      <div className="absolute rp-spring" style={{ left: '50%', bottom: Math.round(size * 0.03), marginLeft: -size / 2 }}>
        <Image
          src={poseSrc(host, 'ready')}
          alt=""
          width={POSE_SIZE}
          height={POSE_SIZE}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          sizes={`${size}px`}
          draggable={false}
          className="block"
          style={{ width: size, height: size }}
        />
      </div>
    </div>
  );
}

/** The guide hero card: rainbow bar, then a centered column (stage, art, title, dek, chip …). */
export function GuideHeroCard({ accent, host, poseSize = 110, priority = false, className = 'px-5 pt-4 pb-5', children }: {
  accent: string;
  host: MascotId;
  poseSize?: number;
  priority?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="sg-card" style={guideCardStyle(accent)}>
      <div aria-hidden="true" style={{ height: 8, background: GUIDE_BAR }} />
      <div className={`flex flex-col items-center text-center ${className}`}>
        <GuideStage host={host} accent={accent} size={poseSize} priority={priority} />
        {children}
      </div>
    </div>
  );
}

/** A game's title art in a fixed-height slot, or its fallback text in the accent lettering. */
export function GuideTitleArt({ art, height, fallback, accent, align = 'center' }: {
  art: GameTitleArtName | null;
  height: number;
  fallback?: string | null;
  accent: string;
  align?: 'center' | 'left';
}) {
  if (art) {
    return <ArtTitle name={art} label={gameTitleArtLabel(art)} maxHeight={height} maxWidth={2000} as="div" align={align} priority={false} />;
  }
  if (!fallback) return null;
  const ink = accentInk(accent);
  return (
    <span className={`block font-black uppercase leading-none ${ink.className}`} style={{ ...ink.style, fontSize: Math.round(height * 0.6), letterSpacing: '0.04em' }}>
      {fallback}
    </span>
  );
}

/** "6 MIN READ": an accent-wash capsule, no stroke, black tracking caps in the darkened accent. */
export function ReadChip({ accent, children, size = 11 }: { accent: string; children: ReactNode; size?: number }) {
  const ink = accentInk(accent);
  return (
    <span
      className={`inline-flex items-center font-black uppercase leading-none ${ink.className}`}
      style={{ ...ink.style, fontSize: size, letterSpacing: '0.1em', padding: '6px 11px 5px', borderRadius: 999, background: alphaHex(accent, 0.16) }}
    >
      {children}
    </span>
  );
}

/** A numbered section head: the soft numeral on a filled accent-wash circle + the heading. */
export function GuideSectionHead({ n, accent, children, as: H = 'h2' }: { n: number; accent: string; children: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="soft-num shrink-0 inline-flex items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: '50%', background: alphaHex(accent, 0.16), color: accent, fontSize: 28, textShadow: 'none' }}
      >
        {n}
      </span>
      <H className="m-0 font-black leading-snug" style={{ fontSize: 18, color: 'var(--color-text)' }}>{children}</H>
    </div>
  );
}

/** The takeaway: a soft color field in the accent wash, bold text in the darkened accent. No border. */
export function GuideTakeaway({ accent, children }: { accent: string; children: ReactNode }) {
  const ink = accentInk(accent);
  return (
    <p className={`m-0 font-extrabold ${ink.className}`} style={{ ...ink.style, fontSize: 15, lineHeight: 1.45, padding: '12px 14px', borderRadius: 14, background: softBackground(accent, 0.1) }}>
      {children}
    </p>
  );
}

/** Body copy under a section head. */
export function GuideBody({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <p className="m-0" style={{ fontSize: size, lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>{children}</p>
  );
}

/** A tile on the Strategy index: accent gradient, 6 px solid accent top bar, one soft shadow, no stroke. */
export function StrategyTile({ href, accent, art, host, isVs, title, minutes }: {
  href: string;
  accent: string;
  art: GameTitleArtName | null;
  host: MascotId;
  isVs: boolean;
  title: string;
  minutes: number;
}) {
  const ink = accentInk(accent);
  return (
    <Link
      href={href}
      className="sg-card flex flex-col h-full"
      style={guideCardStyle(accent, { radius: 22, hi: 0.16, lo: 0.06, hiDark: 0.26, loDark: 0.1, shadow: 0.16 })}
    >
      <div aria-hidden="true" style={{ height: 5, background: accent, flex: 'none' }} />
      {/* BJ7: art, the title (3 lines reserved so a row's tiles match) and the minutes
          chip right under it — no chip floating at the bottom. */}
      <div className="flex flex-col flex-1 gap-1.5 px-3 pt-2.5 pb-2.5">
        <div className="flex items-center" style={{ minHeight: 36 }}>
          {art ? (
            <GuideTitleArt art={art} height={30} accent={accent} align="left" />
          ) : isVs ? (
            <span aria-hidden="true" className={`font-black italic leading-none ${ink.className}`} style={{ ...ink.style, fontSize: 30, letterSpacing: '0.02em' }}>VS</span>
          ) : (
            <Image src={poseSrc(host, 'ready')} alt="" aria-hidden width={POSE_SIZE} height={POSE_SIZE} sizes="36px" loading="lazy" draggable={false} style={{ width: 36, height: 36 }} />
          )}
        </div>
        <h3 className="m-0 font-black leading-snug line-clamp-3" style={{ fontSize: 14, color: 'var(--color-text)', minHeight: '4.125em' }}>{title}</h3>
        <div>
          <ReadChip accent={accent} size={10}>{minutes} min</ReadChip>
        </div>
      </div>
    </Link>
  );
}

/** One half of the reader's prev / next row: a borderless soft field in that article's accent. */
export function PrevNextLink({ href, accent, eyebrow, title, align = 'left' }: {
  href: string;
  accent: string;
  eyebrow: string;
  title: string;
  align?: 'left' | 'right';
}) {
  const ink = accentInk(accent);
  return (
    <Link
      href={href}
      className={`flex flex-col gap-1 h-full px-3.5 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}
      style={{ background: softBackground(accent, 0.13), borderRadius: 16, boxShadow: softShadow(accent, 0.1, 12, 4) }}
    >
      <span className={`font-black uppercase leading-none ${ink.className}`} style={{ ...ink.style, fontSize: 10, letterSpacing: '0.12em' }}>{eyebrow}</span>
      <span className="font-black leading-snug line-clamp-2" style={{ fontSize: 13, color: 'var(--color-text)' }}>{title}</span>
    </Link>
  );
}

/**
 * A soft numeral on a filled accent-wash circle (no stroke): the numbered rows
 * of a page like the Word of the Day senses (FINISH_SPEC BI17).
 */
export function GuideNumeral({ n, accent, size = 34 }: { n: number; accent: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="soft-num shrink-0 inline-flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: '50%', background: alphaHex(accent, 0.16), color: accent, fontSize: Math.round(size * 0.62), textShadow: 'none' }}
    >
      {n}
    </span>
  );
}

/**
 * A word in the brand caps lettering for server-rendered pages (the static
 * look of components/ui/live-headline.tsx's home palette: the vertical
 * gradient fill and a soft 3D edge) as a real heading element, so the text
 * stays crawlable and the page keeps its h1. One line; shrinks on narrow
 * screens.
 */
export function GuideWordmark({ children, size = 40, as: H = 'h1' }: { children: ReactNode; size?: number; as?: 'h1' | 'h2' | 'p' }) {
  return (
    <H
      className="m-0 font-black uppercase leading-none whitespace-nowrap"
      style={{
        fontSize: `clamp(24px, 11vw, ${size}px)`,
        letterSpacing: '0.02em',
        padding: '0.06em 0.08em 0.12em',
        backgroundImage: 'linear-gradient(180deg, #a66bff, #d946ef)',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        filter: 'drop-shadow(0 2px 0 #4c1d95)',
      }}
    >
      {children}
    </H>
  );
}
