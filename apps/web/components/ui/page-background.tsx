import { BACKDROP_GAME, BACKDROP_PAGE, backdropColors, type BackdropLook } from '@/lib/backdrop-tiles';
import { PAGE_TINTS, WALL_OVERLAY, accentCardShadow, artSrc, wideWallSrc, gameTintForDbKey, gameWallForDbKey, pageWall, type PageTint, type TintStops, type WallArtName } from '@/lib/art';

// The one shared page background (docs/ART_SPEC.md §11, §19.1). It is the
// page's root element and draws, in a fixed layer behind everything (edge to
// edge, under the header and the status bar; the bottom tab bar keeps its own
// surface), the page's wallpaper (`art-wall-<tint>`, §19.1): cover-fit,
// centered, FIXED (it does not scroll with the content). The old tint gradient
// sits under it only as the fallback if the image fails. It also hands its
// cards the tinted shadow (`--page-card-shadow`, read through lib/art.ts
// onPageShadow).
//
// Tints: home (Home, Settings, Pro, Help/Guides, profile, the default),
// leaderboard (Leaderboard, Records), stats, friends, vs (VS pages).
// Dark mode follows the site's [data-theme="dark"] like every other surface:
// the same wallpaper under a 58% #120D1F overlay (games 62%). Pages whose cards
// are drawn light-only (Friends, VS) pass scheme="light" so their gray labels
// never sit on a dimmed page. Reduce transparency / more contrast keeps the
// wallpaper and adds a 20% white (light) / 70% dark overlay (globals.css .page-bg).
// No hooks, so server pages can use it too.
//
// §15 + §19.1: solo game screens (GameBackground) draw their own
// `art-wall-game-<id>`, with the game's tint (lib/art.ts gameTint, made from
// its accent) as fallback and card shadow; boards, keyboards and tiles draw
// their own opaque colors on top.

interface PageBackgroundProps {
  tint?: PageTint;
  /** 'light' pins the light look even in the dark theme (light-only pages). */
  scheme?: 'auto' | 'light';
  /** Custom fallback stops + accent instead of a named tint (§15 game screens). */
  colors?: TintStops;
  /** The wallpaper instead of the tint's own (§19.1 game screens: art-wall-game-<id>). */
  wall?: WallArtName | null;
  /** Dark-mode dim over the wallpaper, 0–1 (menus 58%, game screens 62%). */
  dim?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function PageBackground({
  tint = 'home', scheme = 'auto', colors, wall, dim = WALL_OVERLAY.dark, className = '', style, children,
}: PageBackgroundProps) {
  const { light, dark, accent } = colors ?? PAGE_TINTS[tint];
  const wallName = wall === undefined ? pageWall(tint) : wall;
  const vars = {
    '--page-bg-1': light[0],
    '--page-bg-2': light[1],
    '--page-bg-3': light[2],
    '--page-bg-dark-1': dark[0],
    '--page-bg-dark-2': dark[1],
    '--page-bg-dark-3': dark[2],
    ...(wallName ? { '--page-wall': `url('${artSrc(wallName)}')`, '--page-wall-wide': `url('${wideWallSrc(wallName)}')` } : {}),
    '--page-wall-overlay': WALL_OVERLAY.color,
    '--page-wall-dim': String(dim),
    '--page-wall-a11y-light': String(WALL_OVERLAY.a11yLight),
    '--page-wall-a11y-dark': String(WALL_OVERLAY.a11yDark),
    '--page-card-shadow': accentCardShadow(accent),
    // FINISH_SPEC N3: the cast row's ground shadow leans toward the page accent.
    '--page-accent': accent,
  } as React.CSSProperties;
  return (
    <div className={className} style={{ ...vars, ...style }} data-page-tint={colors ? 'game' : tint} data-page-scheme={scheme}>
      <div className="page-bg" aria-hidden="true">
        <BackdropTiles look={colors ? BACKDROP_GAME : BACKDROP_PAGE} accent={accent} />
      </div>
      {children}
    </div>
  );
}

/**
 * A solo game screen's background (docs/ART_SPEC.md §15, §19.1): the game's
 * own wallpaper (`art-wall-game-<id>`, dimmed 62% in dark mode) with its tint
 * (gameTint of its accent) as fallback and for the cards' shadows. Not for VS
 * matches. The game's root element: it takes the className / style the old
 * flat-background div had.
 */
export function GameBackground({ mode, className = '', ...rest }: Omit<PageBackgroundProps, 'tint' | 'colors' | 'wall' | 'dim'> & {
  /** The mode's db key (DUEL, QUORDLE, SCRAMBLE, …). */
  mode: string;
}) {
  return (
    <PageBackground
      colors={gameTintForDbKey(mode) ?? undefined}
      wall={gameWallForDbKey(mode)}
      dim={WALL_OVERLAY.darkGame}
      // FINISH_SPEC AG: on desktop web (≥ 900 px) every game screen is the 560 px
      // centered column (globals.css .page-col); the wallpaper layer stays fixed
      // to the whole window and the board fit measures the column.
      className={`page-col ${className}`}
      {...rest}
    />
  );
}

/**
 * FINISH_SPEC BJ8: the few calm backdrop tiles (lib/backdrop-tiles.ts), inside the
 * fixed wallpaper layer (so the dark overlay dims them too). Static, no motion.
 */
function BackdropTiles({ look, accent }: { look: BackdropLook; accent: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: look.opacity }}>
      {look.tiles.map((t) => {
        const c = backdropColors(t, look, accent);
        return (
          <span
            key={t.letter + t.y}
            style={{
              position: 'absolute', top: `calc(${t.y * 100}% - ${t.size / 2}px)`,
              [t.leading ? 'left' : 'right']: t.inset - t.size / 2,
              width: t.size, height: t.size, borderRadius: t.size * 0.24,
              background: `linear-gradient(${c.top}, ${c.face})`, boxShadow: `0 ${t.size * 0.08}px 0 ${c.lip}`,
              transform: `rotate(${t.rotation}deg)`, color: '#fff', fontWeight: 900,
              fontSize: t.size * 0.58, lineHeight: `${t.size}px`, textAlign: 'center',
            }}
          >
            {t.letter}
          </span>
        );
      })}
    </div>
  );
}
