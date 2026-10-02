import Image from 'next/image';
import { CAST, gameHost, mascotSrc, type MascotId } from '@/lib/mascots';
import { Icon3D } from '@/components/ui/icon3d';
import { ArtTitle } from '@/components/ui/art-title';
import { GAME_TITLE_ART_HEIGHT, gameTitleArtForDbKey } from '@/lib/art';

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
  /** The 3D crown on top (Flawless). */
  crown?: boolean;
}

/**
 * The crown on top (§3 Flawless; HEADER_SPEC §2: every crown is the 3D
 * `crown` icon), ~45% of the mascot's width, tilted on its top edge.
 */
export function MascotCrown({ size }: { size: number }) {
  const c = Math.round(size * 0.45);
  return (
    <Icon3D
      name="crown"
      size={c}
      className="absolute left-1/2"
      style={{ top: -Math.round(c * 0.6), transform: 'translateX(-50%) rotate(-8deg)', filter: 'drop-shadow(0 1px 1px rgba(146,64,14,0.3))' }}
    />
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

// §2/§6 empty states draw a scene now (docs/ART_SPEC.md §7):
// components/ui/art-scene.tsx SceneEmptyState.

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
 *
 * ART_SPEC §10: given `label` (the game title, the art's accessible name) and a
 * game with title art, the art (lettering + host in one image) draws instead,
 * ≈38 px tall, fit to the width between the header's corner buttons. Headers
 * too tight for it (Muddle's compact header) pass no label and keep the text.
 */
export function GameHostTitle({ mode, label, className = '', children }: {
  mode: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const art = label ? gameTitleArtForDbKey(mode) : null;
  if (art && label) {
    // px-14 keeps the art clear of the 44 px corner buttons (left-2 / right-2);
    // `className` is the text title's (e.g. Crosswordocious' px-12), not used here.
    return <ArtTitle name={art} label={label} height={GAME_TITLE_ART_HEIGHT.header} as="h1" className="px-14" />;
  }
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
