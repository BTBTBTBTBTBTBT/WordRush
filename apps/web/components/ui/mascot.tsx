import Image from 'next/image';
import { CAST, gameHost, mascotSrc, type MascotId } from '@/lib/mascots';
import { Icon3D } from '@/components/ui/icon3d';
import { ART_SIZE, GAME_HEADER, GAME_TITLE_ART_HEIGHT, artSrc, gameHeaderArtHeight, gameTitleArtForDbKey, type PoseArtName } from '@/lib/art';

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
  /** Another image of this character in place of the hero (FINISH_SPEC X: a seasonal skin). */
  src?: string;
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

export function Mascot({ id, size, motion = 'none', priority = false, className = '', style, crown = false, src }: MascotProps) {
  return (
    <span
      aria-hidden="true"
      className={`mascot mascot-${motion} relative inline-block shrink-0 pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, lineHeight: 0, ...style }}
    >
      <Image
        src={src ?? mascotSrc(id)}
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
  /** Per-character image overrides (FINISH_SPEC X: the seasonal skins; lib/season.ts castArt). */
  srcs?: Partial<Record<MascotId, string>>;
  className?: string;
}

/** The ten in order, spelling WORDOCIOUS. */
export function CastRow({
  size, motion = 'none', hop = 8, stagger = 70, duration = 1100, iterations = 'infinite', gap = 2, crownW = false, srcs, className = '',
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
          src={srcs?.[id]}
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
/** BH3: the banner host's size (was 60) and the headline room it needs on each side. */
export const BANNER_HOST_SIZE = 52;
export const BANNER_HOST_CLEARANCE = 58;

/**
 * §2 banner host: wraps a one-window banner and stands its host at the right
 * end of the frosted strip, 56 px, peeking ~12 px over the window's top edge,
 * with the idle bob. The wrapper adds the headroom so a scroll container never
 * clips the peek; the banner keeps BANNER_HOST_CLEARANCE on its headline.
 */
export function BannerHost({ id, crown = false, pose, custom, children }: {
  id: MascotId;
  crown?: boolean;
  /**
   * FINISH_SPEC A7: draw this pose of the host instead of its hero image — on
   * a page whose cast header already shows the hero (Home), the same character
   * never appears in the same image twice.
   */
  pose?: PoseArtName;
  /** FINISH_SPEC BJ6: draw this instead (the player's own mascot), same 60 px spot + bob. */
  custom?: React.ReactNode;
  children: React.ReactNode;
}) {
  // BH3: the host (52) stands centered on the one-line headline row; the card keeps 6 of headroom
  // (16 when Flawless crowns him).
  const headroom = crown ? 16 : 6;
  const place: React.CSSProperties = { position: 'absolute', top: headroom + 4 + 16 - BANNER_HOST_SIZE / 2, right: 10, zIndex: 1 };
  return (
    <div className="relative shrink-0" style={{ paddingTop: headroom }}>
      {children}
      {custom ? (
        <span aria-hidden="true" className="mascot mascot-bob pointer-events-none select-none" style={{ ...place, width: BANNER_HOST_SIZE, height: BANNER_HOST_SIZE, lineHeight: 0 }}>
          {custom}
          {crown && <MascotCrown size={BANNER_HOST_SIZE} />}
        </span>
      ) : pose ? (
        <span aria-hidden="true" className="mascot mascot-bob pointer-events-none select-none" style={{ ...place, width: BANNER_HOST_SIZE, height: BANNER_HOST_SIZE, lineHeight: 0 }}>
          <Image src={artSrc(pose)} alt="" width={ART_SIZE[pose][0]} height={ART_SIZE[pose][1]} priority draggable={false} style={{ width: BANNER_HOST_SIZE, height: BANNER_HOST_SIZE, objectFit: 'contain' }} />
          {crown && <MascotCrown size={BANNER_HOST_SIZE} />}
        </span>
      ) : (
        <Mascot id={id} size={BANNER_HOST_SIZE - 4} motion="bob" priority crown={crown} style={place} />
      )}
    </div>
  );
}

/**
 * §5 game screen title: the game's 30 px host standing at the left of its
 * title, static (no motion during play). Wraps the existing h1 unchanged.
 *
 * ART_SPEC §10 + §19.3: given `label` (the game title, the art's accessible
 * name) and a game with title art, the art (lettering + host in one image)
 * draws instead, BELOW the corner-button row, spanning the full width minus
 * 32 (height follows the aspect ratio, ≤ 120 px, ≤ 84 on short viewports;
 * lib/art.ts gameHeaderArtHeight). The header takes `game-art-header` +
 * gameHeaderStyle(mode) so the buttons keep their own top row and the status
 * line follows the art. The art pops in once (§16), no float.
 */
export function GameHostTitle({ mode, label, className = '', children }: {
  mode: string;
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const art = label ? gameTitleArtForDbKey(mode) : null;
  if (art && label) {
    // `className` is the text title's (e.g. Crosswordocious' px-12), not used here.
    const [w, h] = ART_SIZE[art];
    return (
      <h1 className="flex justify-center m-0 select-none" style={{ lineHeight: 0, height: gameHeaderArtHeight(art) }}>
        <Image
          src={artSrc(art)}
          alt={label}
          width={w}
          height={h}
          priority
          draggable={false}
          sizes={`${Math.ceil((GAME_TITLE_ART_HEIGHT.header * w) / h)}px`}
          className="block pointer-events-none art-pop"
          style={{
            aspectRatio: `${w} / ${h}`,
            height: '100%',
            width: 'auto',
            // Full width minus 32 (16 a side, the header's own px-2 included), even where the header is narrower than the viewport.
            maxWidth: `calc(100% - ${GAME_HEADER.inset - 2 * GAME_HEADER.side}px)`,
            objectFit: 'contain',
          }}
        />
      </h1>
    );
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
