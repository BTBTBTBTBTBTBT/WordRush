import Link from 'next/link';
import { X } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { ArtTitle } from '@/components/ui/art-title';
import { ART_SIZE, type TitleArtName } from '@/lib/art';
import { HEADLINE, headlineMaxWidth } from '@/lib/headline';
import { Mascot, type MascotMotion } from '@/components/ui/mascot';
import type { MascotId } from '@/lib/mascots';

// One header style for every page, screen and sheet (docs/HEADER_SPEC.md §4):
// the title in caps 900 with the purple→pink gradient (or the page's accent:
// VS teal, Friends pink, Leaderboard gold), the page's host beside it (§5:
// only when no banner on the page already carries the host). FINISH_SPEC A3:
// the back/close control and the right-side actions are the soft 3D icons
// drawn BARE — no circle behind them — at 23 px with a 44 px tap area and the
// icon squish on press (globals.css `.hdr-glyph`).
// No hooks, so it renders in server components too.

/** The back/close icon ink. */
export const HEADER_INK = '#6d28d9';

/** The soft shadow the old header circles sat on (kept for the few chips that still use it). */
export const HEADER_SHADOW = '0 1px 2px rgba(76, 29, 149, 0.08), 0 3px 10px rgba(76, 29, 149, 0.12)';

/** A3: the bare header icon height (px). */
export const HEADER_GLYPH = 23;

export type PageAccent = 'brand' | 'vs' | 'friends' | 'leaderboard';

/** Title gradients (VS and Friends match VS.title and FR.title). */
export const PAGE_TITLE_GRADIENTS: Record<PageAccent, string> = {
  brand: 'linear-gradient(135deg, #a78bfa, #ec4899)',
  vs: 'linear-gradient(90deg, #0d9488, #0891b2)',
  friends: 'linear-gradient(90deg, #db2777, #7c3aed)',
  leaderboard: 'linear-gradient(135deg, #f59e0b, #b45309)',
};

// A3 / WHITE_AUDIT lever 3: no bubble — the slot keeps its size so layouts
// don't move, and `.hdr-glyph` gives the 44 px tap area + the icon squish.
const circleStyle = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  background: 'transparent',
});

const circleClass = 'hdr-glyph shrink-0 flex items-center justify-center';

interface HeaderCircleProps {
  /** Accessible name (the circle's content is decorative). */
  label: string;
  onClick?: () => void;
  href?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** A bare header icon slot (header actions, back/close; A3: no circle). A link when given `href`. */
export function HeaderCircle({ label, onClick, href, size = 34, className = '', style, children }: HeaderCircleProps) {
  const s = { ...circleStyle(size), ...style };
  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={label} className={`${circleClass} ${className}`} style={s}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={`${circleClass} ${className}`} style={s}>
      {children}
    </button>
  );
}

export interface HeaderNav {
  href?: string;
  onClick?: () => void;
  label?: string;
}

/**
 * The back or close (X) control, bare (A3). Back draws the 3D back arrow
 * (docs/ART_SPEC.md §5) at 23 px; close keeps a chunky X in #6d28d9.
 */
export function HeaderBack({ kind = 'back', href, onClick, label, size = 34, className = '' }: HeaderNav & { kind?: 'back' | 'close'; size?: number; className?: string }) {
  return (
    <HeaderCircle label={label ?? (kind === 'back' ? 'Back' : 'Close')} href={href} onClick={onClick} size={size} className={className}>
      {kind === 'back'
        ? <Icon3D name="back" size={HEADER_GLYPH} />
        : <X aria-hidden="true" style={{ width: 22, height: 22, color: HEADER_INK, filter: 'drop-shadow(0 2px 3px rgba(76, 29, 149, 0.2))' }} strokeWidth={3.4} />}
    </HeaderCircle>
  );
}

/** The gradient caps 900 title on its own (sheets and dialogs wrap it in their own title element). */
export function PageTitleText({ children, accent = 'brand', size = 22, className = '' }: { children: React.ReactNode; accent?: PageAccent; size?: number; className?: string }) {
  return (
    <span
      className={`font-black uppercase leading-tight text-transparent bg-clip-text ${className}`}
      style={{ fontSize: size, letterSpacing: 0.4, backgroundImage: PAGE_TITLE_GRADIENTS[accent] }}
    >
      {children}
    </span>
  );
}

interface PageHeaderProps {
  title: React.ReactNode;
  /**
   * The page's whole-cast title art (docs/ART_SPEC.md §2). It replaces the text
   * title and the host; `title` (or `artLabel`) becomes its accessible name.
   */
  art?: TitleArtName;
  /** The art's accessible name when `title` isn't plain text. */
  artLabel?: string;
  /** Widest the art draws (CSS px). */
  artMaxWidth?: number;
  accent?: PageAccent;
  /** The page's host (MASCOT_SPEC §1/§6). Leave unset where a banner below carries it (§5). */
  host?: MascotId;
  hostSize?: number;
  hostMotion?: MascotMotion;
  /** Leading back chevron. */
  back?: HeaderNav;
  /** Trailing close X (after any right-side actions). */
  close?: HeaderNav;
  /** Right-side actions (HeaderCircle buttons, chips). */
  right?: React.ReactNode;
  titleTag?: 'h1' | 'h2' | 'div';
  titleSize?: number;
  /** Optional line under the title. */
  sub?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title, art, artLabel, artMaxWidth = 420, accent = 'brand', host, hostSize = 40, hostMotion = 'bob', back, close, right,
  titleTag = 'h1', titleSize = 22, sub, className = '',
}: PageHeaderProps) {
  const TitleTag = titleTag;
  if (art) {
    return (
      <div className={`flex items-center gap-2 ${className}`} style={{ minHeight: 44 }}>
        {back && <HeaderBack kind="back" {...back} />}
        <div className="flex-1 min-w-0">
          {/* FINISH_SPEC N1: lettering-only titles are small centered headlines (≈62%, ≤ 300 × 64). */}
          <ArtTitle
            name={art}
            label={artLabel ?? (typeof title === 'string' ? title : '')}
            as={titleTag}
            maxWidth={Math.min(artMaxWidth, headlineMaxWidth(ART_SIZE[art][0], ART_SIZE[art][1]))}
            widthPct={HEADLINE.widthPct}
            align="center"
          />
          {sub}
        </div>
        {right}
        {close && <HeaderBack kind="close" {...close} />}
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 ${className}`} style={{ minHeight: 44 }}>
      {back && <HeaderBack kind="back" {...back} />}
      {host && <Mascot id={host} size={hostSize} motion={hostMotion} priority />}
      <div className="flex-1 min-w-0">
        <TitleTag
          className="font-black uppercase leading-tight truncate text-transparent bg-clip-text"
          style={{ fontSize: titleSize, letterSpacing: 0.4, backgroundImage: PAGE_TITLE_GRADIENTS[accent] }}
        >
          {title}
        </TitleTag>
        {sub}
      </div>
      {right}
      {close && <HeaderBack kind="close" {...close} />}
    </div>
  );
}
