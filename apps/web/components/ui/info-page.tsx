import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { InfoPageHeader, type InfoPageHeaderProps } from '@/components/ui/info-page-header';
import { PageBackground } from '@/components/ui/page-background';
import { BRAND_ACCENT, alphaHex, cardBarStyle, softCard, softPill } from '@/lib/soft-surface';
import { INTRO_BAR } from '@/lib/info-page';

export { INFO_ACCENTS, INTRO_BAR, infoAccent } from '@/lib/info-page';

// The one footer / info page layout (docs/FINISH_SPEC.md C6; mockup
// finishing-touches.html, the Guides phone): the page wallpaper, a controls
// row with the bare 3D back + help icons, the page's own title art as a
// headline (all the same height), an intro card (lavender, purple→pink top
// bar), then tinted cards with 10 px top bars — game guides in each game's
// own accent, FAQ as question cards, Privacy / Terms as section cards.
// A1: every card is its accent's wash over var(--color-card-base), so dark mode
// keeps its dark surfaces; the inks are the theme tokens. No hooks: server-safe.

/** The page shell: wallpaper + controls row + headline + a body column of cards. */
export function InfoPageLayout({ children, className = '', ...header }: InfoPageHeaderProps & { children: ReactNode; className?: string }) {
  return (
    <PageBackground tint="home" className="min-h-screen pb-16">
      <InfoPageHeader {...header} />
      {/* BJ7: 8 between cards (was 12). */}
      <div className={`info-page max-w-2xl mx-auto px-4 pt-2 pb-6 flex flex-col gap-2 ${className}`}>{children}</div>
    </PageBackground>
  );
}

/**
 * A tinted card with the game-card top bar (A1): the accent's wash, its soft
 * border and shadow, overflow hidden so the bar follows the corners. `bar` is a
 * CSS background for the bar (defaults to the accent).
 */
export function InfoCard({ accent = BRAND_ACCENT, bar, as: Tag = 'div', className = 'p-4', style, children, id }: {
  accent?: string;
  bar?: string;
  as?: 'div' | 'section' | 'article';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag id={id} style={{ ...softCard(accent), overflow: 'hidden', ...style }}>
      <div aria-hidden="true" style={bar ? { ...cardBarStyle(accent), background: bar } : cardBarStyle(accent)} />
      <div className={className}>{children}</div>
    </Tag>
  );
}

/** The intro card: lavender wash, purple → pink top bar, a bold lead line and the page's sub. */
export function IntroCard({ title, children, titleAs: TitleTag = 'p' }: {
  title?: ReactNode;
  children?: ReactNode;
  /** The lead line's element ('h1' on article pages whose headline art is a div). */
  titleAs?: 'p' | 'h1' | 'h2';
}) {
  return (
    <InfoCard bar={INTRO_BAR} className="p-4 flex flex-col gap-1.5">
      {title != null && (
        <TitleTag className="m-0 font-black leading-snug" style={{ fontSize: 15, color: 'var(--color-text)' }}>{title}</TitleTag>
      )}
      {children}
    </InfoCard>
  );
}

/** The intro card's body copy (13 px by default, bold-ish, the theme's secondary ink). */
export function IntroText({ children, size = 13, className = '' }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <p className={`m-0 font-bold leading-relaxed ${className}`} style={{ fontSize: size, color: 'var(--color-text-secondary)' }}>
      {children}
    </p>
  );
}

/** A section card (Privacy / Terms / How to Play / guide sections): a tinted card with its h2. */
export function SectionCard({ heading, accent = BRAND_ACCENT, headingAs: H = 'h2', children, className = 'p-5', id }: {
  heading?: ReactNode;
  accent?: string;
  headingAs?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <InfoCard accent={accent} className={className} id={id}>
      {heading != null && (
        <H className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>{heading}</H>
      )}
      {children}
    </InfoCard>
  );
}

/** A FAQ question card: the question (h3) over its answer, in the section's accent. */
export function QuestionCard({ q, a, accent = BRAND_ACCENT }: { q: ReactNode; a: ReactNode; accent?: string }) {
  return (
    <InfoCard accent={accent} className="px-4 py-3.5 flex gap-3 items-start">
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center font-black text-white"
        style={{ width: 26, height: 26, borderRadius: 9, fontSize: 14, background: `linear-gradient(${alphaHex(accent, 0.75)}, ${accent})`, boxShadow: `0 2px 0 ${alphaHex(accent, 0.45)}` }}
      >
        Q
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-black leading-snug mb-1" style={{ color: 'var(--color-text)' }}>{q}</h3>
        <p className="text-xs leading-relaxed m-0" style={{ color: 'var(--color-text-secondary)' }}>{a}</p>
      </div>
    </InfoCard>
  );
}

/**
 * A tappable card (mockup `.guidecard`): an icon, a title and a one-line sub,
 * tinted in its accent with the top bar. The whole card is the link (a tinted
 * surface, not an A8 button); it squishes via the global squish host.
 */
export function LinkCard({ href, accent = BRAND_ACCENT, icon, title, sub, eyebrow, titleAs: T = 'span', subLines = 1 }: {
  href: string;
  accent?: string;
  icon?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  eyebrow?: ReactNode;
  /** 'h2' / 'h3' when the card title is a heading in the page outline. */
  titleAs?: 'span' | 'h2' | 'h3';
  /** 1 = truncate the sub to one line; 0 = let it wrap. */
  subLines?: 0 | 1;
}) {
  return (
    <Link href={href} className="block" style={{ ...softCard(accent), overflow: 'hidden' }}>
      <div aria-hidden="true" style={cardBarStyle(accent)} />
      {/* BJ7: icon + title top-aligned, the sub 4 under the title. */}
      <div className="grid items-start gap-2.5 px-3 py-2" style={{ gridTemplateColumns: icon ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)' }}>
        {icon && <span className="flex items-center justify-center" style={{ width: 40, height: 40 }}>{icon}</span>}
        <div className="min-w-0">
          {eyebrow != null && (
            <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{eyebrow}</div>
          )}
          <T className="block m-0 font-black leading-snug" style={{ fontSize: 15, color: 'var(--color-text)' }}>{title}</T>
          {sub != null && (
            <small className={`block text-xs font-bold leading-snug mt-1 ${subLines === 1 ? 'truncate' : ''}`} style={{ color: 'var(--color-text-secondary)' }}>{sub}</small>
          )}
        </div>
      </div>
    </Link>
  );
}

/** A small tinted label chip (FAQ section headings, month labels) sitting on the wallpaper. */
export function InfoLabel({ children, accent = BRAND_ACCENT, as: Tag = 'h2' }: { children: ReactNode; accent?: string; as?: 'h2' | 'h3' | 'div' }) {
  return (
    <Tag
      className="self-start m-0 mt-2 px-3 pt-2 pb-1.5 text-[11px] font-black uppercase tracking-wider"
      style={{ ...softPill(accent), color: 'var(--color-text)' }}
    >
      {children}
    </Tag>
  );
}
