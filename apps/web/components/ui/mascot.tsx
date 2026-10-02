import Image from 'next/image';
import { CAST, gameHost, mascotSrc, type MascotId } from '@/lib/mascots';

// The cast components (docs/MASCOT_SPEC.md §0): Mascot(id, size, motion) and
// CastRow(size, motion). Decorative only: aria-hidden, empty alt, never takes a
// tap (pointer-events: none). Motions are CSS (globals.css, `.mascot-*`) and
// stop under Reduce Motion, both the OS setting and the in-app toggle.
// No hooks here, so these render in server components too.

export type MascotMotion = 'none' | 'bob' | 'pop' | 'wave';

interface MascotProps {
  id: MascotId;
  /** Rendered box in CSS px (square; the art is trimmed and centered). */
  size: number;
  motion?: MascotMotion;
  /** Above-the-fold hosts (banners) load eagerly; the rest lazily. */
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Gold crown on top (Flawless). */
  crown?: boolean;
}

/** The small rounded 3-point crown (§3 Flawless), drawn in code. */
export function MascotCrown({ size }: { size: number }) {
  const w = Math.round(size * 0.55);
  const h = Math.round(w * 0.62);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 32 20"
      aria-hidden="true"
      className="absolute left-1/2 pointer-events-none"
      style={{ top: -Math.round(h * 0.55), transform: 'translateX(-50%) rotate(-8deg)', filter: 'drop-shadow(0 1px 1px rgba(146,64,14,0.35))' }}
    >
      <path
        d="M3 17.5 L1.8 5.5 Q1.6 3.6 3.2 4.6 L9.5 9 L14.6 1.8 Q16 0 17.4 1.8 L22.5 9 L28.8 4.6 Q30.4 3.6 30.2 5.5 L29 17.5 Q28.8 19 27.3 19 L4.7 19 Q3.2 19 3 17.5 Z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="13.5" r="2.1" fill="#fde68a" />
    </svg>
  );
}

export function Mascot({ id, size, motion = 'none', priority = false, className = '', style, crown = false }: MascotProps) {
  return (
    <span
      aria-hidden="true"
      className={`mascot mascot-${motion} relative inline-block shrink-0 pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, lineHeight: 0, ...style }}
    >
      <Image
        src={mascotSrc(id)}
        alt=""
        width={size}
        height={size}
        priority={priority}
        loading={priority ? undefined : 'lazy'}
        draggable={false}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {crown && <MascotCrown size={size} />}
    </span>
  );
}

interface CastRowProps {
  /** Per-tile size in CSS px. */
  size: number;
  /** 'wave' hops left to right (staggered); 'none' is static. */
  motion?: 'none' | 'wave';
  /** Hop height in px (loader 8, celebration 14). */
  hop?: number;
  /** Stagger between tiles in ms (loader 70, celebration 60). */
  stagger?: number;
  /** One loop in ms (loader 1100). */
  duration?: number;
  /** Loops: 'infinite' (loader) or a count (celebration: 2). */
  iterations?: number | 'infinite';
  /** Gap between tiles in px. */
  gap?: number;
  /** W wears the gold crown (Flawless). */
  crownW?: boolean;
  className?: string;
}

/** The ten in order, spelling WORDOCIOUS. */
export function CastRow({
  size, motion = 'none', hop = 8, stagger = 70, duration = 1100, iterations = 'infinite', gap = 2, crownW = false, className = '',
}: CastRowProps) {
  return (
    <span aria-hidden="true" className={`inline-flex items-end pointer-events-none ${className}`} style={{ gap }}>
      {CAST.map((id, i) => (
        <Mascot
          key={id}
          id={id}
          size={size}
          motion={motion}
          crown={crownW && id === 'w'}
          style={motion === 'wave' ? ({
            '--mascot-hop': `${hop}px`,
            '--mascot-delay': `${i * stagger}ms`,
            '--mascot-dur': `${duration}ms`,
            '--mascot-iter': String(iterations),
          } as React.CSSProperties) : undefined}
        />
      ))}
    </span>
  );
}

/** §2 empty state: a 96 px host bobbing over its one-line voice. */
export function MascotEmptyState({ id, line, size = 96, className = '' }: { id: MascotId; line: string; size?: number; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`}>
      <Mascot id={id} size={size} motion="bob" />
      <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{line}</p>
    </div>
  );
}

/** Right padding a banner's headline keeps so the host never covers it. */
export const BANNER_HOST_CLEARANCE = 68;

/**
 * §2 banner host: wraps a one-window banner and stands its host at the right
 * end of the frosted strip, 56 px, peeking ~12 px over the window's top edge,
 * with the idle bob. The wrapper adds the headroom so a scroll container never
 * clips the peek; the banner keeps BANNER_HOST_CLEARANCE on its headline.
 */
export function BannerHost({ id, crown = false, children }: { id: MascotId; crown?: boolean; children: React.ReactNode }) {
  const headroom = crown ? 26 : 16;
  return (
    <div className="relative shrink-0" style={{ paddingTop: headroom }}>
      {children}
      <Mascot
        id={id}
        size={56}
        motion="bob"
        priority
        crown={crown}
        style={{ position: 'absolute', top: headroom - 12, right: 10, zIndex: 1 }}
      />
    </div>
  );
}

/**
 * §5 game screen title: the game's 30 px host standing at the left of its
 * title, static (no motion during play). Wraps the existing h1 unchanged.
 */
export function GameHostTitle({ mode, className = '', children }: { mode: string; className?: string; children: React.ReactNode }) {
  const id = gameHost(mode);
  return (
    <div className={`flex items-center justify-center gap-1.5 ${className}`}>
      {id && <Mascot id={id} size={30} priority />}
      {children}
    </div>
  );
}

/**
 * §3 result host: centered over a result window, 80 px. A win pops in; a loss
 * or a draw stands still.
 */
export function ResultHost({ id, pop = false, size = 80 }: { id: MascotId; pop?: boolean; size?: number }) {
  return (
    <div className="flex justify-center" style={{ marginBottom: -6 }}>
      <Mascot id={id} size={size} motion={pop ? 'pop' : 'none'} priority />
    </div>
  );
}
