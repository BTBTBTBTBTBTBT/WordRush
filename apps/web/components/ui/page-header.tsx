import Link from 'next/link';
import { ChevronLeft, X } from 'lucide-react';
import { Mascot, type MascotMotion } from '@/components/ui/mascot';
import type { MascotId } from '@/lib/mascots';

// One header style for every page, screen and sheet (docs/HEADER_SPEC.md §4):
// the title in caps 900 with the purple→pink gradient (or the page's accent:
// VS teal, Friends pink, Leaderboard gold), the page's host beside it (§5:
// only when no banner on the page already carries the host), the back/close
// control as a soft white circle with the icon in #6d28d9, and right-side
// actions as the same white circles using the 3D icon set.
// No hooks, so it renders in server components too.

/** The back/close icon ink. */
export const HEADER_INK = '#6d28d9';

/** The soft shadow every header circle and stat pill sits on (no borders). */
export const HEADER_SHADOW = '0 1px 2px rgba(76, 29, 149, 0.08), 0 3px 10px rgba(76, 29, 149, 0.12)';

export type PageAccent = 'brand' | 'vs' | 'friends' | 'leaderboard';

/** Title gradients (VS and Friends match VS.title and FR.title). */
export const PAGE_TITLE_GRADIENTS: Record<PageAccent, string> = {
  brand: 'linear-gradient(135deg, #a78bfa, #ec4899)',
  vs: 'linear-gradient(90deg, #0d9488, #0891b2)',
  friends: 'linear-gradient(90deg, #db2777, #7c3aed)',
  leaderboard: 'linear-gradient(135deg, #f59e0b, #b45309)',
};

const circleStyle = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  background: '#ffffff',
  boxShadow: HEADER_SHADOW,
});

const circleClass = 'shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95';

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

/** A soft white icon circle (header actions, back/close). A link when given `href`. */
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

/** The back (chevron) or close (X) control: a white circle, icon in #6d28d9. */
export function HeaderBack({ kind = 'back', href, onClick, label, size = 34, className = '' }: HeaderNav & { kind?: 'back' | 'close'; size?: number; className?: string }) {
  const icon = Math.round(size * (kind === 'back' ? 0.56 : 0.47));
  return (
    <HeaderCircle label={label ?? (kind === 'back' ? 'Back' : 'Close')} href={href} onClick={onClick} size={size} className={className}>
      {kind === 'back'
        ? <ChevronLeft aria-hidden="true" style={{ width: icon, height: icon, color: HEADER_INK, marginLeft: -1 }} strokeWidth={3} />
        : <X aria-hidden="true" style={{ width: icon, height: icon, color: HEADER_INK }} strokeWidth={3} />}
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
  title, accent = 'brand', host, hostSize = 40, hostMotion = 'bob', back, close, right,
  titleTag = 'h1', titleSize = 22, sub, className = '',
}: PageHeaderProps) {
  const TitleTag = titleTag;
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
